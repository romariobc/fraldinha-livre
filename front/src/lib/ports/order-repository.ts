import type { Order, CreateOrderRequest } from '@contracts'

export interface OrderRepository {
  list(): Promise<Order[]>
  listForSupplier(): Promise<Order[]>
  create(req: CreateOrderRequest, idempotencyKey?: string): Promise<Order>
  cancel(orderId: string): Promise<Order>
}

/** Lançado por cancel() quando o pedido não é encontrado no banco (404). */
export class OrderNotFoundError extends Error {
  public readonly code = 'ORDER_NOT_FOUND' as const
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`)
    this.name = 'OrderNotFoundError'
  }
}

/** Lançado por cancel() quando o pedido existe mas não está mais em 'aguardando' (trava D-025). */
export class OrderCancelNotAllowedError extends Error {
  public readonly code = 'ORDER_NOT_AWAITING' as const
  constructor(orderId: string, status: string) {
    super(`Cannot cancel order ${orderId}: status is '${status}', expected 'aguardando'`)
    this.name = 'OrderCancelNotAllowedError'
  }
}

/** Lançado por cancel() quando o pedido existe mas não pertence ao usuário atual (403, RN-04). */
export class OrderForbiddenError extends Error {
  public readonly code = 'FORBIDDEN' as const
  constructor(orderId: string) {
    super(`Not allowed to cancel order: ${orderId}`)
    this.name = 'OrderForbiddenError'
  }
}

/** Lançado por create() quando o estoque acaba na fração de segundo do checkout (HTTP 409). */
export class InsufficientStockError extends Error {
  public readonly code = 'INSUFFICIENT_STOCK' as const
  constructor(message?: string) {
    super(message || 'Estoque insuficiente no momento da finalização.')
    this.name = 'InsufficientStockError'
  }
}
