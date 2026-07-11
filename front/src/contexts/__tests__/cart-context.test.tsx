/// <reference types="vitest/globals" />

import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { CartProvider, useCart } from '../cart-context'
import type { CartItem } from '@/lib/domain/cart'

// Helper to render hook inside CartProvider
function renderCartHook() {
  return renderHook(() => useCart(), {
    wrapper: ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>,
  })
}

// Mock items for testing
const mockItem1: CartItem = {
  productId: 'prod-1',
  productName: 'Product 1',
  supplierId: 'supplier-1',
  supplierName: 'Supplier 1',
  unitPrice: 1000, // R$ 10.00 in centavos
  quantity: 1,
  unit: 'un',
}

const mockItem2: CartItem = {
  productId: 'prod-2',
  productName: 'Product 2',
  supplierId: 'supplier-1',
  supplierName: 'Supplier 1',
  unitPrice: 2000, // R$ 20.00 in centavos
  quantity: 2,
  unit: 'un',
}

const mockItem3: CartItem = {
  productId: 'prod-1',
  productName: 'Product 1',
  supplierId: 'supplier-2',
  supplierName: 'Supplier 2',
  unitPrice: 1000,
  quantity: 1,
  unit: 'un',
}

describe('CartContext', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('addItem', () => {
    it('should add a new item to an empty cart', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0]).toEqual(mockItem1)
      expect(result.current.itemCount).toBe(1)
      expect(result.current.subtotal).toBe(1000)
    })

    it('should merge items with same productId and supplierId', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem({ ...mockItem1, quantity: 2 })
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].quantity).toBe(3) // 1 + 2
      expect(result.current.itemCount).toBe(3)
      expect(result.current.subtotal).toBe(3000) // 1000 * 3
    })

    it('should add separate items with same productId but different supplierId', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem3) // Same product, different supplier
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.itemCount).toBe(2)
      expect(result.current.subtotal).toBe(2000) // 1000 + 1000
    })

    it('should preserve existing item name and unitPrice when merging', () => {
      const { result } = renderCartHook()
      const originalName = mockItem1.productName
      const originalPrice = mockItem1.unitPrice

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem({
          ...mockItem1,
          quantity: 5,
          productName: 'Different Name',
          unitPrice: 9999,
        })
      })

      expect(result.current.items[0].productName).toBe(originalName)
      expect(result.current.items[0].unitPrice).toBe(originalPrice)
    })
  })

  describe('removeItem', () => {
    it('should remove an item from the cart', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem2)
      })

      expect(result.current.items).toHaveLength(2)

      act(() => {
        result.current.removeItem('prod-1', 'supplier-1')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].productId).toBe('prod-2')
    })

    it('should not remove items with different supplierId', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem3)
      })

      act(() => {
        result.current.removeItem('prod-1', 'supplier-1')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].supplierId).toBe('supplier-2')
    })
  })

  describe('updateQty', () => {
    it('should update quantity of an existing item', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      act(() => {
        result.current.updateQty('prod-1', 'supplier-1', 5)
      })

      expect(result.current.items[0].quantity).toBe(5)
      expect(result.current.itemCount).toBe(5)
      expect(result.current.subtotal).toBe(5000)
    })

    it('should remove item when quantity <= 0', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      act(() => {
        result.current.updateQty('prod-1', 'supplier-1', 0)
      })

      expect(result.current.items).toHaveLength(0)
      expect(result.current.itemCount).toBe(0)
      expect(result.current.subtotal).toBe(0)
    })

    it('should remove item when quantity is negative', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      act(() => {
        result.current.updateQty('prod-1', 'supplier-1', -5)
      })

      expect(result.current.items).toHaveLength(0)
    })

    it('should ignore non-integer quantities', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      act(() => {
        result.current.updateQty('prod-1', 'supplier-1', 3.5)
      })

      expect(result.current.items[0].quantity).toBe(1) // Unchanged
      expect(result.current.itemCount).toBe(1)
    })
  })

  describe('clear', () => {
    it('should empty the cart', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem2)
      })

      expect(result.current.items).toHaveLength(2)

      act(() => {
        result.current.clear()
      })

      expect(result.current.items).toHaveLength(0)
      expect(result.current.itemCount).toBe(0)
      expect(result.current.subtotal).toBe(0)
    })
  })

  describe('bySupplier', () => {
    it('should group items by supplierId', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem2)
        result.current.addItem(mockItem3)
      })

      expect(result.current.bySupplier.size).toBe(2)
      expect(result.current.bySupplier.get('supplier-1')).toHaveLength(2)
      expect(result.current.bySupplier.get('supplier-2')).toHaveLength(1)
    })

    it('should return empty map for empty cart', () => {
      const { result } = renderCartHook()

      expect(result.current.bySupplier.size).toBe(0)
    })
  })

  describe('Persistence and Hydration', () => {
    it('should persist items to localStorage', () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
        result.current.addItem(mockItem2)
      })

      const stored = window.localStorage.getItem('fl.cart.v1')
      expect(stored).toBeDefined()
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].productId).toBe('prod-1')
      expect(parsed[1].productId).toBe('prod-2')
    })

    it('should hydrate items from localStorage on mount', () => {
      // First hook: add items and persist
      const { result: result1 } = renderCartHook()

      act(() => {
        result1.current.addItem(mockItem1)
        result1.current.addItem(mockItem2)
      })

      // Second hook: should hydrate from localStorage
      const { result: result2 } = renderCartHook()

      // Give hydration effect time to run (not ideal, but renderHook doesn't wait)
      // In this test environment, the items should be available immediately after the effect runs
      expect(result2.current.items).toHaveLength(2)
      expect(result2.current.items[0].productId).toBe('prod-1')
      expect(result2.current.items[1].productId).toBe('prod-2')
    })

    it('should handle corrupted localStorage data gracefully', () => {
      window.localStorage.setItem('fl.cart.v1', 'invalid-json')

      const { result } = renderCartHook()

      // Should not throw and should start with empty cart
      expect(result.current.items).toHaveLength(0)
    })

    it('should persist updates to localStorage', async () => {
      const { result } = renderCartHook()

      act(() => {
        result.current.addItem(mockItem1)
      })

      let stored = window.localStorage.getItem('fl.cart.v1')
      let parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)

      act(() => {
        result.current.updateQty('prod-1', 'supplier-1', 5)
      })

      stored = window.localStorage.getItem('fl.cart.v1')
      parsed = JSON.parse(stored!)
      expect(parsed[0].quantity).toBe(5)

      act(() => {
        result.current.removeItem('prod-1', 'supplier-1')
      })

      stored = window.localStorage.getItem('fl.cart.v1')
      parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(0)
    })
  })

  describe('Error handling', () => {
    it('should throw error when useCart is used outside CartProvider', () => {
      // This test verifies the error by trying to render the hook without provider
      const { result } = renderHook(() => {
        try {
          return useCart()
        } catch (error) {
          return error as Error
        }
      })

      expect(result.current).toBeInstanceOf(Error)
      expect((result.current as Error).message).toContain('useCart deve ser usado dentro de CartProvider')
    })
  })
})
