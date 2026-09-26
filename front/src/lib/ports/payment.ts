import { Money } from '@/lib/domain/money'
import type {
  PaymentMethod as ContractPaymentMethod,
  SimulatedPaymentOutcome,
  SimulatedPaymentResult as ContractSimulatedPaymentResult,
} from '@contracts'

export type PaymentMethod = ContractPaymentMethod
export type { SimulatedPaymentOutcome }

/**
 * PaymentRequest: input contract for the payment gateway.
 * Supports optional simulationOutcome for test scenarios.
 */
export interface PaymentRequest {
  orderId?: string
  amount: Money // in centavos
  method: PaymentMethod
  simulationOutcome?: SimulatedPaymentOutcome
}

/**
 * PaymentResult: output contract from the payment gateway.
 * Indicates approval, decline, or pending status with transactionId.
 */
export type PaymentResult = ContractSimulatedPaymentResult

/**
 * PaymentGateway: hexagonal port (interface only).
 */
export interface PaymentGateway {
  /**
   * Processes a payment charge request.
   * @param req - PaymentRequest with order/amount/method/simulationOutcome
   * @returns Promise<PaymentResult> with status and transaction ID
   */
  charge(req: PaymentRequest): Promise<PaymentResult>
}
