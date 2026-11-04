import { describe, expect, it } from 'vitest'
import { allowedOrderTargets, canManageOrder, orderOperationError } from '../order-actions'
describe('order actions by scope and status', () => {
  it('buyer only cancels while awaiting; supplier completes the cycle; admin only cancels before dispatch', () => {
    expect(allowedOrderTargets('aguardando','comprador')).toEqual(['cancelado'])
    expect(allowedOrderTargets('confirmado','comprador')).toEqual([])
    expect(allowedOrderTargets('aguardando','fornecedor')).toEqual(['confirmado','cancelado'])
    expect(allowedOrderTargets('confirmado','fornecedor')).toEqual(['a-caminho','cancelado'])
    expect(allowedOrderTargets('a-caminho','fornecedor')).toEqual(['entregue'])
    expect(allowedOrderTargets('confirmado','admin')).toEqual(['cancelado'])
    expect(allowedOrderTargets('a-caminho','admin')).toEqual([])
    for (const role of ['comprador','fornecedor','admin']) for (const status of ['entregue','cancelado']) expect(allowedOrderTargets(status,role)).toEqual([])
  })
  it('rejects a wrong role or explicit foreign owner and keeps legacy scoped snapshots compatible', () => {
    expect(canManageOrder({uid:'a'}, {uid:'b',role:'comprador'},'comprador')).toBe(false)
    expect(canManageOrder({supplierId:'a'}, {uid:'b',role:'fornecedor'},'fornecedor')).toBe(false)
    expect(canManageOrder({}, {uid:'a',role:'comprador'},'fornecedor')).toBe(false)
    expect(canManageOrder({}, null,'admin')).toBe(false)
    expect(canManageOrder({}, {uid:'a',role:'fornecedor'},'fornecedor')).toBe(true)
  })
  it('never exposes raw server error text to the customer', () => {
    expect(orderOperationError(new Error('SECRET internal stack')).message).not.toContain('SECRET')
  })
})
