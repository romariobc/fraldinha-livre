import { drizzle } from 'drizzle-orm/d1'
import { eq, sql, inArray, and } from 'drizzle-orm'
import type { Context } from 'hono'
import { OrderSchema, CreateOrderRequestSchema, UpdateOrderStatusRequestSchema } from '../../../packages/contracts/src/order'
import { orders, orderItems } from '../schema/orders'
import { products } from '../schema/products'
import { reports } from '../schema/reports'
import type { Env, AppContext } from '../env'
import { ZodError } from 'zod'
import { notifySupplierOfNewOrder, sendViaResend } from '../lib/notifications'
import { hasAnyRole } from '../middleware/auth'
import { logger } from '../lib/logger'
import { respondError, respondZodError } from '../lib/errors'
import { createOrderAtomically, transitionOrderAtomically, requestFingerprint } from '../lib/order-atomicity'

/**
 * Gera um UUID v4 usando a API de crypto disponível (Workers/Node).
 */
function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // Modifica os bytes para serem v4
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  // Converte para string hexadecimal
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // Formata como UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`
}

type OrderContext = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>
type OrderDb = ReturnType<typeof drizzle>
async function loadOrderResponse(db: OrderDb, orderId: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get()
  if (!order) throw new Error('Pedido não encontrado após operação persistida.')
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all()
  return OrderSchema.parse({
    ...order, deliveryAddress: JSON.parse(order.deliveryAddress), items,
    price: order.price ?? undefined, supplierId: order.supplierId ?? undefined,
    supplierName: order.supplierName ?? undefined, paymentMethod: order.paymentMethod ?? undefined,
    paymentTransactionId: order.paymentTransactionId ?? undefined, paymentStatus: order.paymentStatus ?? undefined,
  })
}
async function replayOrder(c: OrderContext, db: OrderDb, order: typeof orders.$inferSelect, fingerprint: string) {
  if (order.uid !== c.get('uid')) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado para esta chave de idempotência.')
  const response = await loadOrderResponse(db, order.id)
  // Legacy rows have no hash: compare their immutable snapshot without inventing history.
  const original = order.requestFingerprint ?? await requestFingerprint(CreateOrderRequestSchema.parse(response))
  if (original !== fingerprint) return respondError(c, 'IDEMPOTENCY_CONFLICT', 409, 'Chave de idempotência reutilizada com conteúdo diferente.')
  return c.json(response, 200)
}

/**
 * GET /orders — retorna pedidos filtrados por uid do token.
 * Suporta ?scope=fornecedor para retornar pedidos dos produtos do fornecedor autenticado.
 * Valida cada order contra OrderSchema antes de responder.
 */
export const ordersGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  // uid foi colocado pelo middleware de autenticação
  const uid = c.get('uid')
  if (!uid) {
    return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  }

  try {
    const db = drizzle(c.env.DB)
    const scope = c.req.query('scope')

    let userOrders
    if (scope === 'fornecedor') {
      if (!hasAnyRole(c, ['fornecedor'])) {
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      }
      // Busca order_items cujo product_id pertence a um produto do uid autenticado (fornecedor).
      const matchingItems = await db
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(products.supplierId, uid))
        .all()

      const orderIds = [...new Set(matchingItems.map((row) => row.orderId))]
      userOrders =
        orderIds.length > 0
          ? await db.select().from(orders).where(inArray(orders.id, orderIds)).all()
          : []
    } else if (scope === 'admin') {
      if (!hasAnyRole(c, ['admin'])) {
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      }
      userOrders = await db.select().from(orders).all()
    } else {
      // Escopo padrão (comprador): exige explicitamente role comprador
      if (!hasAnyRole(c, ['comprador'])) {
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      }
      userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.uid, uid))
        .all()
    }

    // Para cada order, busca seus items
    const result = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
          .all()

        // Mapeia D1 → contrato
        const deliveryAddressJson = JSON.parse(order.deliveryAddress)

        return {
          id: order.id,
          uid: order.uid,
          type: order.type,
          status: order.status,
          product: order.product,
          quantity: order.quantity,
          unit: order.unit,
          price: order.price ?? undefined,
          supplierId: order.supplierId ?? undefined,
          supplierName: order.supplierName ?? undefined,
          deliveryAddress: deliveryAddressJson,
          createdAt: order.createdAt,
          paymentMethod: (order.paymentMethod as any) ?? undefined,
          paymentTransactionId: order.paymentTransactionId ?? undefined,
          paymentStatus: (order.paymentStatus as any) ?? undefined,
          items: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            unit: item.unit,
          })),
        }
      }),
    )

    // Valida cada order contra OrderSchema
    const validatedOrders = result.map((order) => OrderSchema.parse(order))

    return c.json(validatedOrders)
  } catch (error) {
    // Se houver erro de validação Zod ou DB, deixa falhar (não esconder)
    throw error
  }
}

import { isSupplierApproved } from '../lib/supplier-approval'

export const ordersPostHandler = async (c: OrderContext) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  if (!hasAnyRole(c, ['comprador'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  try {
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim()
    if (!idempotencyKey) return respondError(c, 'IDEMPOTENCY_KEY_REQUIRED', 400, 'Cabeçalho Idempotency-Key é obrigatório.')
    const request = CreateOrderRequestSchema.parse(await c.req.json().catch(() => null))
    if (request.price === undefined) return respondError(c, 'INVALID_REQUEST', 400, 'Campo price é obrigatório.')
    if (request.supplierId === undefined) return respondError(c, 'INVALID_REQUEST', 400, 'Campo supplierId é obrigatório.')
    const db = drizzle(c.env.DB)
    const fingerprint = await requestFingerprint(request)
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).get()
    if (existing) return replayOrder(c, db, existing, fingerprint)
    if (new Set(request.items.map((item) => item.productId)).size !== request.items.length) {
      return respondError(c, 'INVALID_REQUEST', 400, 'Produtos repetidos devem ser agrupados em um único item.')
    }

    const validateCatalog = (rows: (typeof products.$inferSelect)[]) => {
      const byId = new Map(rows.map((product) => [product.id, product]))
      for (const item of request.items) {
        const product = byId.get(item.productId)
        if (!product || !product.active || product.moderationBlocked || product.priceCents <= 0) return respondError(c, 'PRODUCT_NOT_FOUND', 400, 'Produto não encontrado ou inativo.')
        if (item.unitPrice !== product.priceCents) return respondError(c, 'PRICE_MISMATCH', 400, 'Preço divergente do catálogo.')
        if (product.supplierId !== request.supplierId) return respondError(c, 'SUPPLIER_MISMATCH', 400, 'Fornecedor divergente do catálogo.')
        if (product.quantity < item.quantity) return respondError(c, 'INSUFFICIENT_STOCK', 409, `Estoque insuficiente para o produto ${item.productName || item.productId} no momento da finalização.`)
      }
      return null
    }
    const ids = request.items.map((item) => item.productId)
    const productRows = await db.select().from(products).where(inArray(products.id, ids)).all()
    const invalidCatalog = validateCatalog(productRows)
    if (invalidCatalog) return invalidCatalog
    const total = request.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    if (request.price !== total) return respondError(c, 'TOTAL_MISMATCH', 400, 'Total divergente da soma dos itens.')

    if (!await isSupplierApproved(c.env.DB, request.supplierId)) return respondError(c, 'SUPPLIER_NOT_APPROVED', 409, 'Fornecedor indisponível para novas compras.')

    const orderId = crypto.randomUUID()
    let inserted: boolean
    try {
      inserted = await createOrderAtomically(c.env.DB, {
        orderId, uid, idempotencyKey, fingerprint,
        request: { ...request,
          supplierName: 'Fornecedor ' + request.supplierId,
          product: productRows.map(p => (p.name + ' ' + p.size).trim()).join(', '),
        },
        requestId: c.get('requestId') ?? null, createdAt: new Date().toISOString(),
      })
    } catch (error) {
      // A concurrent equivalent request can win the unique key. No stock compensation is necessary.
      const winner = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).get()
      if (winner) return replayOrder(c, db, winner, fingerprint)
      throw error
    }
    if (!inserted) {
      if (!await isSupplierApproved(c.env.DB, request.supplierId)) return respondError(c, 'SUPPLIER_NOT_APPROVED', 409, 'Fornecedor indisponível para novas compras.')
      const fresh = await db.select().from(products).where(inArray(products.id, ids)).all()
      return validateCatalog(fresh) ?? respondError(c, 'INSUFFICIENT_STOCK', 409, 'Catálogo alterado durante a compra. Atualize e tente novamente.')
    }

    await notifySupplierOfNewOrder({
      supplierEmail: productRows[0]?.supplierEmail, orderId,
      items: request.items.map((item) => ({ productName: item.productName, quantity: item.quantity, unit: item.unit })),
      totalCents: request.price, requestId: c.get('requestId'),
    }, {
      notificationsEnabled: c.env.NOTIFICATIONS_ENABLED === 'true',
      sendEmail: (email) => sendViaResend(email, c.env.RESEND_API_KEY),
    })
    logger.info(c, 'order.created', { orderId, itemCount: request.items.length, totalCents: request.price })
    return c.json(await loadOrderResponse(db, orderId), 201)
  } catch (error) {
    if (error instanceof ZodError) return respondZodError(c, error)
    throw error
  }
}

export const ordersCancelHandler = async (c: OrderContext) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  if (!hasAnyRole(c, ['comprador'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  const orderId = c.req.param('id')
    if (!orderId) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
  const db = drizzle(c.env.DB)
  const current = await db.select().from(orders).where(eq(orders.id, orderId)).get()
  if (!current) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
  if (current.uid !== uid) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  if (current.status === 'cancelado') return c.json(await loadOrderResponse(db, orderId), 200)
  if (current.status !== 'aguardando') return respondError(c, 'ORDER_NOT_AWAITING', 409, 'O pedido não está aguardando confirmação.')
  const changed = await transitionOrderAtomically(c.env.DB, {
    orderId, expectedStatus: current.status, expectedMutationId: current.mutationId,
    targetStatus: 'cancelado', actorId: uid, requestId: c.get('requestId') ?? null,
    reason: 'Cancelado pelo comprador',
  })
  if (!changed) {
    const fresh = await db.select().from(orders).where(eq(orders.id, orderId)).get()
    if (fresh?.status !== 'cancelado') return respondError(c, 'ORDER_NOT_AWAITING', 409, 'Pedido alterado ou estoque indisponível para restituição. Atualize os dados.')
  }
  return c.json(await loadOrderResponse(db, orderId), 200)
}

/**
 * POST /orders/:id/report — Fornecedor reporta um problema/mensagem para o comprador.
 */
export const ordersReportHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  }
  if (!hasAnyRole(c, ['fornecedor'])) {
    return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  }

  const orderId = c.req.param('id')
    if (!orderId) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')

  try {
    const body = await c.req.json()
    if (!body.message || typeof body.message !== 'string') {
      return respondError(c, 'INVALID_REQUEST', 400, 'Campo message é obrigatório.')
    }

    const db = drizzle(c.env.DB)
    const ordersList = await db.select().from(orders).where(sql`${orders.id} = ${orderId}`).all()

    if (ordersList.length === 0) {
      return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
    }

    const order = ordersList[0]

    // Apenas o fornecedor do pedido pode reportar para o cliente
    if (order.supplierId !== uid) {
      return respondError(c, 'FORBIDDEN', 403, 'Acesso negado: apenas o fornecedor deste pedido pode reportar.')
    }

    const reportId = generateUUID()
    const createdAt = new Date().toISOString()

    await db.insert(reports).values({
      id: reportId,
      orderId: order.id,
      supplierId: uid,
      clientId: order.uid, // O uid da order é o comprador
      message: body.message,
      read: false,
      createdAt,
    })

    return c.json({ success: true, reportId })
  } catch (error) {
    throw error
  }
}

export const ordersStatusPatchHandler = async (c: OrderContext) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  if (!hasAnyRole(c, ['fornecedor', 'admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  try {
    const request = UpdateOrderStatusRequestSchema.parse(await c.req.json().catch(() => null))
    const orderId = c.req.param('id')
    if (!orderId) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
    const db = drizzle(c.env.DB)
    const current = await db.select().from(orders).where(eq(orders.id, orderId)).get()
    if (!current) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
    if (!hasAnyRole(c, ['admin'])) {
      // The persisted supplier is authoritative. Item lookup is only a legacy fallback.
      const legacyItems = current.supplierId ? [] : await db.select({ orderId: orderItems.orderId })
        .from(orderItems).innerJoin(products, eq(orderItems.productId, products.id))
        .where(and(eq(orderItems.orderId, orderId), eq(products.supplierId, uid))).all()
      if (current.supplierId !== uid && legacyItems.length === 0) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
    }
    if (current.status === request.status) return c.json(await loadOrderResponse(db, orderId), 200)
    const allowed: Record<string, readonly string[]> = {
      aguardando: ['confirmado', 'cancelado'], confirmado: ['a-caminho', 'cancelado'],
      'a-caminho': ['entregue'], entregue: [], cancelado: [],
    }
    if (!(allowed[current.status] ?? []).includes(request.status)) {
      return respondError(c, 'ORDER_STATUS_NOT_ALLOWED', 409, 'Transição de status não permitida.')
    }
    const changed = await transitionOrderAtomically(c.env.DB, {
      orderId, expectedStatus: current.status, expectedMutationId: current.mutationId,
      targetStatus: request.status, actorId: uid, requestId: c.get('requestId') ?? null, reason: request.reason,
    })
    if (!changed) {
      const fresh = await db.select().from(orders).where(eq(orders.id, orderId)).get()
      if (fresh?.status !== request.status) return respondError(c, 'ORDER_STATUS_NOT_ALLOWED', 409, 'Pedido alterado ou estoque indisponível para restituição. Atualize os dados.')
    }
    return c.json(await loadOrderResponse(db, orderId), 200)
  } catch (error) {
    if (error instanceof ZodError) return respondZodError(c, error)
    throw error
  }
}
