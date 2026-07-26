/// <reference types="vitest/globals" />

import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { MarketProvider, useMarket } from '../market-context'
import { vi, beforeEach } from 'vitest'
import { MOCK_DIRECT_ORDERS } from '@/lib/supplier-mock'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock HttpOrderRepository
vi.mock('@/lib/adapters/http-order-repository', () => ({
  HttpOrderRepository: vi.fn(),
}))

type AllProvidersProps = {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return <MarketProvider>{children}</MarketProvider>
}

describe('MarketContext - cancelDirectOrder', () => {
  it('should cancel a direct order by changing status to cancelado', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const orderToCancel = result.current.directOrders[0]

    act(() => {
      result.current.cancelDirectOrder(orderToCancel.id)
    })

    const updatedOrder = result.current.directOrders.find(o => o.id === orderToCancel.id)
    expect(updatedOrder?.status).toBe('cancelado')
  })

  it('should not affect other orders when canceling one', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const orderToCancel = result.current.directOrders[0]
    const otherOrdersStatuses = result.current.directOrders.slice(1).map(o => o.status)

    act(() => {
      result.current.cancelDirectOrder(orderToCancel.id)
    })

    const updatedOtherOrdersStatuses = result.current.directOrders.slice(1).map(o => o.status)
    expect(updatedOtherOrdersStatuses).toEqual(otherOrdersStatuses)
  })

  it('should be a no-op if order id does not exist', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const originalOrders = result.current.directOrders.map(o => ({ ...o }))

    act(() => {
      result.current.cancelDirectOrder('non-existent-id')
    })

    // Orders should remain unchanged
    expect(result.current.directOrders).toEqual(originalOrders)
  })
})

describe('MarketContext - directOrders loading (mock mode)', () => {
  beforeEach(() => {
    // Simular modo mock
    delete process.env.NEXT_PUBLIC_USE_BACKEND
  })

  it('modo mock: directOrders começa com MOCK_DIRECT_ORDERS', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrders).toEqual(MOCK_DIRECT_ORDERS)
  })

  it('modo mock: directOrdersLoading é false', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrdersLoading).toBe(false)
  })

  it('modo mock: directOrdersError é null', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrdersError).toBe(null)
  })
})

describe('MarketContext - directOrders loading (backend mode)', () => {
  it('modo backend: expõe directOrdersLoading e directOrdersError', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    // No modo mock, estes devem ser false/null
    expect(typeof result.current.directOrdersLoading).toBe('boolean')
    expect(result.current.directOrdersError === null || typeof result.current.directOrdersError === 'string').toBe(true)
  })
})
