import { drizzle } from 'drizzle-orm/d1'
import { eq, sql, inArray, and, or, isNull } from 'drizzle-orm'
import type { Context } from 'hono'
import { OrderSchema, OrderDetailSchema, CreateOrderRequestSchema, UpdateOrderStatusRequestSchema } from '../../../packages/contracts/src/order'
import { orderEvents } from '../schema/order-events'
import { orders, orderItems } from '../schema/orders'
import { products } from '../schema/products'
import type { Env, AppContext } from '../env'
import { ZodError } from 'zod'
import { notifySupplierOfNewOrder, sendViaResend } from '../lib/notifications'
import { hasAnyRole } from '../middleware/auth'
import { logger } from '../lib/logger'
import { respondError, respondZodError } from '../lib/errors'
import { createOrderAtomically, transitionOrderAtomically, requestFingerprint } from '../lib/order-atomicity'

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
    paymentMode: order.paymentMode ?? undefined,
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

// Keep the pre-existing legacy ownership fallback only when no supplier snapshot exists.
function supplierReadFilter(uid: string) {
  return or(eq(orders.supplierId, uid), and(isNull(orders.supplierId), sql`${orders.id} IN
    (SELECT oi.order_id FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.supplier_id = ${uid})`))
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

    if (scope && !['comprador', 'fornecedor', 'admin'].includes(scope)) return respondError(c, 'INVALID_REQUEST', 400, 'Escopo inválido.')
    let userOrders
    if (scope === 'fornecedor') {
      if (!hasAnyRole(c, ['fornecedor'])) {
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      }
      // Ownership comes from the immutable order snapshot, not today's product owner.
      userOrders = await db.select().from(orders).where(supplierReadFilter(uid)).all()
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
          paymentMode: order.paymentMode ?? undefined,
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

/** Detail and events share one D1 read transaction, including legacy snapshots. */
export const ordersDetailHandler = async (c: OrderContext) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  const scope = c.req.query('scope') || 'comprador'
  if (!['comprador', 'fornecedor', 'admin'].includes(scope)) return respondError(c, 'INVALID_REQUEST', 400, 'Escopo inválido.')
  if (!hasAnyRole(c, [scope as 'comprador' | 'fornecedor' | 'admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  const id = c.req.param('id')
  if (!id) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
  const db = drizzle(c.env.DB)
  const [rows, items, events] = await db.batch([
    db.select().from(orders).where(eq(orders.id, id)),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(orderEvents.createdAt, sql`rowid`),
  ])
  const order = rows[0]
  if (!order) return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
  const supplierAllowed = scope !== 'fornecedor' || order.supplierId === uid || (!order.supplierId && Boolean(await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, id), supplierReadFilter(uid))).get()))
  if ((scope === 'comprador' && order.uid !== uid) || !supplierAllowed) {
    return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  }
  const snapshot = { ...order, items, deliveryAddress: JSON.parse(order.deliveryAddress),
    price: order.price ?? undefined, supplierId: order.supplierId ?? undefined, supplierName: order.supplierName ?? undefined,
    paymentMode: order.paymentMode ?? undefined, paymentStatus: order.paymentStatus ?? undefined,
    paymentMethod: order.paymentMethod ?? undefined, paymentTransactionId: order.paymentTransactionId ?? undefined }
  return c.json(OrderDetailSchema.parse({ order: snapshot, events,
    historySource: !events.length ? 'legacy' : events[0].fromStatus === null ? 'complete' : 'partial' }))
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
    if (request.paymentStatus === 'pending') return respondError(c, 'INVALID_REQUEST', 400, 'Simulação pendente indisponível nesta versão.')
    if (request.simulationOutcome === 'declined' || request.paymentStatus === 'declined') {
      return respondError(c, 'PAYMENT_DECLINED', 400, 'Simulação recusada. Nenhum pedido foi criado ou estoque reservado.')
    }
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
    if (!Number.isSafeInteger(total) || total <= 0 || request.price !== total) return respondError(c, 'TOTAL_MISMATCH', 400, 'Total divergente da soma dos itens.')

    if (!await isSupplierApproved(c.env.DB, request.supplierId)) return respondError(c, 'SUPPLIER_NOT_APPROVED', 409, 'Fornecedor indisponível para novas compras.')

    const orderId = crypto.randomUUID()
    let inserted: boolean
    try {
      inserted = await createOrderAtomically(c.env.DB, {
        orderId, uid, idempotencyKey, fingerprint,
        request: { ...request,
          quantity: request.items.reduce((sum, item) => sum + item.quantity, 0),
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

// Backward-compatible endpoint; old report IDs/text/read flags remain intact.
export { occurrencesPostHandler as ordersReportHandler } from './occurrences'

export const ordersStatusPatchHandler = async (c: OrderContext) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  if (!hasAnyRole(c, ['fornecedor', 'admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  try {
    const request = UpdateOrderStatusRequestSchema.parse(await c.req.json().catch(() => null))
    const adminActor = hasAnyRole(c, ['admin'])
    if (adminActor && request.status !== 'cancelado') return respondError(c, 'FORBIDDEN', 403, 'A administração cancela antes do despacho; confirmação e entrega pertencem ao fornecedor.')
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
      adminActor,
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
