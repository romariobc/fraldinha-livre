/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import SupplierDashboardOverviewPage from '../page'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: {
      displayName: 'Distribuidora São Paulo',
      email: 'contato@distribuidorasp.com.br',
    },
    role: 'fornecedor',
    loading: false,
  })),
}))

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
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: [
      { id: 'p1', name: 'Pampers Supersec G' },
      { id: 'p2', name: 'Babysec Premium G' },
    ],
    loading: false,
    error: null,
  })),
}))

describe('SupplierDashboardOverviewPage', () => {
  it('renders welcome banner with supplier name and verified status badge', () => {
    render(<SupplierDashboardOverviewPage />)

    expect(screen.getByText(/Olá, Distribuidora São Paulo!/i)).toBeInTheDocument()
    expect(screen.getByText(/Painel da Distribuidora B2B/i)).toBeInTheDocument()
    expect(screen.getByText(/Verificado/i)).toBeInTheDocument()
  })

  it('renders all 4 responsive metric cards', () => {
    render(<SupplierDashboardOverviewPage />)

    expect(screen.getByTestId('metric-card-receita')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-ticket')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-entregas')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-cancelados')).toBeInTheDocument()

    expect(screen.getByText('Receita Total')).toBeInTheDocument()
    expect(screen.getByText('Ticket Médio')).toBeInTheDocument()
    expect(screen.getByText('Entregas Concluídas')).toBeInTheDocument()
    expect(screen.getByText('Pedidos Cancelados')).toBeInTheDocument()
  })

  it('renders recent orders preview table with items and status', () => {
    render(<SupplierDashboardOverviewPage />)

    expect(screen.getByText('Pedidos Recentes')).toBeInTheDocument()
    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
    expect(screen.getByText('Pampers Supersec G')).toBeInTheDocument()
    expect(screen.getByText('R$ 312,00')).toBeInTheDocument()
    expect(screen.getByText('Aguardando')).toBeInTheDocument()

    expect(screen.getByText('#DIR-0025')).toBeInTheDocument()
    expect(screen.getByText('Babysec Premium G')).toBeInTheDocument()
    expect(screen.getByText('R$ 184,00')).toBeInTheDocument()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
  })

  it('renders operational action shortcuts linking to respective subroutes', () => {
    render(<SupplierDashboardOverviewPage />)

    expect(screen.getByText('Atalhos Rápidos')).toBeInTheDocument()

    const pedidosLinks = screen.getAllByRole('link', { name: /pedidos/i })
    expect(pedidosLinks.length).toBeGreaterThan(0)
    expect(pedidosLinks.some(l => l.getAttribute('href') === '/painel-fornecedor/pedidos')).toBe(true)

    const catalogoLinks = screen.getAllByRole('link', { name: /catálogo/i })
    expect(catalogoLinks.length).toBeGreaterThan(0)
    expect(catalogoLinks.some(l => l.getAttribute('href') === '/painel-fornecedor/catalogo')).toBe(true)

    const relatoriosLink = screen.getByRole('link', { name: /relatórios & desempenho/i })
    expect(relatoriosLink.getAttribute('href')).toBe('/painel-fornecedor/relatorios')

    const configLink = screen.getByRole('link', { name: /configurações da loja/i })
    expect(configLink.getAttribute('href')).toBe('/painel-fornecedor/configuracoes')
  })
})
