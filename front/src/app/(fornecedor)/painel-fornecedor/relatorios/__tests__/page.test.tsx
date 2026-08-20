/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RelatoriosPage from '../page'

// Mock Recharts
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  }
})

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { toast } from 'sonner'

// Mock Market Context
vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: [
      {
        id: 'DIR-200',
        product: 'Pampers Supersec G',
        quantity: 20,
        unit: 'un',
        price: 35000,
        buyerCity: 'São Paulo',
        buyerState: 'SP',
        createdAt: '2026-08-15T10:00:00Z',
        status: 'confirmado',
      },
      {
        id: 'DIR-201',
        product: 'Huggies Tripla Proteção M',
        quantity: 10,
        unit: 'un',
        price: 18000,
        buyerCity: 'Campinas',
        buyerState: 'SP',
        createdAt: '2026-08-14T14:00:00Z',
        status: 'confirmado',
      },
      {
        id: 'DIR-202',
        product: 'Cremer Disney P',
        quantity: 5,
        unit: 'cx',
        price: 12000,
        buyerCity: 'Santos',
        buyerState: 'SP',
        createdAt: '2026-08-12T09:00:00Z',
        status: 'cancelado',
      },
    ],
    directOrdersLoading: false,
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

// Mock Auth Context
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'sup-1', email: 'fornecedor@teste.com', displayName: 'Distribuidora Alpha' },
    role: 'fornecedor',
  })),
}))

// Mock Products Context
vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: [],
  })),
}))

describe('RelatoriosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header, title, and subtitle correctly', () => {
    render(<RelatoriosPage />)

    expect(screen.getByText('Relatórios de Desempenho')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Análise operacional de entregas, cancelamentos, taxas de sucesso e faturamento/i
      )
    ).toBeInTheDocument()
  })

  it('renders all 4 primary KPI metric cards', () => {
    render(<RelatoriosPage />)

    expect(screen.getByTestId('metric-card-total-deliveries')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-total-cancellations')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-success-rate')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-revenue')).toBeInTheDocument()

    expect(screen.getByText('Total Entregas')).toBeInTheDocument()
    expect(screen.getByText('Total Cancelamentos')).toBeInTheDocument()
    expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument()
    expect(screen.getByText('Receita no Período')).toBeInTheDocument()
  })

  it('renders the main comparative chart component', () => {
    render(<RelatoriosPage />)

    expect(screen.getByTestId('main-reports-chart')).toBeInTheDocument()
    expect(
      screen.getByText('Comparativo: Entregas Concluídas vs Cancelamentos')
    ).toBeInTheDocument()
  })

  it('renders all 3 operational breakdown sections (Status, Categories, Cancellations)', () => {
    render(<RelatoriosPage />)

    expect(screen.getByTestId('breakdown-sections')).toBeInTheDocument()
    expect(screen.getByText('Distribuição por Status')).toBeInTheDocument()
    expect(screen.getByText('Desempenho por Categoria')).toBeInTheDocument()
    expect(screen.getByText('Motivos de Cancelamento')).toBeInTheDocument()

    // Check category items
    expect(screen.getByText(/Fraldas Infantis/i)).toBeInTheDocument()
    expect(screen.getByText(/Lenços Umedecidos & Toalhas/i)).toBeInTheDocument()

    // Check operational tip
    expect(screen.getByText(/Dica Operacional Fraldinha Livre:/i)).toBeInTheDocument()
  })

  it('handles CSV export button click and downloads report', () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectURLMock = vi.fn(() => 'blob:http://localhost/mock-csv')
    const revokeObjectURLMock = vi.fn()
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    render(<RelatoriosPage />)

    const exportBtn = screen.getByTestId('export-csv-btn')
    fireEvent.click(exportBtn)

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Relatório CSV exportado com sucesso!')
  })

  it('handles Print summary button click', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(<RelatoriosPage />)

    const printBtn = screen.getByTestId('print-report-btn')
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })

  it('integrates with DatePickerWithRange component', () => {
    render(<RelatoriosPage />)

    expect(screen.getByTestId('reports-date-filter')).toBeInTheDocument()
    expect(screen.getByTestId('date-range-picker-trigger')).toBeInTheDocument()
  })
})
