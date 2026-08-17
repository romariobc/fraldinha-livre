/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from 'vitest'

// Mock Firebase & Contexts to avoid unmocked Firebase initialization in pure unit tests
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'sup-m4-emp', email: 'emp-fornecedor@teste.com', displayName: 'Distribuidora Alpha' },
    role: 'fornecedor',
    loading: false,
  })),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: [],
    directOrdersLoading: false,
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: [],
  })),
}))

import {
  filterOrdersByDateRange,
  generateReportTimeSeries,
} from '@/hooks/use-supplier-data'
import type { DirectOrder } from '@/lib/supplier-mock'

describe('Challenger 1 Empirical Stress Test Harness — Milestone 4', () => {
  describe('1. Weekly & Long-Range Order Aggregation (>31 days, 90d, 365d, Multi-Year)', () => {
    it('accurately aggregates all orders across a 90-day range with exact boundary checks', () => {
      const startDate = new Date(2026, 0, 1, 0, 0, 0, 0) // Jan 1, 2026
      const endDate = new Date(2026, 2, 31, 23, 59, 59, 999) // Mar 31, 2026 (90 days)

      const orders: DirectOrder[] = [
        // Order at the very start of the range (Week 1 start)
        {
          id: 'ORD-W1-START',
          product: 'Pampers G',
          quantity: 10,
          unit: 'cx',
          price: 15000,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2026, 0, 1, 0, 0, 0).toISOString(),
          status: 'confirmado',
        },
        // Order at the exact end of Week 1
        {
          id: 'ORD-W1-END',
          product: 'Pampers G',
          quantity: 5,
          unit: 'cx',
          price: 7500,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2026, 0, 7, 23, 59, 59).toISOString(),
          status: 'cancelado',
        },
        // Order at the start of Week 2
        {
          id: 'ORD-W2-START',
          product: 'Huggies M',
          quantity: 2,
          unit: 'cx',
          price: 5000,
          buyerCity: 'Guarulhos',
          buyerState: 'SP',
          createdAt: new Date(2026, 0, 8, 0, 0, 1).toISOString(),
          status: 'confirmado',
        },
        // Order in middle of range (Feb 15)
        {
          id: 'ORD-MID',
          product: 'Lenços',
          quantity: 20,
          unit: 'un',
          price: 12000,
          buyerCity: 'Campinas',
          buyerState: 'SP',
          createdAt: new Date(2026, 1, 15, 12, 0, 0).toISOString(),
          status: 'confirmado',
        },
        // Order at the very end of 90-day range
        {
          id: 'ORD-W-END',
          product: 'Pomada',
          quantity: 1,
          unit: 'un',
          price: 3000,
          buyerCity: 'Santos',
          buyerState: 'SP',
          createdAt: new Date(2026, 2, 31, 23, 59, 50).toISOString(),
          status: 'confirmado',
        },
        // Order outside range (prior year) - should NOT be included
        {
          id: 'ORD-OUT-PAST',
          product: 'Old',
          quantity: 1,
          unit: 'un',
          price: 9999,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2025, 11, 31, 23, 59, 59).toISOString(),
          status: 'confirmado',
        },
        // Order outside range (future) - should NOT be included
        {
          id: 'ORD-OUT-FUTURE',
          product: 'Future',
          quantity: 1,
          unit: 'un',
          price: 9999,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2026, 3, 1, 0, 0, 0).toISOString(),
          status: 'confirmado',
        },
      ]

      const range = { from: startDate, to: endDate }
      const filteredOrders = filterOrdersByDateRange(orders, range)
      expect(filteredOrders).toHaveLength(5)
      expect(filteredOrders.find((o) => o.id === 'ORD-OUT-PAST')).toBeUndefined()
      expect(filteredOrders.find((o) => o.id === 'ORD-OUT-FUTURE')).toBeUndefined()

      const series = generateReportTimeSeries(filteredOrders, range)

      // 90 days / 7 = 13 weeks
      expect(series.length).toBe(13)

      // Check Week 1 (contains ORD-W1-START and ORD-W1-END)
      expect(series[0].deliveries).toBe(1)
      expect(series[0].cancellations).toBe(1)
      expect(series[0].revenue).toBe(15000)
      expect(series[0].successRate).toBe(50) // 1 / 2 = 50%

      // Check Week 2 (contains ORD-W2-START)
      expect(series[1].deliveries).toBe(1)
      expect(series[1].cancellations).toBe(0)
      expect(series[1].revenue).toBe(5000)
      expect(series[1].successRate).toBe(100)

      // Total across all weeks must match exactly
      const totalDeliveries = series.reduce((sum, b) => sum + b.deliveries, 0)
      const totalCancellations = series.reduce((sum, b) => sum + b.cancellations, 0)
      const totalRevenue = series.reduce((sum, b) => sum + (b.revenue || 0), 0)

      expect(totalDeliveries).toBe(4) // W1, W2, MID, END
      expect(totalCancellations).toBe(1) // W1
      expect(totalRevenue).toBe(15000 + 5000 + 12000 + 3000) // 35000
    })

    it('aggregates full 1-year (365 days) range without truncating at 90 days', () => {
      const startDate = new Date(2026, 0, 1) // Jan 1, 2026
      const endDate = new Date(2026, 11, 31, 23, 59, 59) // Dec 31, 2026 (365 days)

      const orders: DirectOrder[] = [
        {
          id: 'ORD-JAN',
          product: 'Jan Item',
          quantity: 1,
          unit: 'un',
          price: 10000,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2026, 0, 15).toISOString(),
          status: 'confirmado',
        },
        {
          id: 'ORD-JUN',
          product: 'Jun Item',
          quantity: 1,
          unit: 'un',
          price: 20000,
          buyerCity: 'Campinas',
          buyerState: 'SP',
          createdAt: new Date(2026, 5, 15).toISOString(),
          status: 'confirmado',
        },
        {
          id: 'ORD-NOV',
          product: 'Nov Item',
          quantity: 1,
          unit: 'un',
          price: 30000,
          buyerCity: 'Santos',
          buyerState: 'SP',
          createdAt: new Date(2026, 10, 15).toISOString(),
          status: 'confirmado',
        },
        {
          id: 'ORD-DEC',
          product: 'Dec Item',
          quantity: 1,
          unit: 'un',
          price: 40000,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: new Date(2026, 11, 30).toISOString(),
          status: 'cancelado',
        },
      ]

      const range = { from: startDate, to: endDate }
      const series = generateReportTimeSeries(orders, range)

      // 365 days / 7 = 53 weeks
      expect(series.length).toBe(53)
      expect(series[0].label).toContain('Semana 1')
      expect(series[52].label).toContain('Semana 53')

      const totalDeliv = series.reduce((s, b) => s + b.deliveries, 0)
      const totalCanc = series.reduce((s, b) => s + b.cancellations, 0)
      const totalRev = series.reduce((s, b) => s + (b.revenue || 0), 0)

      expect(totalDeliv).toBe(3)
      expect(totalCanc).toBe(1)
      expect(totalRev).toBe(60000) // 10k + 20k + 30k
    })

    it('handles multi-year spans and leap years gracefully without NaN or freeze', () => {
      // 2024 is a leap year (Feb 29)
      const startDate = new Date(2024, 1, 20) // Feb 20, 2024
      const endDate = new Date(2024, 2, 10) // Mar 10, 2024 (~20 days, daily)

      const leapOrder: DirectOrder = {
        id: 'ORD-LEAP',
        product: 'Leap Item',
        quantity: 1,
        unit: 'un',
        price: 5000,
        buyerCity: 'São Paulo',
        buyerState: 'SP',
        createdAt: '2024-02-29T12:00:00.000Z',
        status: 'confirmado',
      }

      const seriesDaily = generateReportTimeSeries([leapOrder], { from: startDate, to: endDate })
      const leapBucket = seriesDaily.find((b) => b.date === '29/02' || b.label === '29/02')
      expect(leapBucket).toBeDefined()
      expect(leapBucket?.deliveries).toBe(1)
      expect(leapBucket?.revenue).toBe(5000)

      // Multi-year (2024 to 2026, ~730 days)
      const multiYearRange = { from: new Date(2024, 0, 1), to: new Date(2026, 0, 1) }
      const multiSeries = generateReportTimeSeries([leapOrder], multiYearRange)
      expect(multiSeries.length).toBeGreaterThan(100)
      const multiDeliveries = multiSeries.reduce((s, b) => s + b.deliveries, 0)
      expect(multiDeliveries).toBe(1)
    })
  })

  describe('2. Zero Edge Cases (Zero Deliveries, Zero Cancellations, Zero Revenue, 0-Value Items)', () => {
    it('handles empty orders list returning pure zero metrics without mock injection', () => {
      const range = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 15) }
      const series = generateReportTimeSeries([], range)

      expect(series).toHaveLength(15)
      for (const pt of series) {
        expect(pt.deliveries).toBe(0)
        expect(pt.cancellations).toBe(0)
        expect(pt.revenue).toBe(0)
        expect(pt.successRate).toBe(100) // 0 / 0 safe default is 100%
        expect(Number.isNaN(pt.successRate)).toBe(false)
      }
    })

    it('handles zero cancellations with 100% deliveries accurately', () => {
      const orders: DirectOrder[] = Array.from({ length: 5 }, (_, i) => ({
        id: `ORD-CONF-${i}`,
        product: `Item ${i}`,
        quantity: 1,
        unit: 'un' as const,
        price: 10000,
        buyerCity: 'São Paulo',
        buyerState: 'SP',
        createdAt: `2026-08-0${i + 1}T10:00:00Z`,
        status: 'confirmado' as const,
      }))

      const range = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 10) }
      const series = generateReportTimeSeries(orders, range)

      const totalDeliv = series.reduce((s, b) => s + b.deliveries, 0)
      const totalCanc = series.reduce((s, b) => s + b.cancellations, 0)
      expect(totalDeliv).toBe(5)
      expect(totalCanc).toBe(0)
    })

    it('handles zero deliveries with 100% cancellations accurately', () => {
      const orders: DirectOrder[] = Array.from({ length: 4 }, (_, i) => ({
        id: `ORD-CANC-${i}`,
        product: `Item ${i}`,
        quantity: 1,
        unit: 'un' as const,
        price: 10000,
        buyerCity: 'São Paulo',
        buyerState: 'SP',
        createdAt: `2026-08-0${i + 1}T10:00:00Z`,
        status: 'cancelado' as const,
      }))

      const range = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 10) }
      const series = generateReportTimeSeries(orders, range)

      const totalDeliv = series.reduce((s, b) => s + b.deliveries, 0)
      const totalCanc = series.reduce((s, b) => s + b.cancellations, 0)
      expect(totalDeliv).toBe(0)
      expect(totalCanc).toBe(4)

      const cancBucket = series.find((b) => b.cancellations > 0)
      expect(cancBucket?.successRate).toBe(0) // 0 / 1 = 0%
    })

    it('handles 0-price promotional orders without NaN in revenue or average calculations', () => {
      const freeOrders: DirectOrder[] = [
        {
          id: 'ORD-FREE-1',
          product: 'Amostra Grátis',
          quantity: 1,
          unit: 'un',
          price: 0,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: '2026-08-05T10:00:00Z',
          status: 'confirmado',
        },
        {
          id: 'ORD-FREE-2',
          product: 'Brinde Promocional',
          quantity: 1,
          unit: 'un',
          price: 0,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: '2026-08-06T10:00:00Z',
          status: 'confirmado',
        },
      ]

      const range = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 10) }
      const series = generateReportTimeSeries(freeOrders, range)
      const totalRev = series.reduce((s, b) => s + (b.revenue || 0), 0)
      expect(totalRev).toBe(0)
      expect(Number.isNaN(totalRev)).toBe(false)
    })
  })

  describe('3. Division by Zero Handling & Numerical Stability', () => {
    it('safely computes rate metrics on 0-denominator conditions', () => {
      // In generateReportTimeSeries: sum === 0 -> returns 100%
      const emptySeries = generateReportTimeSeries([], {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 5),
      })
      for (const pt of emptySeries) {
        expect(pt.successRate).toBe(100)
        expect(Number.isFinite(pt.successRate)).toBe(true)
      }

      // Single cancelled order in bucket: 0 deliveries, 1 cancellation -> 0%
      const singleCanc = generateReportTimeSeries(
        [{ id: '1', product: 'P', quantity: 1, unit: 'un', price: 100, buyerCity: 'SP', buyerState: 'SP', createdAt: '2026-08-01T12:00:00Z', status: 'cancelado' }],
        { from: new Date(2026, 7, 1), to: new Date(2026, 7, 1) }
      )
      expect(singleCanc[0].successRate).toBe(0)

      // Mixed: 1 delivery, 3 cancellations -> 1 / 4 = 25%
      const mixed = generateReportTimeSeries(
        [
          { id: '1', product: 'P', quantity: 1, unit: 'un', price: 100, buyerCity: 'SP', buyerState: 'SP', createdAt: '2026-08-01T12:00:00Z', status: 'confirmado' },
          { id: '2', product: 'P', quantity: 1, unit: 'un', price: 100, buyerCity: 'SP', buyerState: 'SP', createdAt: '2026-08-01T13:00:00Z', status: 'cancelado' },
          { id: '3', product: 'P', quantity: 1, unit: 'un', price: 100, buyerCity: 'SP', buyerState: 'SP', createdAt: '2026-08-01T14:00:00Z', status: 'cancelado' },
          { id: '4', product: 'P', quantity: 1, unit: 'un', price: 100, buyerCity: 'SP', buyerState: 'SP', createdAt: '2026-08-01T15:00:00Z', status: 'cancelado' },
        ],
        { from: new Date(2026, 7, 1), to: new Date(2026, 7, 1) }
      )
      expect(mixed[0].successRate).toBe(25)
    })
  })

  describe('4. CSV Export Generation, RFC 4180 Escaping & Date Formatting', () => {
    it('properly escapes quotes, commas, and special characters according to RFC 4180', () => {
      // Simulate CSV row generation logic from RelatoriosPage
      const samplePoints = [
        {
          label: 'Semana "1" (01/08 - 07/08)',
          date: 'Semana 1',
          deliveries: 15,
          cancellations: 2,
          successRate: 88.2,
          revenue: 350000,
        },
        {
          label: 'Dia 15/08, Feriado "Proclamação"',
          date: '15/08',
          deliveries: 0,
          cancellations: 0,
          successRate: 100,
          revenue: 0,
        },
      ]

      const headers = ['Data', 'Entregas Concluidas', 'Cancelamentos', 'Taxa de Sucesso (%)', 'Receita Estimada (R$)']
      const rows = samplePoints.map((d) => [
        `"${String(d.label || d.date).replace(/"/g, '""')}"`,
        d.deliveries,
        d.cancellations,
        `"${String(d.successRate ?? 100).replace(/"/g, '""')}%"`,
        `"${((d.revenue || 0) / 100).toFixed(2).replace(/"/g, '""')}"`,
      ])

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

      // Assert quotes are doubled
      expect(csvContent).toContain('"Semana ""1"" (01/08 - 07/08)"')
      expect(csvContent).toContain('"Dia 15/08, Feriado ""Proclamação"""')

      // Assert commas inside quotes do not break columns
      const lines = csvContent.split('\n')
      expect(lines).toHaveLength(3)
      expect(lines[0]).toBe('Data,Entregas Concluidas,Cancelamentos,Taxa de Sucesso (%),Receita Estimada (R$)')
      expect(lines[1]).toBe('"Semana ""1"" (01/08 - 07/08)",15,2,"88.2%","3500.00"')
      expect(lines[2]).toBe('"Dia 15/08, Feriado ""Proclamação""",0,0,"100%","0.00"')
    })

    it('properly handles nullish coalescing on 0% successRate and missing revenue in CSV generation', () => {
      const pointWithZeroSuccess = {
        label: 'Dia 10/08',
        date: '10/08',
        deliveries: 0,
        cancellations: 5,
        successRate: 0, // Exactly 0%
        revenue: 0,
      }

      const formattedSuccessRate = `"${String(pointWithZeroSuccess.successRate ?? 100).replace(/"/g, '""')}%"`
      expect(formattedSuccessRate).toBe('"0%"') // Must NOT become "100%"

      const formattedRevenue = `"${((pointWithZeroSuccess.revenue || 0) / 100).toFixed(2).replace(/"/g, '""')}"`
      expect(formattedRevenue).toBe('"0.00"')
    })

    it('safely handles inverted date ranges without infinite loops or crashes', () => {
      const invertedRange = {
        from: new Date(2026, 7, 15),
        to: new Date(2026, 7, 1),
      }
      const series = generateReportTimeSeries([], invertedRange)
      expect(series.length).toBe(1)
      expect(series[0].deliveries).toBe(0)
    })
  })
})
