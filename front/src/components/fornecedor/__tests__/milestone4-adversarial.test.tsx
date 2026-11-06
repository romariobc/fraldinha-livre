/// <reference types="vitest/globals" />

import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { ReportsChart, type ReportDataPoint } from '../ReportsChart'
import {
  DatePickerWithRange,
  formatDateRangeLabel,
} from '../DatePickerWithRange'
import RelatoriosPage from '@/app/(fornecedor)/painel-fornecedor/relatorios/page'
import {
  filterOrdersByDateRange,
  generateReportTimeSeries,
  useSupplierReports,
} from '@/hooks/use-supplier-data'
import type { DirectOrder } from '@/lib/domain/supplier'

// Mock Recharts ResponsiveContainer to render children reliably in JSDOM
vi.mock('@/lib/compat/recharts', async () => {
  const original = await vi.importActual<typeof import('@/lib/compat/recharts')>('@/lib/compat/recharts')
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

import { apiFetch } from '@/lib/api-client'
vi.mock('@/lib/api-client',()=>({apiFetch:vi.fn()}))

const ADVERSARIAL_ORDERS: DirectOrder[] = [
  {
    id: 'DIR-ADV-01',
    product: 'Fralda Pampers Confort Sec G',
    quantity: 15,
    unit: 'un',
    price: 32000,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: '2026-08-15T18:30:00Z',
    status: 'confirmado',
  },
  {
    id: 'DIR-ADV-02',
    product: 'Huggies Supreme Care M',
    quantity: 8,
    unit: 'un',
    price: 16000,
    buyerCity: 'Guarulhos',
    buyerState: 'SP',
    createdAt: '2026-08-14T09:15:00Z',
    status: 'confirmado',
  },
  {
    id: 'DIR-ADV-03',
    product: 'Pomada Desitin Azul',
    quantity: 20,
    unit: 'un',
    price: 24000,
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: '2026-08-12T11:45:00Z',
    status: 'cancelado',
  },
  {
    id: 'DIR-ADV-04',
    product: 'Toalhinhas Umedecidas Johnson',
    quantity: 50,
    unit: 'un',
    price: 45000,
    buyerCity: 'Santos',
    buyerState: 'SP',
    createdAt: '2026-08-01T07:00:00Z',
    status: 'aguardando',
  },
  {
    id: 'DIR-ADV-05',
    product: 'Fralda Cremer Disney P',
    quantity: 5,
    unit: 'un',
    price: 8000,
    buyerCity: 'São José dos Campos',
    buyerState: 'SP',
    createdAt: '2026-06-15T14:00:00Z', // Out of range for 30d
    status: 'confirmado',
  },
]

// Mock Market Context
vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: ADVERSARIAL_ORDERS,
    directOrdersLoading: false,
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

// Mock Auth Context
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'sup-adv-1', email: 'fornecedor-adv@teste.com', displayName: 'Distribuidora Beta' },
    role: 'fornecedor',
  })),
}))

// Mock Products Context
vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: [],
  })),
}))

describe('Milestone 4 Adversarial & Behavioral Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ReportsChart Adversarial & Edge Cases', () => {
    it('handles zero deliveries and zero cancellations gracefully without NaN', () => {
      const zeroData: ReportDataPoint[] = [
        {
          date: '01/08',
          deliveries: 0,
          cancellations: 0,
        },
      ]

      render(<ReportsChart data={zeroData} />)

      expect(screen.getByText('0 Entregues')).toBeInTheDocument()
      expect(screen.getByText('0 Cancelados')).toBeInTheDocument()
      expect(screen.getByText('100% Sucesso')).toBeInTheDocument()
    })

    it('handles empty data array by rendering empty state prompt', () => {
      render(<ReportsChart data={[]} />)

      expect(screen.getByText('Nenhum dado no período selecionado')).toBeInTheDocument()
    })

    it('handles loading state with skeleton placeholder', () => {
      render(<ReportsChart data={[]} loading={true} />)

      expect(screen.getByText('Carregando dados analíticos...')).toBeInTheDocument()
    })

    it('supports switching across all 4 metric views', () => {
      const sampleData: ReportDataPoint[] = [
        { date: '10/08', deliveries: 10, cancellations: 2, successRate: 83.3 },
        { date: '11/08', deliveries: 15, cancellations: 0, successRate: 100 },
      ]

      render(<ReportsChart data={sampleData} />)

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

    it('supports switching across all chart type toggles (composed, bar, area)', () => {
      const sampleData: ReportDataPoint[] = [
        { date: '10/08', deliveries: 10, cancellations: 2 },
      ]

      render(<ReportsChart data={sampleData} />)

      const barBtn = screen.getByTestId('chart-type-bar')
      const areaBtn = screen.getByTestId('chart-type-area')
      const composedBtn = screen.getByTestId('chart-type-composed')

      fireEvent.click(barBtn)
      fireEvent.click(areaBtn)
      fireEvent.click(composedBtn)

      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })
  })

  describe('DatePickerWithRange Adversarial & Presets', () => {
    it('opens popover when trigger button is clicked', () => {
      render(<DatePickerWithRange date={undefined} onDateChange={vi.fn()} />)

      const trigger = screen.getByTestId('date-range-picker-trigger')
      fireEvent.click(trigger)

      expect(screen.getByTestId('date-range-popover-content')).toBeInTheDocument()
      expect(screen.getByText('Atalhos')).toBeInTheDocument()
    })

    it('applies quick presets correctly when clicked', () => {
      const onDateChange = vi.fn()
      render(<DatePickerWithRange date={undefined} onDateChange={onDateChange} />)

      // Open popover
      fireEvent.click(screen.getByTestId('date-range-picker-trigger'))

      // Click "Últimos 7 dias"
      const preset7d = screen.getByTestId('preset-7d')
      fireEvent.click(preset7d)
      expect(onDateChange).toHaveBeenCalled()

      const lastArg7d = onDateChange.mock.calls[0][0]
      expect(lastArg7d.from).toBeInstanceOf(Date)
      expect(lastArg7d.to).toBeInstanceOf(Date)

      // Click "Últimos 30 dias"
      fireEvent.click(screen.getByTestId('date-range-picker-trigger'))
      const preset30d = screen.getByTestId('preset-30d')
      fireEvent.click(preset30d)
      expect(onDateChange).toHaveBeenCalledTimes(2)

      // Click "Últimos 90 dias"
      fireEvent.click(screen.getByTestId('date-range-picker-trigger'))
      const preset90d = screen.getByTestId('preset-90d')
      fireEvent.click(preset90d)
      expect(onDateChange).toHaveBeenCalledTimes(3)
    })

    it('clears selected date range via clear button', () => {
      const onDateChange = vi.fn()
      const initialRange = {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 15),
      }

      render(<DatePickerWithRange date={initialRange} onDateChange={onDateChange} />)

      const clearBtn = screen.getByTestId('clear-date-range-btn')
      fireEvent.click(clearBtn)

      expect(onDateChange).toHaveBeenCalledWith(undefined)
    })

    it('clears selected date range via keyboard interaction (Enter / Space)', () => {
      const onDateChange = vi.fn()
      const initialRange = {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 15),
      }

      render(<DatePickerWithRange date={initialRange} onDateChange={onDateChange} />)

      const clearBtn = screen.getByTestId('clear-date-range-btn')
      fireEvent.keyDown(clearBtn, { key: 'Enter' })
      expect(onDateChange).toHaveBeenCalledWith(undefined)

      fireEvent.keyDown(clearBtn, { key: ' ' })
      expect(onDateChange).toHaveBeenCalledTimes(2)
    })

    it('formats single bound and full date ranges accurately', () => {
      expect(formatDateRangeLabel(undefined)).toBe('Selecione o período')

      const single = { from: new Date(2026, 7, 1) }
      expect(formatDateRangeLabel(single)).toBe('01/08/2026 - Hoje')

      const full = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 15) }
      expect(formatDateRangeLabel(full)).toBe('01/08/2026 - 15/08/2026')
    })
  })

  describe('Persisted reporting integration', () => {
    const empty = { timezone:'America/Fortaleza', currency:'BRL', snapshotAt:'2026-11-06T12:00:00.000Z', filters:{from:'2026-11-01',to:'2026-11-06',q:'',status:null,supplierId:'sup-1'}, rows:[], summary:{total:0,delivered:0,cancelled:0,simulatedValueCents:0,legacyValueCents:0,financialReceivedCents:null,unknownPriceCount:0,invalidDateCount:0},daily:[] }
    it('shows observed empty state and explicitly unapplied financial receipts', async () => {
      vi.mocked(apiFetch).mockResolvedValue({json:async()=>empty} as Response)
      render(<RelatoriosPage />)
      expect(await screen.findByText('Nenhum pedido para os filtros aplicados.')).toBeInTheDocument()
      expect(screen.getByText('Não apurado — sem cobrança real')).toBeInTheDocument()
    })
    it('blocks export while no persisted snapshot is available', async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error('offline'))
      render(<RelatoriosPage />)
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar')
      expect(screen.getByRole('button',{name:'Exportar consulta CSV'})).toBeDisabled()
    })
    it('handles CSV generation failure without claiming success', async () => {
      vi.mocked(apiFetch).mockResolvedValue({json:async()=>empty} as Response)
      window.URL.createObjectURL=vi.fn(()=>{throw new Error('Blob creation failed')})
      render(<RelatoriosPage />)
      await screen.findByText('Nenhum pedido para os filtros aplicados.')
      fireEvent.click(screen.getByRole('button',{name:'Exportar consulta CSV'}))
      expect(screen.getByRole('status')).toHaveTextContent('Não foi possível gerar o CSV.')
    })
  })

  describe('Historical Data Aggregation and Filtering Logic', () => {
    it('filters orders by date range boundaries precisely', () => {
      const range = {
        from: new Date(2026, 7, 12),
        to: new Date(2026, 7, 15),
      }
      const filtered = filterOrdersByDateRange(ADVERSARIAL_ORDERS, range)

      // Expected orders: DIR-ADV-01 (15th), DIR-ADV-02 (14th), DIR-ADV-03 (12th)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((o) => o.id)).toContain('DIR-ADV-01')
      expect(filtered.map((o) => o.id)).toContain('DIR-ADV-02')
      expect(filtered.map((o) => o.id)).toContain('DIR-ADV-03')
      expect(filtered.map((o) => o.id)).not.toContain('DIR-ADV-04') // 1st
      expect(filtered.map((o) => o.id)).not.toContain('DIR-ADV-05') // June
    })

    it('generates weekly buckets and aggregates real orders when date range spans > 31 days', () => {
      const range = {
        from: new Date(2026, 5, 1), // June 1, 2026
        to: new Date(2026, 7, 15),  // Aug 15, 2026 (~75 days)
      }
      const series = generateReportTimeSeries(ADVERSARIAL_ORDERS, range)

      expect(series.length).toBeGreaterThanOrEqual(10)
      expect(series[0].label).toContain('Semana 1')

      // DIR-ADV-01 (confirmado), DIR-ADV-02 (confirmado), DIR-ADV-05 (confirmado)
      const totalDeliveries = series.reduce((sum, pt) => sum + pt.deliveries, 0)
      const totalCancellations = series.reduce((sum, pt) => sum + pt.cancellations, 0)
      expect(totalDeliveries).toBe(3) // DIR-ADV-01, DIR-ADV-02, DIR-ADV-05
      expect(totalCancellations).toBe(1) // DIR-ADV-03
    })

    it('generates daily buckets when date range is <= 31 days', () => {
      const range = {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 15),
      }
      const series = generateReportTimeSeries(ADVERSARIAL_ORDERS, range)

      expect(series.length).toBe(15)
      expect(series[0].date).toBe('01/08')
      expect(series[14].date).toBe('15/08')

      // Deliveries on 15/08 (DIR-ADV-01) and 14/08 (DIR-ADV-02)
      expect(series[14].deliveries).toBe(1)
      expect(series[13].deliveries).toBe(1)
      // Cancellation on 12/08 (DIR-ADV-03)
      expect(series[11].cancellations).toBe(1)
    })
  })

  describe('useSupplierReports Mathematical & Edge Case Integrity', () => {
    it('calculates metrics with exact precision and preserves true zeros without fallback corruption', () => {
      // Date range containing DIR-ADV-01 (confirmado) and DIR-ADV-02 (confirmado) -> 0 cancellations
      const range = {
        from: new Date(2026, 7, 13),
        to: new Date(2026, 7, 15),
      }
      const { result } = renderHook(() => useSupplierReports(range))

      expect(result.current.summary.totalOrdersCount).toBe(2)
      expect(result.current.summary.totalDeliveries).toBe(2)
      expect(result.current.summary.totalCancellations).toBe(0)
      expect(result.current.summary.cancellationRate).toBe(0)
      expect(result.current.summary.deliverySuccessRate).toBe(100)
      expect(result.current.summary.totalRevenueCents).toBe(48000) // 32000 + 16000
    })

    it('handles empty date ranges cleanly with 0 counts and 0% rates', () => {
      // Future date range with 0 orders
      const range = {
        from: new Date(2029, 0, 1),
        to: new Date(2029, 0, 10),
      }
      const { result } = renderHook(() => useSupplierReports(range))

      expect(result.current.summary.totalOrdersCount).toBe(0)
      expect(result.current.summary.totalDeliveries).toBe(0)
      expect(result.current.summary.totalCancellations).toBe(0)
      expect(result.current.summary.deliverySuccessRate).toBe(0)
      expect(result.current.summary.cancellationRate).toBe(0)
      expect(result.current.summary.totalRevenueCents).toBe(0)
    })
  })
})
