import type { Address } from '@/lib/account-mock'
import type { OrderItem } from '@/lib/domain/order'

/**
 * FulfillmentRequest: input contract for the fulfillment service.
 * Sent to the adapter (backend logistics or T2 mock).
 */
export interface FulfillmentRequest {
  orderId: string
  address: Address
  items: OrderItem[]
}

/**
 * FulfillmentResult: output contract from the fulfillment service.
 * Indicates scheduling success or rejection.
 */
export interface FulfillmentResult {
  status: 'scheduled' | 'rejected'
  trackingCode?: string // present when status === 'scheduled'
  estimatedDays?: number // present when status === 'scheduled'
}

/**
 * FulfillmentService: hexagonal port (interface only, no implementation here).
 *
 * Implementations must satisfy this contract:
 * - The backend adapter (logistics integration, RN-13) implements this for production.
 * - The T2 mock adapter implements this for testing.
 * - Contract tests verify both implementations.
 *
 * All I/O happens in the adapter, not here. This is purely the interface.
 */
export interface FulfillmentService {
  /**
   * Schedules fulfillment for an order.
   * @param req - FulfillmentRequest with orderId/address/items
   * @returns Promise<FulfillmentResult> with status and optional tracking info
   */
  schedule(req: FulfillmentRequest): Promise<FulfillmentResult>
}
