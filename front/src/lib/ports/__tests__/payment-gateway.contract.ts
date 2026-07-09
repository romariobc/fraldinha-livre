import { describe, it, expect } from 'vitest'
import type { PaymentGateway, PaymentRequest } from '../payment'

/**
 * runPaymentGatewayContract - Reusable contract test suite for PaymentGateway implementations.
 *
 * Tests the invariants that ANY conformant implementation must satisfy:
 * - charge() returns a Promise
 * - status is one of: 'approved', 'declined', 'pending'
 * - transactionId is a non-empty string
 * - Invariant approved⟺paidAt: if status === 'approved' then paidAt is valid ISO 8601;
 *   if status !== 'approved' then paidAt is undefined
 */
export function runPaymentGatewayContract(
  name: string,
  makeGateway: () => PaymentGateway
): void {
  describe(`PaymentGateway (${name})`, () => {
    it('should return a Promise from charge()', async () => {
      const gateway = makeGateway()
      const request: PaymentRequest = {
        orderId: 'ord-123',
        amount: 10000, // 100.00 in cents
        method: 'card',
      }

      const result = gateway.charge(request)
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('should return status as one of approved, declined, or pending', async () => {
      const gateway = makeGateway()
      const request: PaymentRequest = {
        orderId: 'ord-456',
        amount: 5000,
        method: 'pix',
      }

      const result = await gateway.charge(request)
      expect(['approved', 'declined', 'pending']).toContain(result.status)
    })

    it('should return non-empty transactionId', async () => {
      const gateway = makeGateway()
      const request: PaymentRequest = {
        orderId: 'ord-789',
        amount: 15000,
        method: 'card',
      }

      const result = await gateway.charge(request)
      expect(result.transactionId).toBeDefined()
      expect(typeof result.transactionId).toBe('string')
      expect(result.transactionId.length).toBeGreaterThan(0)
    })

    it('should have approved⟹paidAt with valid ISO 8601 when status is approved', async () => {
      const gateway = makeGateway()
      const request: PaymentRequest = {
        orderId: 'ord-approved',
        amount: 20000,
        method: 'card',
      }

      const result = await gateway.charge(request)
      if (result.status === 'approved') {
        expect(result.paidAt).toBeDefined()
        expect(typeof result.paidAt).toBe('string')
        // Validate ISO 8601
        const date = new Date(result.paidAt!)
        expect(date.toString()).not.toBe('Invalid Date')
      }
    })

    it('should have paidAt undefined when status is not approved', async () => {
      const gateway = makeGateway()
      const request: PaymentRequest = {
        orderId: 'ord-not-approved',
        amount: 25000,
        method: 'card',
      }

      const result = await gateway.charge(request)
      if (result.status !== 'approved') {
        expect(result.paidAt).toBeUndefined()
      }
    })

    it('should maintain approved⟺paidAt invariant across multiple calls', async () => {
      const gateway = makeGateway()
      const requests: PaymentRequest[] = [
        { orderId: 'ord-1', amount: 10000, method: 'card' },
        { orderId: 'ord-2', amount: 20000, method: 'pix' },
        { orderId: 'ord-3', amount: 30000, method: 'card' },
      ]

      for (const request of requests) {
        const result = await gateway.charge(request)
        if (result.status === 'approved') {
          expect(result.paidAt).toBeDefined()
          const date = new Date(result.paidAt!)
          expect(date.toString()).not.toBe('Invalid Date')
        } else {
          expect(result.paidAt).toBeUndefined()
        }
      }
    })
  })
}
