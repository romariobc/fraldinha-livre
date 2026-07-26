import { apiFetch } from '@/lib/api-client'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError, OrderForbiddenError } from '@/lib/ports/order-repository'
import type { Order, CreateOrderRequest } from '@contracts'
import { OrderSchema, OrderListSchema } from '@contracts'

export class HttpOrderRepository implements OrderRepository {
  async list(): Promise<Order[]> {
    const res = await apiFetch('/orders')
    if (!res.ok) throw new Error(`Failed to list orders: HTTP ${res.status}`)
    const json = await res.json()
    return OrderListSchema.parse(json)
  }

  async listForSupplier(): Promise<Order[]> {
    const res = await apiFetch('/orders?scope=fornecedor')
    if (!res.ok) throw new Error(`Failed to list supplier orders: HTTP ${res.status}`)
    const json = await res.json()
    return OrderListSchema.parse(json)
  }

  async create(req: CreateOrderRequest): Promise<Order> {
    const res = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(req) })
    if (!res.ok) throw new Error(`Failed to create order: HTTP ${res.status}`)
    const json = await res.json()
    return OrderSchema.parse(json)
  }

  async cancel(orderId: string): Promise<Order> {
    const res = await apiFetch(`/orders/${orderId}/cancel`, { method: 'PATCH' })
    if (res.status === 404) throw new OrderNotFoundError(orderId)
    if (res.status === 403) throw new OrderForbiddenError(orderId)
    if (res.status === 409) throw new OrderCancelNotAllowedError(orderId, 'unknown')
    if (!res.ok) throw new Error(`Failed to cancel order: HTTP ${res.status}`)
    const json = await res.json()
    return OrderSchema.parse(json)
  }
}
