import { describe, it, expect } from 'vitest'
import type { CartItem } from '../cart'
import { lineTotal, cartSubtotal, groupBySupplier } from '../cart'

describe('cart domain', () => {
  const sampleItem1: CartItem = {
    productId: 'prod-001',
    productName: 'Pampers Supersec M',
    supplierId: 'supp-001',
    supplierName: 'Distribuidora Sul',
    unitPrice: 1000, // R$ 10,00
    quantity: 5,
    unit: 'un',
  }

  const sampleItem2: CartItem = {
    productId: 'prod-002',
    productName: 'Huggies Supreme G',
    supplierId: 'supp-002',
    supplierName: 'Baby Stock SP',
    unitPrice: 2000, // R$ 20,00
    quantity: 3,
    unit: 'un',
  }

  const sampleItem3: CartItem = {
    productId: 'prod-003',
    productName: 'Turma da Mônica P',
    supplierId: 'supp-001', // same supplier as item1
    supplierName: 'Distribuidora Sul',
    unitPrice: 1500, // R$ 15,00
    quantity: 2,
    unit: 'cx',
  }

  describe('lineTotal', () => {
    it('should calculate line total correctly', () => {
      expect(lineTotal(sampleItem1)).toBe(5000) // 1000 * 5
    })

    it('should calculate for different quantities', () => {
      expect(lineTotal(sampleItem2)).toBe(6000) // 2000 * 3
    })

    it('should handle quantity 1', () => {
      const item: CartItem = { ...sampleItem1, quantity: 1 }
      expect(lineTotal(item)).toBe(1000)
    })

    it('should handle large quantities', () => {
      const item: CartItem = { ...sampleItem1, quantity: 100 }
      expect(lineTotal(item)).toBe(100000) // 1000 * 100
    })
  })

  describe('cartSubtotal', () => {
    it('should sum line totals of multiple items', () => {
      // item1: 1000 * 5 = 5000
      // item2: 2000 * 3 = 6000
      // total: 11000
      expect(cartSubtotal([sampleItem1, sampleItem2])).toBe(11000)
    })

    it('should return zero for empty cart', () => {
      expect(cartSubtotal([])).toBe(0)
    })

    it('should handle single item', () => {
      expect(cartSubtotal([sampleItem1])).toBe(5000)
    })

    it('should sum items from same supplier', () => {
      // item1: 1000 * 5 = 5000
      // item3: 1500 * 2 = 3000
      // total: 8000
      expect(cartSubtotal([sampleItem1, sampleItem3])).toBe(8000)
    })

    it('should sum three items with different suppliers', () => {
      // item1: 1000 * 5 = 5000
      // item2: 2000 * 3 = 6000
      // item3: 1500 * 2 = 3000
      // total: 14000
      expect(cartSubtotal([sampleItem1, sampleItem2, sampleItem3])).toBe(14000)
    })
  })

  describe('groupBySupplier', () => {
    it('should group single item into single group', () => {
      const result = groupBySupplier([sampleItem1])
      expect(result.size).toBe(1)
      expect(result.get('supp-001')).toEqual([sampleItem1])
    })

    it('should group items from same supplier together', () => {
      const result = groupBySupplier([sampleItem1, sampleItem3])
      expect(result.size).toBe(1)
      expect(result.get('supp-001')).toEqual([sampleItem1, sampleItem3])
      expect(result.get('supp-002')).toBeUndefined()
    })

    it('should separate items by different suppliers', () => {
      const result = groupBySupplier([sampleItem1, sampleItem2])
      expect(result.size).toBe(2)
      expect(result.get('supp-001')).toEqual([sampleItem1])
      expect(result.get('supp-002')).toEqual([sampleItem2])
    })

    it('should group mixed suppliers correctly', () => {
      const result = groupBySupplier([sampleItem1, sampleItem2, sampleItem3])
      expect(result.size).toBe(2)
      expect(result.get('supp-001')).toEqual([sampleItem1, sampleItem3])
      expect(result.get('supp-002')).toEqual([sampleItem2])
    })

    it('should return empty map for empty cart', () => {
      const result = groupBySupplier([])
      expect(result.size).toBe(0)
    })

    it('should preserve order of items within group', () => {
      const items = [sampleItem1, sampleItem3]
      const result = groupBySupplier(items)
      const group = result.get('supp-001')!
      expect(group[0]).toEqual(sampleItem1)
      expect(group[1]).toEqual(sampleItem3)
    })
  })
})
