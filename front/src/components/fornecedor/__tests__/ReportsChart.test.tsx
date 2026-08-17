/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ReportsChart, type ReportDataPoint } from '../ReportsChart'

// Mock Recharts ResponsiveContainer to render children reliably in JSDOM
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

const MOCK_REPORT_DATA: ReportDataPoint[] = [
  {
    date: '01/08',
    label: '01 de Agosto',
    deliveries: 12,
    cancellations: 1,
    successRate: 92.3,
    revenue: 462000,
    totalOrders: 13,
  },
  {
    date: '02/08',
    label: '02 de Agosto',
    deliveries: 15,
    cancellations: 0,
    successRate: 100,
    revenue: 577500,
    totalOrders: 15,
  },
  {
    date: '03/08',
    label: '03 de Agosto',
    deliveries: 18,
    cancellations: 2,
    successRate: 90.0,
    revenue: 693000,
    totalOrders: 20,
  },
  {
    date: '04/08',
    label: '04 de Agosto',
    deliveries: 20,
    cancellations: 1,
    successRate: 95.2,
    revenue: 770000,
    totalOrders: 21,
  },
]

describe('ReportsChart Component', () => {
  it('renders title, description and header summary pills accurately', () => {
    render(
      <ReportsChart
        data={MOCK_REPORT_DATA}
        title="Desempenho Semanal"
        description="Comparação de entregas e cancelamentos da semana"
      />
    )

    expect(screen.getByText('Desempenho Semanal')).toBeInTheDocument()
    expect(screen.getByText('Comparação de entregas e cancelamentos da semana')).toBeInTheDocument()

    // Totals: deliveries = 12 + 15 + 18 + 20 = 65
    // Cancellations = 1 + 0 + 2 + 1 = 4
    // Total = 69 -> Success rate = (65 / 69) * 100 = 94.2%
    expect(screen.getByText('65 Entregues')).toBeInTheDocument()
    expect(screen.getByText('4 Cancelados')).toBeInTheDocument()
    expect(screen.getByText('94.2% Sucesso')).toBeInTheDocument()
  })

  it('renders the chart container and responsive chart wrapper', () => {
    render(<ReportsChart data={MOCK_REPORT_DATA} />)

    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    expect(screen.getByTestId('recharts-responsive-container')).toBeInTheDocument()
  })

  it('allows toggling between metric views (Visão Geral, Entregas, Cancelamentos, Taxa)', () => {
    render(<ReportsChart data={MOCK_REPORT_DATA} />)

    const deliveriesBtn = screen.getByTestId('view-deliveries-btn')
    const cancellationsBtn = screen.getByTestId('view-cancellations-btn')
    const successRateBtn = screen.getByTestId('view-success-rate-btn')
    const allBtn = screen.getByTestId('view-all-btn')

    fireEvent.click(deliveriesBtn)
    expect(deliveriesBtn).toHaveClass('font-semibold')

    fireEvent.click(cancellationsBtn)
    expect(cancellationsBtn).toHaveClass('font-semibold')

    fireEvent.click(successRateBtn)
    expect(successRateBtn).toHaveClass('font-semibold')

    fireEvent.click(allBtn)
    expect(allBtn).toHaveClass('font-semibold')
  })

  it('allows toggling between chart types (Composto, Barras, Área)', () => {
    render(<ReportsChart data={MOCK_REPORT_DATA} />)

    const barTypeBtn = screen.getByTestId('chart-type-bar')
    const areaTypeBtn = screen.getByTestId('chart-type-area')
    const composedTypeBtn = screen.getByTestId('chart-type-composed')

    fireEvent.click(barTypeBtn)
    fireEvent.click(areaTypeBtn)
    fireEvent.click(composedTypeBtn)

    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
  })

  it('renders loading placeholder state when loading is true', () => {
    render(<ReportsChart data={[]} loading={true} />)

    expect(screen.getByText('Carregando dados analíticos...')).toBeInTheDocument()
  })

  it('renders empty state when data array is empty', () => {
    render(<ReportsChart data={[]} loading={false} />)

    expect(screen.getByText('Nenhum dado no período selecionado')).toBeInTheDocument()
    expect(
      screen.getByText(/Ajuste o filtro de datas acima para visualizar/i)
    ).toBeInTheDocument()
  })
})
