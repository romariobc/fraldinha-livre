import { apiFetch, ApiError } from '@/lib/api-client'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError, OrderForbiddenError, InsufficientStockError } from '@/lib/ports/order-repository'
import type { Order, CreateOrderRequest } from '@contracts'
import { OrderSchema, OrderListSchema } from '@contracts'

export class HttpOrderRepository implements OrderRepository {
  async list(): Promise<Order[]> {
    try {
      const res = await apiFetch('/orders')
      const json = await res.json()
      return OrderListSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Failed to list orders: HTTP ${error.status}`)
      }
      throw error
    }
  }

  async listForSupplier(): Promise<Order[]> {
    try {
      const res = await apiFetch('/orders?scope=fornecedor')
      const json = await res.json()
      return OrderListSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Failed to list supplier orders: HTTP ${error.status}`)
      }
      throw error
    }
  }

  async create(req: CreateOrderRequest, idempotencyKey?: string): Promise<Order> {
    const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        headers: {
          'Idempotency-Key': key,
        },
        body: JSON.stringify(req),
      })
      const json = await res.json()
      return OrderSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK') {
        throw new InsufficientStockError(error.message)
      }
      if (error instanceof ApiError) {
        throw new Error(`Failed to create order: HTTP ${error.status}`)
      }
      throw error
    }
  }

  async cancel(orderId: string): Promise<Order> {
    try {
      const res = await apiFetch(`/orders/${orderId}/cancel`, { method: 'PATCH' })
      const json = await res.json()
      return OrderSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'ORDER_NOT_FOUND') throw new OrderNotFoundError(orderId)
        if (error.code === 'FORBIDDEN') throw new OrderForbiddenError(orderId)
        if (error.code === 'ORDER_NOT_AWAITING') throw new OrderCancelNotAllowedError(orderId, 'unknown')
        throw new Error(`Failed to cancel order: HTTP ${error.status}`)
      }
      throw error
    }
  }
}
