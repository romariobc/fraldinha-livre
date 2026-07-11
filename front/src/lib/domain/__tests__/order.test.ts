import { describe, it, expect } from 'vitest'
import type { Address } from '@/lib/account-mock'
import type { CartItem } from '../cart'
import { buildOrdersFromCart } from '../order'

describe('order domain', () => {
  const testAddress: Address = {
    logradouro: 'Rua Teste',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01234-567',
  }

  const sampleItem1: CartItem = {
    productId: 'prod-001',
    productName: 'Pampers Supersec M',
    supplierId: 'supp-001',
    supplierName: 'Distribuidora Sul',
    unitPrice: 1000,
    quantity: 5,
    unit: 'un',
  }

  const sampleItem2: CartItem = {
    productId: 'prod-002',
    productName: 'Huggies Supreme G',
    supplierId: 'supp-002',
    supplierName: 'Baby Stock SP',
    unitPrice: 2000,
    quantity: 3,
    unit: 'un',
  }

  const sampleItem3: CartItem = {
    productId: 'prod-003',
    productName: 'Turma da Mônica P',
    supplierId: 'supp-001',
    supplierName: 'Distribuidora Sul',
    unitPrice: 1500,
    quantity: 2,
    unit: 'cx',
  }

  describe('buildOrdersFromCart', () => {
    it('should create one order from single supplier cart', () => {
      let idCounter = 0
      const idFactory = () => `order-${++idCounter}`
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart([sampleItem1], testAddress, idFactory, now)

      expect(orders).toHaveLength(1)
      expect(orders[0]).toMatchObject({
        id: 'order-1',
        supplierId: 'supp-001',
        supplierName: 'Distribuidora Sul',
        total: 5000, // 1000 * 5
        createdAt: now,
      })
      expect(orders[0].items).toHaveLength(1)
      expect(orders[0].items[0]).toMatchObject({
        productId: 'prod-001',
        productName: 'Pampers Supersec M',
        unitPrice: 1000,
        quantity: 5,
        unit: 'un',
      })
      expect(orders[0].deliveryAddress).toEqual(testAddress)
    })

    it('should create two orders from two supplier cart', () => {
      let idCounter = 0
      const idFactory = () => `order-${++idCounter}`
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart(
        [sampleItem1, sampleItem2],
        testAddress,
        idFactory,
        now
      )

      expect(orders).toHaveLength(2)

      // First order (supp-001)
      expect(orders[0]).toMatchObject({
        id: 'order-1',
        supplierId: 'supp-001',
        supplierName: 'Distribuidora Sul',
        total: 5000, // item1: 1000 * 5
      })
      expect(orders[0].items).toHaveLength(1)

      // Second order (supp-002)
      expect(orders[1]).toMatchObject({
        id: 'order-2',
        supplierId: 'supp-002',
        supplierName: 'Baby Stock SP',
        total: 6000, // item2: 2000 * 3
      })
      expect(orders[1].items).toHaveLength(1)
    })

    it('should group items from same supplier into single order', () => {
      let idCounter = 0
      const idFactory = () => `order-${++idCounter}`
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart(
        [sampleItem1, sampleItem3],
        testAddress,
        idFactory,
        now
      )

      expect(orders).toHaveLength(1)
      expect(orders[0]).toMatchObject({
        id: 'order-1',
        supplierId: 'supp-001',
        supplierName: 'Distribuidora Sul',
        total: 8000, // item1: 5000 + item3: 3000
      })
      expect(orders[0].items).toHaveLength(2)
      expect(orders[0].items[0]).toMatchObject({
        productId: 'prod-001',
      })
      expect(orders[0].items[1]).toMatchObject({
        productId: 'prod-003',
      })
    })

    it('should handle cart with mixed suppliers', () => {
      let idCounter = 0
      const idFactory = () => `order-${++idCounter}`
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart(
        [sampleItem1, sampleItem2, sampleItem3],
        testAddress,
        idFactory,
        now
      )

      expect(orders).toHaveLength(2)

      // First order (supp-001): items 1 and 3
      expect(orders[0].supplierId).toBe('supp-001')
      expect(orders[0].items).toHaveLength(2)
      expect(orders[0].total).toBe(8000) // 5000 + 3000

      // Second order (supp-002): item 2
      expect(orders[1].supplierId).toBe('supp-002')
      expect(orders[1].items).toHaveLength(1)
      expect(orders[1].total).toBe(6000)
    })

    it('should return empty array for empty cart', () => {
      const idFactory = () => 'order-id'
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart([], testAddress, idFactory, now)

      expect(orders).toHaveLength(0)
      expect(orders).toEqual([])
    })

    it('should use injected idFactory for determinism', () => {
      const ids = ['id-a', 'id-b', 'id-c']
      let callCount = 0
      const idFactory = () => ids[callCount++]
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart(
        [sampleItem1, sampleItem2, sampleItem3],
        testAddress,
        idFactory,
        now
      )

      expect(orders[0].id).toBe('id-a')
      expect(orders[1].id).toBe('id-b')
      expect(callCount).toBe(2)
    })

    it('should use injected now for createdAt', () => {
      const idFactory = () => 'order-1'
      const customNow = '2025-12-31T23:59:59Z'

      const orders = buildOrdersFromCart(
        [sampleItem1],
        testAddress,
        idFactory,
        customNow
      )

      expect(orders[0].createdAt).toBe(customNow)
    })

    it('should set correct delivery address on all orders', () => {
      const customAddress: Address = {
        logradouro: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01311-200',
      }

      const idFactory = () => 'order-id'
      const now = '2026-07-09T10:00:00Z'

      const orders = buildOrdersFromCart(
        [sampleItem1, sampleItem2],
        customAddress,
        idFactory,
        now
      )

      expect(orders[0].deliveryAddress).toEqual(customAddress)
      expect(orders[1].deliveryAddress).toEqual(customAddress)
    })
  })
})
