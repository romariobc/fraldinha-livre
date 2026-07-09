import { Money } from '@/lib/domain/money'

/**
 * PaymentMethod: supported payment methods for checkout.
 * D-019: Only pix and card in MVP.
 * Extensão futura: 'boleto'
 */
export type PaymentMethod = 'pix' | 'card' // extensão futura: 'boleto'

/**
 * PaymentRequest: input contract for the payment gateway.
 * Sent to the adapter (backend 006 or T2 mock).
 */
export interface PaymentRequest {
  orderId: string
  amount: Money // in centavos
  method: PaymentMethod
}

/**
 * PaymentResult: output contract from the payment gateway.
 * Indicates approval, decline, or pending status.
 */
export interface PaymentResult {
  status: 'approved' | 'declined' | 'pending'
  transactionId: string
  paidAt?: string // ISO 8601, present when status === 'approved'
}

/**
 * PaymentGateway: hexagonal port (interface only, no implementation here).
 *
 * Implementations must satisfy this contract:
 * - The backend adapter (backend 006, RN-19) implements this for production.
 * - The T2 mock adapter implements this for testing.
 * - Contract tests verify both implementations.
 *
 * All I/O happens in the adapter, not here. This is purely the interface.
 */
export interface PaymentGateway {
  /**
   * Processes a payment charge request.
   * @param req - PaymentRequest with order/amount/method
   * @returns Promise<PaymentResult> with status and transaction ID
   */
  charge(req: PaymentRequest): Promise<PaymentResult>
}
