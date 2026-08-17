/// <reference types="vitest/globals" />

import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import {
  useSupplierData,
  useSupplierReports,
  filterOrdersByDateRange,
  generateReportTimeSeries,
} from '../use-supplier-data'
import type { DirectOrder } from '@/lib/supplier-mock'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: {
      displayName: 'Distribuidora Teste',
      email: 'contato@distribuidorateste.com.br',
    },
    role: 'fornecedor',
    loading: false,
  })),
}))

const MOCK_HOOK_ORDERS: DirectOrder[] = [
  {
    id: 'DIR-100',
    product: 'Fralda Pampers P',
    quantity: 10,
    unit: 'un',
    price: 20000, // R$ 200,00
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: '2026-08-15T12:00:00Z',
    status: 'confirmado',
  },
  {
    id: 'DIR-101',
    product: 'Fralda Huggies M',
    quantity: 5,
    unit: 'un',
    price: 10000, // R$ 100,00
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: '2026-08-14T10:00:00Z',
    status: 'aguardando',
  },
  {
    id: 'DIR-102',
    product: 'Cremer G',
    quantity: 2,
    unit: 'cx',
    price: 5000,
    buyerCity: 'Santos',
    buyerState: 'SP',
    createdAt: '2026-08-10T08:00:00Z',
    status: 'cancelado',
  },
  {
    id: 'DIR-099',
    product: 'Babysec M',
    quantity: 1,
    unit: 'un',
    price: 4500,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: '2026-07-01T08:00:00Z',
    status: 'confirmado',
  },
]

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: MOCK_HOOK_ORDERS,
    directOrdersLoading: false,
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: [
      { id: 'p1', name: 'Prod 1' },
      { id: 'p2', name: 'Prod 2' },
      { id: 'p3', name: 'Prod 3' },
    ],
    loading: false,
    error: null,
  })),
}))

describe('useSupplierData and Reports Hooks', () => {
  describe('useSupplierData', () => {
    it('calculates metrics accurately from direct orders', () => {
      const { result } = renderHook(() => useSupplierData())

      // Total revenue should sum non-cancelled orders: 20000 + 10000 + 4500 = 34500 (R$ 345,00)
      expect(result.current.metrics.totalRevenueCents).toBe(34500)
      expect(result.current.metrics.totalRevenueFormatted).toBe('R$ 345,00')

      // Average ticket: 34500 / 3 non-cancelled orders = 11500 (R$ 115,00)
      expect(result.current.metrics.averageTicketCents).toBe(11500)
      expect(result.current.metrics.averageTicketFormatted).toBe('R$ 115,00')

      // Deliveries count: confirmed orders = 2
      expect(result.current.metrics.totalDeliveries).toBe(2)

      // Cancellations count: 1
      expect(result.current.metrics.totalCancellations).toBe(1)

      // Pending count: 1
      expect(result.current.metrics.pendingOrdersCount).toBe(1)
    })

    it('provides supplier profile and catalog summaries', () => {
      const { result } = renderHook(() => useSupplierData())

      expect(result.current.supplier.name).toBe('Distribuidora Teste')
      expect(result.current.supplier.email).toBe('contato@distribuidorateste.com.br')
      expect(result.current.catalogSummary.totalProducts).toBe(3)
    })

    it('formats recent orders in descending date order with localized statuses', () => {
      const { result } = renderHook(() => useSupplierData())

      expect(result.current.recentOrders).toHaveLength(4)
      expect(result.current.recentOrders[0].id).toBe('DIR-100')
      expect(result.current.recentOrders[0].statusLabel).toBe('Confirmado')
      expect(result.current.recentOrders[0].statusVariant).toBe('default')

      expect(result.current.recentOrders[1].id).toBe('DIR-101')
      expect(result.current.recentOrders[1].statusLabel).toBe('Aguardando')
      expect(result.current.recentOrders[1].statusVariant).toBe('secondary')

      expect(result.current.recentOrders[2].id).toBe('DIR-102')
      expect(result.current.recentOrders[2].statusLabel).toBe('Cancelado')
      expect(result.current.recentOrders[2].statusVariant).toBe('destructive')
    })

    it('generates complete sparkline datasets', () => {
      const { result } = renderHook(() => useSupplierData())

      expect(result.current.metrics.sparklines.revenue).toHaveLength(7)
      expect(result.current.metrics.sparklines.averageTicket).toHaveLength(7)
      expect(result.current.metrics.sparklines.deliveries).toHaveLength(7)
      expect(result.current.metrics.sparklines.cancellations).toHaveLength(7)
    })
  })

  describe('filterOrdersByDateRange', () => {
    it('returns all orders if no date range is provided', () => {
      const filtered = filterOrdersByDateRange(MOCK_HOOK_ORDERS, undefined)
      expect(filtered).toHaveLength(4)
    })

    it('filters orders strictly within from and to bounds', () => {
      const range = {
        from: new Date(2026, 7, 10), // 10 Aug 2026
        to: new Date(2026, 7, 15),   // 15 Aug 2026
      }
      const filtered = filterOrdersByDateRange(MOCK_HOOK_ORDERS, range)
      expect(filtered).toHaveLength(3) // DIR-100, DIR-101, DIR-102 (July order excluded)
    })

    it('handles single bound ranges correctly', () => {
      const range = {
        from: new Date(2026, 7, 14),
      }
      const filtered = filterOrdersByDateRange(MOCK_HOOK_ORDERS, range)
      expect(filtered).toHaveLength(2) // DIR-100 (15th) and DIR-101 (14th)
    })
  })

  describe('generateReportTimeSeries', () => {
    it('builds time-series data points with calculated deliveries, cancellations, and rates', () => {
      const range = {
        from: new Date(2026, 7, 10),
        to: new Date(2026, 7, 15),
      }
      const series = generateReportTimeSeries(MOCK_HOOK_ORDERS, range)
      expect(series.length).toBeGreaterThanOrEqual(6)

      // Every point should have valid properties
      series.forEach((pt) => {
        expect(pt).toHaveProperty('date')
        expect(pt).toHaveProperty('deliveries')
        expect(pt).toHaveProperty('cancellations')
        expect(pt).toHaveProperty('successRate')
      })
    })
  })

  describe('useSupplierReports', () => {
    it('returns comprehensive summary data for reporting', () => {
      const range = {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 15),
      }
      const { result } = renderHook(() => useSupplierReports(range))

      expect(result.current.summary).toBeDefined()
      expect(result.current.summary.chartData.length).toBeGreaterThan(0)
      expect(result.current.summary.statusBreakdown.length).toBe(3)
      expect(result.current.summary.categoryBreakdown.length).toBe(4)
      expect(result.current.summary.cancellationReasons.length).toBe(3)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})
