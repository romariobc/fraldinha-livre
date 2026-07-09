import { describe, it, expect } from 'vitest'
import type { FulfillmentService, FulfillmentRequest } from '../fulfillment'
import type { Address } from '@/lib/account-mock'
import type { OrderItem } from '@/lib/domain/order'

/**
 * runFulfillmentServiceContract - Reusable contract test suite for FulfillmentService implementations.
 *
 * Tests the invariants that ANY conformant implementation must satisfy:
 * - schedule() returns a Promise
 * - status is one of: 'scheduled', 'rejected'
 * - Invariant scheduled⟺tracking: if status === 'scheduled' then trackingCode is non-empty string
 *   and estimatedDays is integer >= 0; if status === 'rejected' then both are undefined
 */
export function runFulfillmentServiceContract(
  name: string,
  makeService: () => FulfillmentService
): void {
  describe(`FulfillmentService (${name})`, () => {
    const testAddress: Address = {
      logradouro: 'Rua Teste',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01234-567',
    }

    const testItems: OrderItem[] = [
      {
        productId: 'prod-001',
        productName: 'Pampers Supersec M',
        unitPrice: 1000,
        quantity: 5,
        unit: 'un',
      },
    ]

    it('should return a Promise from schedule()', async () => {
      const service = makeService()
      const request: FulfillmentRequest = {
        orderId: 'ord-123',
        address: testAddress,
        items: testItems,
      }

      const result = service.schedule(request)
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('should return status as one of scheduled or rejected', async () => {
      const service = makeService()
      const request: FulfillmentRequest = {
        orderId: 'ord-456',
        address: testAddress,
        items: testItems,
      }

      const result = await service.schedule(request)
      expect(['scheduled', 'rejected']).toContain(result.status)
    })

    it('should have trackingCode as non-empty string when status is scheduled', async () => {
      const service = makeService()
      const request: FulfillmentRequest = {
        orderId: 'ord-scheduled',
        address: testAddress,
        items: testItems,
      }

      const result = await service.schedule(request)
      if (result.status === 'scheduled') {
        expect(result.trackingCode).toBeDefined()
        expect(typeof result.trackingCode).toBe('string')
        expect(result.trackingCode!.length).toBeGreaterThan(0)
      }
    })

    it('should have estimatedDays as non-negative integer when status is scheduled', async () => {
      const service = makeService()
      const request: FulfillmentRequest = {
        orderId: 'ord-scheduled-days',
        address: testAddress,
        items: testItems,
      }

      const result = await service.schedule(request)
      if (result.status === 'scheduled') {
        expect(result.estimatedDays).toBeDefined()
        expect(typeof result.estimatedDays).toBe('number')
        expect(Number.isInteger(result.estimatedDays)).toBe(true)
        expect(result.estimatedDays).toBeGreaterThanOrEqual(0)
      }
    })

    it('should have trackingCode and estimatedDays undefined when status is rejected', async () => {
      const service = makeService()
      const request: FulfillmentRequest = {
        orderId: 'ord-rejected',
        address: testAddress,
        items: testItems,
      }

      const result = await service.schedule(request)
      if (result.status === 'rejected') {
        expect(result.trackingCode).toBeUndefined()
        expect(result.estimatedDays).toBeUndefined()
      }
    })

    it('should maintain scheduled⟺tracking invariant across multiple calls', async () => {
      const service = makeService()
      const requests: FulfillmentRequest[] = [
        {
          orderId: 'ord-1',
          address: testAddress,
          items: testItems,
        },
        {
          orderId: 'ord-2',
          address: testAddress,
          items: testItems,
        },
        {
          orderId: 'ord-3',
          address: testAddress,
          items: testItems,
        },
      ]

      for (const request of requests) {
        const result = await service.schedule(request)
        if (result.status === 'scheduled') {
          expect(result.trackingCode).toBeDefined()
          expect(result.trackingCode!.length).toBeGreaterThan(0)
          expect(result.estimatedDays).toBeDefined()
          expect(Number.isInteger(result.estimatedDays)).toBe(true)
          expect(result.estimatedDays).toBeGreaterThanOrEqual(0)
        } else {
          expect(result.trackingCode).toBeUndefined()
          expect(result.estimatedDays).toBeUndefined()
        }
      }
    })
  })
}
