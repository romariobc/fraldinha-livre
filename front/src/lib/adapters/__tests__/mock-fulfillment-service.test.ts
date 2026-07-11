import { describe, it, expect } from 'vitest'
import { MockFulfillmentService } from '../mock-fulfillment-service'
import { runFulfillmentServiceContract } from '@/lib/ports/__tests__/fulfillment-service.contract'
import type { Address } from '@/lib/account-mock'
import type { OrderItem } from '@/lib/domain/order'

describe('MockFulfillmentService', () => {
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

  // Contract tests: scheduled outcome
  runFulfillmentServiceContract('scheduled outcome', () => {
    return new MockFulfillmentService({
      idFactory: () => 'tracking-1',
      outcome: 'scheduled',
      estimatedDays: 3,
    })
  })

  // Contract tests: rejected outcome
  runFulfillmentServiceContract('rejected outcome', () => {
    return new MockFulfillmentService({
      idFactory: () => 'tracking-2',
      outcome: 'rejected',
    })
  })

  describe('scheduled outcome specific behavior', () => {
    it('should use injected idFactory for trackingCode', async () => {
      const trackingCode = 'BR-2026-07-09-12345'
      const service = new MockFulfillmentService({
        idFactory: () => trackingCode,
        outcome: 'scheduled',
        estimatedDays: 3,
      })

      const result = await service.schedule({
        orderId: 'ord-1',
        address: testAddress,
        items: testItems,
      })

      expect(result.status).toBe('scheduled')
      expect(result.trackingCode).toBe(trackingCode)
    })

    it('should use injected estimatedDays', async () => {
      const estimatedDays = 5
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-code',
        outcome: 'scheduled',
        estimatedDays,
      })

      const result = await service.schedule({
        orderId: 'ord-2',
        address: testAddress,
        items: testItems,
      })

      expect(result.status).toBe('scheduled')
      expect(result.estimatedDays).toBe(estimatedDays)
    })

    it('should call idFactory on each schedule for different tracking codes', async () => {
      let callCount = 0
      const codes = ['track-a', 'track-b', 'track-c']
      const idFactory = () => codes[callCount++]

      const service = new MockFulfillmentService({
        idFactory,
        outcome: 'scheduled',
        estimatedDays: 3,
      })

      const result1 = await service.schedule({
        orderId: 'ord-1',
        address: testAddress,
        items: testItems,
      })
      const result2 = await service.schedule({
        orderId: 'ord-2',
        address: testAddress,
        items: testItems,
      })
      const result3 = await service.schedule({
        orderId: 'ord-3',
        address: testAddress,
        items: testItems,
      })

      expect(result1.trackingCode).toBe('track-a')
      expect(result2.trackingCode).toBe('track-b')
      expect(result3.trackingCode).toBe('track-c')
      expect(callCount).toBe(3)
    })

    it('should have same estimatedDays across multiple calls', async () => {
      const estimatedDays = 7
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-code',
        outcome: 'scheduled',
        estimatedDays,
      })

      const result1 = await service.schedule({
        orderId: 'ord-1',
        address: testAddress,
        items: testItems,
      })
      const result2 = await service.schedule({
        orderId: 'ord-2',
        address: testAddress,
        items: testItems,
      })

      expect(result1.estimatedDays).toBe(estimatedDays)
      expect(result2.estimatedDays).toBe(estimatedDays)
    })
  })

  describe('rejected outcome specific behavior', () => {
    it('should not include trackingCode when rejected', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-rejected',
        outcome: 'rejected',
      })

      const result = await service.schedule({
        orderId: 'ord-3',
        address: testAddress,
        items: testItems,
      })

      expect(result.status).toBe('rejected')
      expect(result.trackingCode).toBeUndefined()
    })

    it('should not include estimatedDays when rejected', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-rejected',
        outcome: 'rejected',
      })

      const result = await service.schedule({
        orderId: 'ord-4',
        address: testAddress,
        items: testItems,
      })

      expect(result.status).toBe('rejected')
      expect(result.estimatedDays).toBeUndefined()
    })
  })

  describe('default outcome behavior', () => {
    it('should default to scheduled when outcome is not specified', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-default',
      })

      const result = await service.schedule({
        orderId: 'ord-5',
        address: testAddress,
        items: testItems,
      })

      expect(result.status).toBe('scheduled')
      expect(result.trackingCode).toBeDefined()
      expect(result.estimatedDays).toBeDefined()
    })

    it('should default estimatedDays to 3', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-default-days',
      })

      const result = await service.schedule({
        orderId: 'ord-6',
        address: testAddress,
        items: testItems,
      })

      expect(result.estimatedDays).toBe(3)
    })
  })

  describe('determinism', () => {
    it('should be fully deterministic with same inputs', async () => {
      let idCounter = 0
      const idFactory = () => `tracking-${++idCounter}`

      const service = new MockFulfillmentService({
        idFactory,
        outcome: 'scheduled',
        estimatedDays: 4,
      })

      const request = {
        orderId: 'ord-det',
        address: testAddress,
        items: testItems,
      }

      const result1 = await service.schedule(request)
      const result2 = await service.schedule(request)

      // Both calls should have different tracking codes (idFactory increments)
      expect(result1.trackingCode).toBe('tracking-1')
      expect(result2.trackingCode).toBe('tracking-2')
      // But both should have the same estimatedDays
      expect(result1.estimatedDays).toBe(4)
      expect(result2.estimatedDays).toBe(4)
    })
  })

  describe('address handling', () => {
    it('should accept different addresses in requests', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-address',
        outcome: 'scheduled',
      })

      const address2: Address = {
        logradouro: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01311-200',
      }

      const result1 = await service.schedule({
        orderId: 'ord-addr1',
        address: testAddress,
        items: testItems,
      })

      const result2 = await service.schedule({
        orderId: 'ord-addr2',
        address: address2,
        items: testItems,
      })

      expect(result1.status).toBe('scheduled')
      expect(result2.status).toBe('scheduled')
    })
  })

  describe('items handling', () => {
    it('should accept different items in requests', async () => {
      const service = new MockFulfillmentService({
        idFactory: () => 'tracking-items',
        outcome: 'scheduled',
      })

      const items2: OrderItem[] = [
        {
          productId: 'prod-002',
          productName: 'Huggies Supreme G',
          unitPrice: 2000,
          quantity: 3,
          unit: 'un',
        },
        {
          productId: 'prod-003',
          productName: 'Turma da Mônica P',
          unitPrice: 1500,
          quantity: 2,
          unit: 'cx',
        },
      ]

      const result1 = await service.schedule({
        orderId: 'ord-items1',
        address: testAddress,
        items: testItems,
      })

      const result2 = await service.schedule({
        orderId: 'ord-items2',
        address: testAddress,
        items: items2,
      })

      expect(result1.status).toBe('scheduled')
      expect(result2.status).toBe('scheduled')
    })
  })
})
