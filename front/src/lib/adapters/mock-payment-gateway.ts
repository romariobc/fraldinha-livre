import type { PaymentGateway, PaymentRequest, PaymentResult } from '@/lib/ports/payment'

/**
 * MockPaymentGateway - deterministic mock implementation of PaymentGateway.
 *
 * Configured via injected dependencies (no internal timers or randomness).
 * - now: () => string — ISO 8601 timestamp for paidAt when approved
 * - idFactory: () => string — generates unique transaction IDs
 * - outcome: 'approved' | 'declined' | 'pending' — default 'approved'
 */
export class MockPaymentGateway implements PaymentGateway {
  private now: () => string
  private idFactory: () => string
  private outcome: 'approved' | 'declined' | 'pending'

  constructor(options: {
    now: () => string
    idFactory: () => string
    outcome?: 'approved' | 'declined' | 'pending'
  }) {
    this.now = options.now
    this.idFactory = options.idFactory
    this.outcome = options.outcome ?? 'approved'
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async charge(_req: PaymentRequest): Promise<PaymentResult> {
    const transactionId = this.idFactory()

    if (this.outcome === 'approved') {
      return {
        status: 'approved',
        transactionId,
        paidAt: this.now(),
      }
    }

    if (this.outcome === 'declined') {
      return {
        status: 'declined',
        transactionId,
      }
    }

    // pending
    return {
      status: 'pending',
      transactionId,
    }
  }
}
