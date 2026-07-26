/// <reference types="vitest/globals" />

import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { MarketProvider, useMarket } from '../market-context'
import { vi, beforeEach, afterEach } from 'vitest'
import { MOCK_DIRECT_ORDERS } from '@/lib/supplier-mock'
import type { OrderRepository } from '@/lib/ports/order-repository'
import type { Order as ContractOrder } from '@contracts'

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

import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'

const mockedHttpOrderRepository = vi.mocked(HttpOrderRepository)

function makeFakeRepo(overrides: Partial<OrderRepository>): OrderRepository {
  return {
    list: vi.fn(),
    listForSupplier: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  }
}

const fakeContractOrder: ContractOrder = {
  id: 'ord-fake-1',
  uid: 'uid-comprador-fake',
  type: 'compra-direta',
  status: 'aguardando',
  product: 'Fralda Teste',
  quantity: 2,
  unit: 'un',
  price: 4000,
  supplierId: 'sup-a',
  supplierName: 'Fornecedor A',
  deliveryAddress: {
    logradouro: 'Rua A',
    numero: '1',
    bairro: 'Centro',
    cidade: 'Sao Paulo',
    estado: 'SP',
    cep: '01000-000',
  },
  createdAt: '2026-07-26T00:00:00.000Z',
  items: [
    { productId: 'p1', productName: 'Fralda Teste', unitPrice: 2000, quantity: 2, unit: 'un' },
  ],
}

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
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_BACKEND', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('modo backend: busca pedidos via listForSupplier e mapeia para DirectOrder', async () => {
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      () => makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(listForSupplierMock).toHaveBeenCalledOnce()
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-fake-1')
    expect(result.current.directOrders[0].product).toBe('Fralda Teste')
    expect(result.current.directOrdersError).toBeNull()
  })

  it('modo backend: erro no listForSupplier define directOrdersError e nao quebra', async () => {
    mockedHttpOrderRepository.mockImplementation(
      () =>
        makeFakeRepo({
          listForSupplier: vi.fn().mockRejectedValue(new Error('network fail')),
        }) as unknown as HttpOrderRepository
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(result.current.directOrdersError).toBe(
      'Não foi possível carregar os pedidos diretos. Tente novamente.'
    )
    expect(result.current.directOrders).toEqual([])
  })
})
