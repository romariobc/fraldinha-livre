import { drizzle } from 'drizzle-orm/d1'
import { eq, sql, inArray, and, gte } from 'drizzle-orm'
import type { Context } from 'hono'
import { OrderSchema, CreateOrderRequestSchema } from '../../../packages/contracts/src/order'
import { orders, orderItems } from '../schema/orders'
import { products } from '../schema/products'
import { reports } from '../schema/reports'
import type { Env, AppContext } from '../env'
import { ZodError } from 'zod'
import { notifySupplierOfNewOrder, sendViaResend } from '../lib/notifications'
import { hasAnyRole } from '../middleware/auth'
import { logger } from '../lib/logger'
import { respondError, respondZodError } from '../lib/errors'

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
    return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  }
  if (!hasAnyRole(c, ['comprador'])) {
    return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  }

  try {
    const idempotencyKey = c.req.header('idempotency-key') || c.req.header('Idempotency-Key')
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return respondError(c, 'IDEMPOTENCY_KEY_REQUIRED', 400, 'Cabeçalho Idempotency-Key é obrigatório.')
    }

    const body = await c.req.json()

    // Valida body contra CreateOrderRequestSchema
    // Zod ignora chaves desconhecidas, então id/uid/status/createdAt vindos do body são descartados
    const createRequest = CreateOrderRequestSchema.parse(body)

    // RN-P2b: price (total) e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
    if (createRequest.price === undefined) {
      return respondError(c, 'INVALID_REQUEST', 400, 'Campo price é obrigatório.')
    }

    // RN-P2c: supplierId e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
    if (createRequest.supplierId === undefined) {
      return respondError(c, 'INVALID_REQUEST', 400, 'Campo supplierId é obrigatório.')
    }

    const db = drizzle(c.env.DB)

    // Lógica de Idempotência: busca se já existe um pedido com este idempotencyKey
    const existingOrder = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).get()
    if (existingOrder) {
      if (existingOrder.uid !== uid) {
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado para esta chave de idempotência.')
      }
      const existingItems = await db.select().from(orderItems).where(eq(orderItems.orderId, existingOrder.id)).all()
      const deliveryAddressObj = JSON.parse(existingOrder.deliveryAddress)
      const responseExistingOrder = {
        id: existingOrder.id,
        uid: existingOrder.uid,
        type: existingOrder.type,
        status: existingOrder.status,
        product: existingOrder.product,
        quantity: existingOrder.quantity,
        unit: existingOrder.unit,
        price: existingOrder.price ?? undefined,
        supplierId: existingOrder.supplierId ?? undefined,
        supplierName: existingOrder.supplierName ?? undefined,
        deliveryAddress: deliveryAddressObj,
        createdAt: existingOrder.createdAt,
        items: existingItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          unit: item.unit,
        })),
      }
      const validatedExisting = OrderSchema.parse(responseExistingOrder)
      logger.info(c, 'order.idempotency.reused', { orderId: existingOrder.id })
      return c.json(validatedExisting, 200)
    }

    // Busca em lote (nao 1 query por item) - RN-P2/P2c.
    const productIds = createRequest.items.map((item) => item.productId)
    const productRows = await db.select().from(products).where(inArray(products.id, productIds)).all()
    const productById = new Map(productRows.map((p) => [p.id, p]))

    // Falha rapido no primeiro item invalido (RN-P3), antes de qualquer escrita (RN-P4).
    for (const item of createRequest.items) {
      const product = productById.get(item.productId)
      if (!product) {
        return respondError(c, 'PRODUCT_NOT_FOUND', 400, `Produto não encontrado: ${item.productId}`)
      }
      if (item.unitPrice !== product.priceCents) {
        return respondError(c, 'PRICE_MISMATCH', 400, `Preço divergente para o produto: ${item.productId}`)
      }
      if (product.supplierId !== createRequest.supplierId) {
        return respondError(c, 'SUPPLIER_MISMATCH', 400, `Fornecedor divergente para o produto: ${item.productId}`)
      }
      if (product.quantity < item.quantity) {
        logger.warn(c, 'order.stock.insufficient', { productId: item.productId })
        return respondError(c, 'INSUFFICIENT_STOCK', 409, `Estoque insuficiente para o produto ${item.productName || item.productId} no momento da finalização.`)
      }
    }

    // RN-P2b: total tem que bater com a soma dos itens.
    const computedTotal = createRequest.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    if (createRequest.price !== computedTotal) {
      return respondError(c, 'TOTAL_MISMATCH', 400, 'Total divergente da soma dos itens.')
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
      idempotencyKey,
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

    // Constrói e executa queries de decremento atômico de estoque com RETURNING
    // para eliminar Race Condition (TOCTOU) e garantir que quantity >= requested na escrita.
    const productUpdates = createRequest.items.map((item) =>
      db.update(products)
        .set({ quantity: sql`${products.quantity} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), gte(products.quantity, item.quantity)))
        .returning({ id: products.id })
    )

    let updateResults: { id: string }[][]
    try {
      updateResults = await db.batch(productUpdates as any)
    } catch (batchError) {
      // Se estourar constraint no D1 (ex: CHECK products_quantity_check), aborta imediatamente com 409
      logger.warn(c, 'stock.decrement.failed')
      return respondError(c, 'INSUFFICIENT_STOCK', 409, 'Estoque insuficiente para um ou mais produtos no momento da finalização.')
    }

    const failedItemIndex = updateResults.findIndex((rows) => !rows || rows.length === 0)
    if (failedItemIndex !== -1) {
      // Compensação: restaura os itens que porventura foram decrementados nesta mesma tentativa
      const rollbacks = []
      for (let i = 0; i < createRequest.items.length; i++) {
        if (i !== failedItemIndex && updateResults[i]?.length > 0) {
          const itemToRollback = createRequest.items[i]
          rollbacks.push(
            db.update(products)
              .set({ quantity: sql`${products.quantity} + ${itemToRollback.quantity}` })
              .where(eq(products.id, itemToRollback.productId))
          )
        }
      }
      if (rollbacks.length > 0) {
        await db.batch(rollbacks as any)
        logger.warn(c, 'stock.rollback.executed', { rollbacksCount: rollbacks.length })
      }

      const failedItem = createRequest.items[failedItemIndex]
      logger.warn(c, 'order.stock.insufficient', { productId: failedItem.productId })
      return respondError(c, 'INSUFFICIENT_STOCK', 409, `Estoque insuficiente para o produto ${failedItem.productName || failedItem.productId} no momento da finalização.`)
    }

    // Com o estoque atomicamente garantido e decrementado, persiste a order e os items
    try {
      await db.batch([orderInsert, ...itemInserts] as any)
    } catch (orderInsertError: any) {
      // Caso a gravação do pedido falhe inesperadamente, restaura o estoque de todos os itens
      const fullRollbacks = createRequest.items.map((item) =>
        db.update(products)
          .set({ quantity: sql`${products.quantity} + ${item.quantity}` })
          .where(eq(products.id, item.productId))
      )
      await db.batch(fullRollbacks as any)
      logger.warn(c, 'stock.rollback.executed', { rollbacksCount: fullRollbacks.length })

      // Tratamento de colisão / Race Condition da chave de idempotência
      const errStr = `${orderInsertError?.message || ''} ${orderInsertError?.cause?.message || ''}`
      if (errStr.includes('UNIQUE constraint failed') && errStr.includes('idempotency_key')) {
        const collidedOrder = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).get()
        if (collidedOrder && collidedOrder.uid === uid) {
          const collidedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, collidedOrder.id)).all()
          const deliveryAddressObj = JSON.parse(collidedOrder.deliveryAddress)
          const responseCollidedOrder = {
            id: collidedOrder.id,
            uid: collidedOrder.uid,
            type: collidedOrder.type,
            status: collidedOrder.status,
            product: collidedOrder.product,
            quantity: collidedOrder.quantity,
            unit: collidedOrder.unit,
            price: collidedOrder.price ?? undefined,
            supplierId: collidedOrder.supplierId ?? undefined,
            supplierName: collidedOrder.supplierName ?? undefined,
            deliveryAddress: deliveryAddressObj,
            createdAt: collidedOrder.createdAt,
            items: collidedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              unit: item.unit,
            })),
          }
          const validatedCollided = OrderSchema.parse(responseCollidedOrder)
          logger.info(c, 'order.idempotency.reused', { orderId: collidedOrder.id })
          return c.json(validatedCollided, 200)
        }
      }

      throw orderInsertError
    }

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
        requestId: c.get('requestId'),
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
    logger.info(c, 'order.created', { orderId, itemCount: createRequest.items.length, totalCents: createRequest.price })

    return c.json(validatedOrder, 201)
  } catch (error) {
    // Verifica se é um erro de validação Zod
    // Pode vir com name === 'ZodError' ou ter .issues
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return respondZodError(c, err)
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
    return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  }
  if (!hasAnyRole(c, ['comprador'])) {
    return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  }

  const orderId = c.req.param('id')

  try {
    const db = drizzle(c.env.DB)

    // Busca a order atualizada para retornar.
    // Usamos o RETURNING do SQLite D1 para evitar TOCTOU e garantir a atomicidade da trava de status.
    const updatedOrders = await db.update(orders)
      .set({ status: 'cancelado' })
      .where(sql`${orders.id} = ${orderId} AND ${orders.uid} = ${uid} AND ${orders.status} = 'aguardando'`)
      .returning()

    if (updatedOrders.length === 0) {
      // Se n˜åo atualizou nada, precisamos saber o motivo para retornar o erro correto (404, 403 ou 409).
      const current = await db.select().from(orders).where(sql`${orders.id} = ${orderId}`).all()
      if (current.length === 0) {
        logger.warn(c, 'order.cancel.failed', { orderId, reason: 'not_found' })
        return respondError(c, 'ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
      }
      if (current[0].uid !== uid) {
        logger.warn(c, 'order.cancel.failed', { orderId, reason: 'forbidden' })
        return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      }
      logger.warn(c, 'order.cancel.failed', { orderId, reason: 'not_awaiting' })
      return respondError(c, 'ORDER_NOT_AWAITING', 409, 'Não é possível cancelar: o pedido não está com status aguardando.')
    }

    const updatedOrder = updatedOrders[0]
    logger.info(c, 'order.cancelled', { orderId })

    // Restaura o estoque dos itens cancelados
    const itemsToRestore = await db.select().from(orderItems).where(sql`${orderItems.orderId} = ${orderId}`).all()
    const restoreUpdates = itemsToRestore.map((item) => 
      db.update(products).set({ quantity: sql`${products.quantity} + ${item.quantity}` }).where(eq(products.id, item.productId))
    )
    if (restoreUpdates.length > 0) {
      await db.batch(restoreUpdates as any)
      logger.info(c, 'stock.restore.after_cancel', { orderId, itemsCount: itemsToRestore.length })
    }

    // (a order atualizada já está em updatedOrder pelo returning)

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
    return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  }
  if (!hasAnyRole(c, ['fornecedor'])) {
    return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  }

  const orderId = c.req.param('id')

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
