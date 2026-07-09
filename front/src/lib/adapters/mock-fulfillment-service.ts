import type { FulfillmentService, FulfillmentRequest, FulfillmentResult } from '@/lib/ports/fulfillment'

/**
 * MockFulfillmentService - deterministic mock implementation of FulfillmentService.
 *
 * Configured via injected dependencies (no internal timers or randomness).
 * - idFactory: () => string — generates unique tracking codes
 * - outcome: 'scheduled' | 'rejected' — default 'scheduled'
 * - estimatedDays: number — default 3
 */
export class MockFulfillmentService implements FulfillmentService {
  private idFactory: () => string
  private outcome: 'scheduled' | 'rejected'
  private estimatedDays: number

  constructor(options: {
    idFactory: () => string
    outcome?: 'scheduled' | 'rejected'
    estimatedDays?: number
  }) {
    this.idFactory = options.idFactory
    this.outcome = options.outcome ?? 'scheduled'
    this.estimatedDays = options.estimatedDays ?? 3
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async schedule(_req: FulfillmentRequest): Promise<FulfillmentResult> {
    if (this.outcome === 'scheduled') {
      return {
        status: 'scheduled',
        trackingCode: this.idFactory(),
        estimatedDays: this.estimatedDays,
      }
    }

    // rejected
    return {
      status: 'rejected',
    }
  }
}
