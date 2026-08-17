/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import PedidosPage from '../page'

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: [
      {
        id: 'DIR-0031',
        product: 'Pampers Supersec G',
        quantity: 48,
        unit: 'un',
        price: 31200,
        buyerCity: 'São Paulo',
        buyerState: 'SP',
        createdAt: '2026-08-15T10:00:00Z',
        status: 'aguardando',
      },
      {
        id: 'DIR-0025',
        product: 'Babysec Premium G',
        quantity: 24,
        unit: 'un',
        price: 18400,
        buyerCity: 'Campinas',
        buyerState: 'SP',
        createdAt: '2026-08-14T09:00:00Z',
        status: 'confirmado',
      },
    ],
    directOrdersLoading: false,
    handleConfirmarDireto: vi.fn(),
    handleRecusarDireto: vi.fn(),
  })),
}))

describe('PedidosPage (/painel-fornecedor/pedidos)', () => {
  it('renders page header and metric summaries', () => {
    render(<PedidosPage />)

    expect(screen.getByRole('heading', { name: /Gestão de Pedidos/i })).toBeInTheDocument()
    expect(screen.getByText('Aguardando Confirmação')).toBeInTheDocument()
    expect(screen.getByText('Confirmados / Em Rota')).toBeInTheDocument()
    expect(screen.getByText('Receita Bruta em Pedidos')).toBeInTheDocument()
    expect(screen.getByText('R$ 496,00')).toBeInTheDocument()
  })

  it('renders orders data table with orders list', () => {
    render(<PedidosPage />)

    expect(screen.getByText('Histórico de Pedidos Recebidos')).toBeInTheDocument()
    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
    expect(screen.getByText('#DIR-0025')).toBeInTheDocument()
    expect(screen.getByText('Pampers Supersec G')).toBeInTheDocument()
    expect(screen.getByText('Babysec Premium G')).toBeInTheDocument()
  })
})
