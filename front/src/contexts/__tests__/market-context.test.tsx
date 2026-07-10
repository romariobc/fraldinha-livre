/// <reference types="vitest/globals" />

import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { MarketProvider, useMarket } from '../market-context'
import { vi } from 'vitest'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
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
