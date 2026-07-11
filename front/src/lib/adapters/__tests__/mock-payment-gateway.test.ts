import { describe, it, expect } from 'vitest'
import { MockPaymentGateway } from '../mock-payment-gateway'
import { runPaymentGatewayContract } from '@/lib/ports/__tests__/payment-gateway.contract'

describe('MockPaymentGateway', () => {
  // Contract tests: approved outcome
  runPaymentGatewayContract('approved outcome', () => {
    return new MockPaymentGateway({
      now: () => '2026-07-09T10:00:00Z',
      idFactory: () => 'tx-1',
      outcome: 'approved',
    })
  })

  // Contract tests: declined outcome
  runPaymentGatewayContract('declined outcome', () => {
    return new MockPaymentGateway({
      now: () => '2026-07-09T10:00:00Z',
      idFactory: () => 'tx-2',
      outcome: 'declined',
    })
  })

  // Contract tests: pending outcome
  runPaymentGatewayContract('pending outcome', () => {
    return new MockPaymentGateway({
      now: () => '2026-07-09T10:00:00Z',
      idFactory: () => 'tx-3',
      outcome: 'pending',
    })
  })

  describe('approved outcome specific behavior', () => {
    it('should use injected now() for paidAt', async () => {
      const now = '2026-07-09T15:30:45Z'
      const gateway = new MockPaymentGateway({
        now: () => now,
        idFactory: () => 'tx-approved',
        outcome: 'approved',
      })

      const result = await gateway.charge({
        orderId: 'ord-1',
        amount: 10000,
        method: 'card',
      })

      expect(result.status).toBe('approved')
      expect(result.paidAt).toBe(now)
    })

    it('should use injected idFactory for transactionId', async () => {
      const txId = 'custom-tx-id-12345'
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => txId,
        outcome: 'approved',
      })

      const result = await gateway.charge({
        orderId: 'ord-2',
        amount: 20000,
        method: 'pix',
      })

      expect(result.transactionId).toBe(txId)
    })

    it('should call idFactory on each charge for different transactions', async () => {
      let callCount = 0
      const ids = ['tx-a', 'tx-b', 'tx-c']
      const idFactory = () => ids[callCount++]

      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory,
        outcome: 'approved',
      })

      const result1 = await gateway.charge({
        orderId: 'ord-1',
        amount: 10000,
        method: 'card',
      })
      const result2 = await gateway.charge({
        orderId: 'ord-2',
        amount: 20000,
        method: 'card',
      })
      const result3 = await gateway.charge({
        orderId: 'ord-3',
        amount: 30000,
        method: 'card',
      })

      expect(result1.transactionId).toBe('tx-a')
      expect(result2.transactionId).toBe('tx-b')
      expect(result3.transactionId).toBe('tx-c')
      expect(callCount).toBe(3)
    })
  })

  describe('declined outcome specific behavior', () => {
    it('should not include paidAt when declined', async () => {
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => 'tx-declined',
        outcome: 'declined',
      })

      const result = await gateway.charge({
        orderId: 'ord-3',
        amount: 15000,
        method: 'card',
      })

      expect(result.status).toBe('declined')
      expect(result.paidAt).toBeUndefined()
    })

    it('should still provide transactionId when declined', async () => {
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => 'tx-declined-id',
        outcome: 'declined',
      })

      const result = await gateway.charge({
        orderId: 'ord-4',
        amount: 25000,
        method: 'card',
      })

      expect(result.transactionId).toBeDefined()
      expect(result.transactionId).toBe('tx-declined-id')
    })
  })

  describe('pending outcome specific behavior', () => {
    it('should not include paidAt when pending', async () => {
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => 'tx-pending',
        outcome: 'pending',
      })

      const result = await gateway.charge({
        orderId: 'ord-5',
        amount: 35000,
        method: 'pix',
      })

      expect(result.status).toBe('pending')
      expect(result.paidAt).toBeUndefined()
    })

    it('should provide transactionId when pending', async () => {
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => 'tx-pending-id',
        outcome: 'pending',
      })

      const result = await gateway.charge({
        orderId: 'ord-6',
        amount: 45000,
        method: 'pix',
      })

      expect(result.transactionId).toBeDefined()
      expect(result.transactionId).toBe('tx-pending-id')
    })
  })

  describe('default outcome behavior', () => {
    it('should default to approved when outcome is not specified', async () => {
      const gateway = new MockPaymentGateway({
        now: () => '2026-07-09T10:00:00Z',
        idFactory: () => 'tx-default',
      })

      const result = await gateway.charge({
        orderId: 'ord-7',
        amount: 55000,
        method: 'card',
      })

      expect(result.status).toBe('approved')
      expect(result.paidAt).toBeDefined()
    })
  })

  describe('determinism', () => {
    it('should be fully deterministic with same inputs', async () => {
      const now = '2026-07-09T12:00:00Z'
      let idCounter = 0
      const idFactory = () => `tx-${++idCounter}`

      const gateway1 = new MockPaymentGateway({
        now: () => now,
        idFactory,
        outcome: 'approved',
      })

      const request = {
        orderId: 'ord-det',
        amount: 10000,
        method: 'card' as const,
      }

      const result1 = await gateway1.charge(request)
      const result2 = await gateway1.charge(request)

      // Both calls should have different transaction IDs (idFactory increments)
      expect(result1.transactionId).toBe('tx-1')
      expect(result2.transactionId).toBe('tx-2')
      // But both should have the same paidAt from the injected now()
      expect(result1.paidAt).toBe(now)
      expect(result2.paidAt).toBe(now)
    })
  })
})
