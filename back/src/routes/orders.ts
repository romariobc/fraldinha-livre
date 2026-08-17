import { drizzle } from 'drizzle-orm/d1'
import { eq, sql, inArray } from 'drizzle-orm'
import type { Context } from 'hono'
import { OrderSchema, CreateOrderRequestSchema } from '../../../packages/contracts/src/order'
import { orders, orderItems } from '../schema/orders'
import { products } from '../schema/products'
import { reports } from '../schema/reports'
import type { Env, AppContext } from '../env'
import { ZodError } from 'zod'
import { notifySupplierOfNewOrder, sendViaResend } from '../lib/notifications'

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

/**
 * GET /orders — retorna pedidos filtrados por uid do token.
 * Suporta ?scope=fornecedor para retornar pedidos dos produtos do fornecedor autenticado.
 * Valida cada order contra OrderSchema antes de responder.
 */
export const ordersGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  // uid foi colocado pelo middleware de autenticação
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const db = drizzle(c.env.DB)
    const scope = c.req.query('scope')

    let userOrders
    if (scope === 'fornecedor') {
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
      if (uid !== c.env.ADMIN_UID) {
        return c.json({ error: 'forbidden' }, 403)
      }
      userOrders = await db.select().from(orders).all()
    } else {
      // Comportamento existente (comprador) — inalterado.
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

/**
 * POST /orders — cria um novo pedido.
 * Servidor define: id, uid, createdAt, status, type.
 * Grava order + todos os items num único db.batch() para garantir atomicidade (RN-03).
 */
export const ordersPostHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const body = await c.req.json()

    // Valida body contra CreateOrderRequestSchema
    // Zod ignora chaves desconhecidas, então id/uid/status/createdAt vindos do body são descartados
    const createRequest = CreateOrderRequestSchema.parse(body)

    // RN-P2b: price (total) e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
    if (createRequest.price === undefined) {
      return c.json({ error: 'price ausente' }, 400)
    }

    // RN-P2c: supplierId e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
    if (createRequest.supplierId === undefined) {
      return c.json({ error: 'supplierId ausente' }, 400)
    }

    const db = drizzle(c.env.DB)

    // Busca em lote (nao 1 query por item) - RN-P2/P2c.
    const productIds = createRequest.items.map((item) => item.productId)
    const productRows = await db.select().from(products).where(inArray(products.id, productIds)).all()
    const productById = new Map(productRows.map((p) => [p.id, p]))

    // Falha rapido no primeiro item invalido (RN-P3), antes de qualquer escrita (RN-P4).
    for (const item of createRequest.items) {
      const product = productById.get(item.productId)
      if (!product) {
        return c.json({ error: `produto nao encontrado: ${item.productId}` }, 400)
      }
      if (item.unitPrice !== product.priceCents) {
        return c.json({ error: `preco divergente para produto: ${item.productId}` }, 400)
      }
      if (product.supplierId !== createRequest.supplierId) {
        return c.json({ error: `fornecedor divergente para produto: ${item.productId}` }, 400)
      }
    }

    // RN-P2b: total tem que bater com a soma dos itens.
    const computedTotal = createRequest.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    if (createRequest.price !== computedTotal) {
      return c.json({ error: 'total divergente' }, 400)
    }

    // Servidor define metadados (RN-03)
    const orderId = generateUUID()
    const createdAt = new Date().toISOString()
    const status = 'aguardando'
    const type = 'compra-direta'

    // Serializa deliveryAddress para JSON
    const deliveryAddressJson = JSON.stringify(createRequest.deliveryAddress)

    // Constrói a query de inserção de order
    const orderInsert = db.insert(orders).values({
      id: orderId,
      uid,
      type,
      status,
      product: createRequest.product,
      quantity: createRequest.quantity,
      unit: createRequest.unit,
      price: createRequest.price ?? null,
      supplierId: createRequest.supplierId ?? null,
      supplierName: createRequest.supplierName ?? null,
      deliveryAddress: deliveryAddressJson,
      createdAt,
    })

    // Constrói queries de inserção para cada item
    const itemInserts = createRequest.items.map((item) =>
      db.insert(orderItems).values({
        orderId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit,
      }),
    )

    // Grava tudo num único batch (atomicidade RN-03)
    await db.batch([orderInsert, ...itemInserts])

    // Notifica o fornecedor (best-effort — nunca afeta a resposta, RN-02 da spec H-011)
    const notificationItems = createRequest.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
    }))
    await notifySupplierOfNewOrder(
      {
        supplierEmail: productRows[0]?.supplierEmail,
        orderId,
        items: notificationItems,
        // `?? 0` e' so pro TS (createRequest.price ja foi validado como definido
        // no early-return acima) — nunca e' 0 de verdade nesse ponto do fluxo.
        totalCents: createRequest.price ?? 0,
      },
      {
        notificationsEnabled: c.env.NOTIFICATIONS_ENABLED === 'true',
        sendEmail: (emailParams) => sendViaResend(emailParams, c.env.RESEND_API_KEY),
      },
    )

    // Busca a order e items para retornar
    const savedOrderList = await db.select().from(orders).where(eq(orders.id, orderId)).all()

    if (savedOrderList.length === 0) {
      throw new Error('Order não foi persistida após insert')
    }

    const savedOrder = savedOrderList[0]
    const savedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all()

    // Mapeia D1 → contrato
    const deliveryAddressObject = JSON.parse(savedOrder.deliveryAddress)

    const responseOrder = {
      id: savedOrder.id,
      uid: savedOrder.uid,
      type: savedOrder.type,
      status: savedOrder.status,
      product: savedOrder.product,
      quantity: savedOrder.quantity,
      unit: savedOrder.unit,
      price: savedOrder.price ?? undefined,
      supplierId: savedOrder.supplierId ?? undefined,
      supplierName: savedOrder.supplierName ?? undefined,
      deliveryAddress: deliveryAddressObject,
      createdAt: savedOrder.createdAt,
      items: savedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit,
      })),
    }

    // Valida contra OrderSchema antes de responder
    const validatedOrder = OrderSchema.parse(responseOrder)

    return c.json(validatedOrder, 201)
  } catch (error) {
    // Verifica se é um erro de validação Zod
    // Pode vir com name === 'ZodError' ou ter .issues
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    // Para outros erros, deixa ser tratado pelo middleware de erro
    throw error
  }
}

/**
 * PATCH /orders/:id/cancel — cancela um pedido.
 * Só permite cancelar se status === 'aguardando' (trava logística, D-025).
 */
export const ordersCancelHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const orderId = c.req.param('id')

  try {
    const db = drizzle(c.env.DB)

    // Busca a order por ID — usando SQL raw para evitar problema de tipo
    const ordersList = await db.select().from(orders).where(sql`${orders.id} = ${orderId}`).all()

    if (ordersList.length === 0) {
      return c.json({ error: 'order not found' }, 404)
    }

    const order = ordersList[0]

    // Order existe mas não é do uid
    if (order.uid !== uid) {
      return c.json({ error: 'forbidden' }, 403)
    }

    // Order existe, é do dono, mas status não é 'aguardando' (trava logística, D-025)
    if (order.status !== 'aguardando') {
      return c.json({ error: 'cannot cancel: order is not awaiting' }, 409)
    }

    // Atualiza status para 'cancelado'
    await db.update(orders).set({ status: 'cancelado' }).where(sql`${orders.id} = ${orderId}`)

    // Busca a order atualizada para retornar
    const updatedOrders = await db.select().from(orders).where(sql`${orders.id} = ${orderId}`).all()

    if (updatedOrders.length === 0) {
      throw new Error('Order não foi encontrada após update')
    }

    const updatedOrder = updatedOrders[0]

    // Busca items
    const items = await db.select().from(orderItems).where(sql`${orderItems.orderId} = ${orderId}`).all()

    // Mapeia D1 → contrato
    const deliveryAddressObject = JSON.parse(updatedOrder.deliveryAddress)

    const responseOrder = {
      id: updatedOrder.id,
      uid: updatedOrder.uid,
      type: updatedOrder.type,
      status: updatedOrder.status,
      product: updatedOrder.product,
      quantity: updatedOrder.quantity,
      unit: updatedOrder.unit,
      price: updatedOrder.price ?? undefined,
      supplierId: updatedOrder.supplierId ?? undefined,
      supplierName: updatedOrder.supplierName ?? undefined,
      deliveryAddress: deliveryAddressObject,
      createdAt: updatedOrder.createdAt,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit,
      })),
    }

    // Valida contra OrderSchema antes de responder
    const validatedOrder = OrderSchema.parse(responseOrder)

    return c.json(validatedOrder, 200)
  } catch (error) {
    // Não esconde erros
    throw error
  }
}

/**
 * POST /orders/:id/report — Fornecedor reporta um problema/mensagem para o comprador.
 */
export const ordersReportHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const orderId = c.req.param('id')

  try {
    const body = await c.req.json()
    if (!body.message || typeof body.message !== 'string') {
      return c.json({ error: 'message is required' }, 400)
    }

    const db = drizzle(c.env.DB)
    const ordersList = await db.select().from(orders).where(sql`${orders.id} = ${orderId}`).all()

    if (ordersList.length === 0) {
      return c.json({ error: 'order not found' }, 404)
    }

    const order = ordersList[0]

    // Apenas o fornecedor do pedido pode reportar para o cliente
    if (order.supplierId !== uid) {
      return c.json({ error: 'forbidden: only the supplier can report on this order' }, 403)
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
