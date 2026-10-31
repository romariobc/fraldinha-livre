// src/lib/order-adapters.ts
// Adaptador puro: converte Order (compra-direta) para DirectOrder

import type { Order } from '@/lib/domain/account'
import type { DirectOrder, DirectOrderStatus } from '@/lib/domain/supplier'
import type { Order as ContractOrder } from '@contracts'

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
    deliveryAddress: order.deliveryAddress,
    items: order.items,
    paymentStatus: order.paymentStatus === 'approved' ? 'confirmado' : 'pendente',
    buyerCity: order.deliveryAddress.cidade,
    buyerState: order.deliveryAddress.estado,
    createdAt: order.createdAt,
    status:
      order.status === 'aguardando' ? 'aguardando' :
      order.status === 'confirmado' ? 'confirmado' :
      order.status === 'a-caminho' ? 'a-caminho' :
      order.status === 'entregue' ? 'entregue' : 'cancelado',
  }
}

export function contractOrderToDirectOrder(order: ContractOrder): DirectOrder {
  const status: DirectOrderStatus =
    order.status === 'aguardando' ? 'aguardando' :
    order.status === 'confirmado' ? 'confirmado' :
    order.status === 'a-caminho' ? 'a-caminho' :
    order.status === 'entregue' ? 'entregue' : 'cancelado'

  return {
    id: order.id,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit as 'un' | 'cx' | 'kg',
    price: order.price ?? 0,
    deliveryAddress: order.deliveryAddress,
    items: order.items,
    paymentStatus: order.paymentStatus === 'approved' ? 'confirmado' : 'pendente',
    buyerCity: order.deliveryAddress.cidade,
    buyerState: order.deliveryAddress.estado,
    createdAt: order.createdAt,
    status,
  }
}


export function contractOrderToAccountOrder(order: ContractOrder): Order {
  return {
    id: order.id,
    type: order.type,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    createdAt: order.createdAt,
    price: order.price,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    items: order.items,
    paymentMethod: order.paymentMethod,
    paymentTransactionId: order.paymentTransactionId,
    paymentStatus: order.paymentStatus,
  }
}
