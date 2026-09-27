/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PedidosTab from '../PedidosTab'
import type { Order } from '@/lib/account-mock'

// Mock contexts
vi.mock('@/contexts/orders-context', () => ({
  useOrders: vi.fn(),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(),
}))

import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'

const mockUseOrders = vi.mocked(useOrders)
const mockUseMarket = vi.mocked(useMarket)

const mockActiveOrder: Order = {
  id: 'ped-001',
  date: '2026-03-20',
  createdAt: '2026-03-20T10:00:00Z',
  status: 'confirmado',
  total: 12000,
  product: 'Fralda Conforto M',
  items: [
    {
      productId: 'prod-1',
      name: 'Fralda Conforto M',
      brand: 'Pampers',
      size: 'M',
      quantity: 2,
      price: 6000,
    },
  ],
  deliveryAddress: {
    logradouro: 'Rua das Flores',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001-000',
  },
}

describe('PedidosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      supportCode: null,
      lastError: null,
      refetch: vi.fn(),
      cancelOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
    })
    mockUseMarket.mockReturnValue({
      quotes: [],
      directOrders: [],
      suppliers: [],
      metrics: {
        totalRevenue: 0,
        deliveredRevenue: 0,
        activeOrders: 0,
        deliveredOrders: 0,
        quoteRequests: 0,
        quoteResponseRate: 0,
        conversionRate: 0,
      },
      addDirectOrder: vi.fn(),
      updateDirectOrderStatus: vi.fn(),
      handleConfirmarPedido: vi.fn(),
      handleRecusarPedido: vi.fn(),
      handleAtualizarStatusDireto: vi.fn(),
      handleEnviarProposta: vi.fn(),
      handleRecusarCotacao: vi.fn(),
      handleSalvarPolitica: vi.fn(),
      handleAtualizarEstoque: vi.fn(),
      directOrdersLoading: false,
      directOrdersError: null,
      directOrdersSupportCode: null,
      refetchDirectOrders: vi.fn(),
    })
  })

  it('renders empty state with CTA to catalogo when there are no active orders', () => {
    render(<PedidosTab orders={[]} />)

    expect(screen.getByText('Nenhum pedido ativo')).toBeInTheDocument()
    expect(
      screen.getByText(/Explore o nosso catálogo e garanta as fraldas para o seu bebê/i)
    ).toBeInTheDocument()

    const catalogoCta = screen.getByRole('link', { name: /Explorar catálogo/i })
    expect(catalogoCta).toBeInTheDocument()
    expect(catalogoCta).toHaveAttribute('href', '/catalogo')
  })

  it('renders active order card when active orders exist', () => {
    render(<PedidosTab orders={[mockActiveOrder]} />)

    expect(screen.queryByText('Nenhum pedido ativo')).not.toBeInTheDocument()
    expect(screen.getByText('Fralda Conforto M')).toBeInTheDocument()
  })

  it('filters out delivered or cancelled orders as inactive', () => {
    const deliveredOrder: Order = {
      ...mockActiveOrder,
      id: 'ped-delivered',
      status: 'entregue',
    }

    render(<PedidosTab orders={[deliveredOrder]} />)

    expect(screen.getByText('Nenhum pedido ativo')).toBeInTheDocument()
  })
})
