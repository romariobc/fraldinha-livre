import type { Order, CreateOrderRequest } from '@contracts'

export interface OrderRepository {
  list(): Promise<Order[]>
  listForSupplier(): Promise<Order[]>
  create(req: CreateOrderRequest, idempotencyKey?: string): Promise<Order>
  cancel(orderId: string): Promise<Order>
}

export interface DomainErrorOptions {
  requestId?: string
  cause?: unknown
}

/** Lançado por cancel() quando o pedido não é encontrado no banco (404). */
export class OrderNotFoundError extends Error {
  public readonly code = 'ORDER_NOT_FOUND' as const
  public readonly requestId?: string
  constructor(orderId: string, options?: DomainErrorOptions) {
    super(`Order not found: ${orderId}`, { cause: options?.cause })
    this.name = 'OrderNotFoundError'
    this.requestId = options?.requestId
  }
}

/** Lançado por cancel() quando o pedido existe mas não está mais em 'aguardando' (trava D-025). */
export class OrderCancelNotAllowedError extends Error {
  public readonly code = 'ORDER_NOT_AWAITING' as const
  public readonly requestId?: string
  constructor(orderId: string, status: string, options?: DomainErrorOptions) {
    super(`Cannot cancel order ${orderId}: status is '${status}', expected 'aguardando'`, { cause: options?.cause })
    this.name = 'OrderCancelNotAllowedError'
    this.requestId = options?.requestId
  }
}

/** Lançado por cancel() quando o pedido existe mas não pertence ao usuário atual (403, RN-04). */
export class OrderForbiddenError extends Error {
  public readonly code = 'FORBIDDEN' as const
  public readonly requestId?: string
  constructor(orderId: string, options?: DomainErrorOptions) {
    super(`Not allowed to cancel order: ${orderId}`, { cause: options?.cause })
    this.name = 'OrderForbiddenError'
    this.requestId = options?.requestId
  }
}

/** Lançado por create() quando o estoque acaba na fração de segundo do checkout (HTTP 409). */
export class InsufficientStockError extends Error {
  public readonly code = 'INSUFFICIENT_STOCK' as const
  public readonly requestId?: string
  constructor(message?: string, options?: DomainErrorOptions) {
    super(message || 'Estoque insuficiente no momento da finalização.', { cause: options?.cause })
    this.name = 'InsufficientStockError'
    this.requestId = options?.requestId
  }
}
