// src/lib/order-adapters.ts
// Adaptador puro: converte Order (compra-direta) para DirectOrder

import { Order } from '@/lib/account-mock'
import { DirectOrder } from '@/lib/supplier-mock'

export function orderToDirectOrder(order: Order): DirectOrder | null {
  if (order.type !== 'compra-direta' || !order.price) {
    return null
  }

  return {
    id: order.id,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit as 'un' | 'cx' | 'kg',
    price: order.price,
    buyerCity: order.deliveryAddress.cidade,
    buyerState: order.deliveryAddress.estado,
    createdAt: order.createdAt,
    status: order.status === 'aguardando' ? 'aguardando' : order.status === 'confirmado' ? 'confirmado' : 'cancelado',
  }
}
