import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { OrderSchema } from '../../../packages/contracts/src/order'
import { orders, orderItems } from '../schema/orders'
import type { Env, AppContext } from '../env'

/**
 * GET /orders — retorna pedidos filtrados por uid do token.
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

    // Busca orders do uid
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.uid, uid))
      .all()

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
