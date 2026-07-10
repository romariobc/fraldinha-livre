/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { INITIAL_ORDERS } from '../account-mock'

describe('account-mock - INITIAL_ORDERS seed validation', () => {
  it('should have unitPrice * quantity === price for all orders with items and price', () => {
    INITIAL_ORDERS.forEach(order => {
      if (order.items && order.price !== undefined) {
        order.items.forEach(item => {
          const calculatedTotal = item.unitPrice * item.quantity
          expect(calculatedTotal).toBe(order.price)
        })
      }
    })
  })

  it('should have all unitPrice values as integers', () => {
    INITIAL_ORDERS.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          expect(Number.isInteger(item.unitPrice)).toBe(true)
        })
      }
    })
  })

  it('ord-003 should have unitPrice 6700 with quantity 2 and price 13400', () => {
    const ord003 = INITIAL_ORDERS.find(o => o.id === 'ord-003')
    expect(ord003).toBeDefined()
    expect(ord003?.price).toBe(13400)
    expect(ord003?.quantity).toBe(2)
    expect(ord003?.items).toHaveLength(1)
    expect(ord003?.items?.[0].unitPrice).toBe(6700)
    expect(ord003?.items?.[0].quantity).toBe(2)
  })

  it('ord-004 should have unitPrice 260 with quantity 40 and price 10400', () => {
    const ord004 = INITIAL_ORDERS.find(o => o.id === 'ord-004')
    expect(ord004).toBeDefined()
    expect(ord004?.price).toBe(10400)
    expect(ord004?.quantity).toBe(40)
    expect(ord004?.items).toHaveLength(1)
    expect(ord004?.items?.[0].unitPrice).toBe(260)
    expect(ord004?.items?.[0].quantity).toBe(40)
  })

  it('ord-005 should have unitPrice 300 with quantity 20 and price 6000', () => {
    const ord005 = INITIAL_ORDERS.find(o => o.id === 'ord-005')
    expect(ord005).toBeDefined()
    expect(ord005?.price).toBe(6000)
    expect(ord005?.quantity).toBe(20)
    expect(ord005?.items).toHaveLength(1)
    expect(ord005?.items?.[0].unitPrice).toBe(300)
    expect(ord005?.items?.[0].quantity).toBe(20)
  })
})
