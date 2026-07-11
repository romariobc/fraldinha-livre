import type { Order } from '@/lib/account-mock'
import type { OrderItem } from '@/lib/domain/order'

/**
 * Retorna as linhas de um pedido. Se o pedido ja tem items[] (canonico D-018), usa-o;
 * senao, deriva UMA linha dos campos legados (product/quantity/unit/price).
 */
export function getOrderItems(order: Order): OrderItem[] {
  if (order.items && order.items.length > 0) return order.items
  return [{
    productId: `${order.id}-p1`,
    productName: order.product,
    unitPrice: order.price ?? 0,
    quantity: order.quantity,
    unit: order.unit,
  }]
}
