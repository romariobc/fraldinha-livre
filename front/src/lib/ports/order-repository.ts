import type { Order, CreateOrderRequest } from '@contracts'

export interface OrderRepository {
  list(): Promise<Order[]>
  create(req: CreateOrderRequest): Promise<Order>
  cancel(orderId: string): Promise<Order>
}

/** Lançado por cancel() quando o pedido não existe. */
export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`)
    this.name = 'OrderNotFoundError'
  }
}

/** Lançado por cancel() quando o pedido existe mas não está mais em 'aguardando' (trava D-025). */
export class OrderCancelNotAllowedError extends Error {
  constructor(orderId: string, status: string) {
    super(`Cannot cancel order ${orderId}: status is '${status}', expected 'aguardando'`)
    this.name = 'OrderCancelNotAllowedError'
  }
}

/** Lançado por cancel() quando o pedido existe mas não pertence ao usuário atual (403, RN-04). */
export class OrderForbiddenError extends Error {
  constructor(orderId: string) {
    super(`Not allowed to cancel order: ${orderId}`)
    this.name = 'OrderForbiddenError'
  }
}
