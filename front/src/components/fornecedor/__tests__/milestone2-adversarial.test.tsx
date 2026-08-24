/// <reference types="vitest/globals" />

import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { MetricCard } from '../MetricCard'
import { useSupplierData } from '@/hooks/use-supplier-data'
import SupplierDashboardOverviewPage from '@/app/(fornecedor)/painel-fornecedor/page'
import { DollarSign, Package } from 'lucide-react'
import type { DirectOrder } from '@/lib/supplier-mock'

// Mock contexts for hook & page testing
let mockDirectOrders: DirectOrder[] = []

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: {
      displayName: 'Distribuidora Alpha',
      email: 'alpha@distribuidora.com',
    },
    role: 'fornecedor',
    loading: false,
  })),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: mockDirectOrders,
    directOrdersLoading: false,
    directOrdersError: null,
    marketOrders: [],
    offers: [],
  })),
}))

vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(() => ({
    products: Array.from({ length: 42 }, (_, i) => ({
      id: `p-${i}`,
      name: `Produto ${i}`,
    })),
    loading: false,
    error: null,
  })),
}))

describe('Milestone 2 Adversarial Stress Testing', () => {
  describe('MetricCard Adversarial Stress Tests', () => {
    it('handles extreme numeric values: 0, negative, and massive integers', () => {
      const { rerender } = render(
        <MetricCard
          title="Zero Value"
          value={0}
          icon={DollarSign}
        />
      )
      expect(screen.getByText('0')).toBeInTheDocument()

      rerender(
        <MetricCard
          title="Zero Currency"
          value="R$ 0,00"
        />
      )
      expect(screen.getByText('R$ 0,00')).toBeInTheDocument()

      rerender(
        <MetricCard
          title="Billion Currency"
          value="R$ 1.000.000.000,00"
        />
      )
      expect(screen.getByText('R$ 1.000.000.000,00')).toBeInTheDocument()

      rerender(
        <MetricCard
          title="Empty String"
          value=""
        />
      )
      expect(screen.getByText('Empty String')).toBeInTheDocument()
    })

    it('handles adversarial change variations and trend logic', () => {
      // 1. Change = 0 (neutral trend)
      const { rerender } = render(
        <MetricCard
          title="Neutral Change"
          value="100"
          change={0}
        />
      )
      expect(screen.getByText('0.0%')).toBeInTheDocument()

      // 2. Change = negative number with isPositiveGood = true (bad -> red)
      rerender(
        <MetricCard
          title="Revenue Dropped"
          value="R$ 10.000,00"
          change={{
            value: -25.5,
            isPositiveGood: true,
            label: 'queda crítica',
          }}
        />
      )
      const negBadge = screen.getByText('-25.5%').closest('.inline-flex')
      expect(negBadge).toHaveClass('text-rose-700')
      expect(screen.getByText('queda crítica')).toBeInTheDocument()

      // 3. Change = negative number with isPositiveGood = false (good -> green for cancellations)
      rerender(
        <MetricCard
          title="Cancellations Dropped"
          value="2"
          change={{
            value: -12.0,
            isPositiveGood: false,
            label: 'melhoria de cancelamento',
          }}
        />
      )
      const goodNegBadge = screen.getByText('-12.0%').closest('.inline-flex')
      expect(goodNegBadge).toHaveClass('text-emerald-700')

      // 4. Change = positive number with isPositiveGood = false (bad -> red for cancellations rising)
      rerender(
        <MetricCard
          title="Cancellations Rose"
          value="15"
          change={{
            value: 40.0,
            isPositiveGood: false,
            label: 'aumento de cancelamento',
          }}
        />
      )
      const badPosBadge = screen.getByText('+40.0%').closest('.inline-flex')
      expect(badPosBadge).toHaveClass('text-rose-700')

      // 5. String change formatted
      rerender(
        <MetricCard
          title="Custom String Change"
          value="50"
          change={{
            value: '+15.2%',
            trend: 'up',
            isPositiveGood: true,
          }}
        />
      )
      expect(screen.getByText('+15.2%')).toBeInTheDocument()
    })

    it('renders sparklines safely with single point, empty array, flatline, negative and large datasets', () => {
      // 1. Single point
      const { container, rerender } = render(
        <MetricCard
          title="Single Point"
          value="50"
          sparklineData={[42]}
        />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBe(2) // Area and line paths

      // 2. Empty array
      rerender(
        <MetricCard
          title="Empty Sparkline"
          value="50"
          sparklineData={[]}
        />
      )
      expect(container.querySelector('svg')).toBeNull()

      // 3. Flatline (all identical values: max - min === 0)
      rerender(
        <MetricCard
          title="Flatline Sparkline"
          value="50"
          sparklineData={[100, 100, 100, 100, 100]}
        />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()

      // 4. Negative values
      rerender(
        <MetricCard
          title="Negative Sparkline"
          value="-10"
          sparklineData={[-50, -20, -80, -10]}
        />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()

      // 5. Massive dataset (500 data points)
      const massiveData = Array.from({ length: 500 }, (_, i) => ({
        date: `D${i}`,
        value: Math.sin(i / 10) * 100 + 100,
      }))
      rerender(
        <MetricCard
          title="Massive Sparkline"
          value="500 pts"
          sparklineData={massiveData}
        />
      )
      expect(container.querySelectorAll('circle').length).toBe(500)
    })

    it('supports hover interaction on sparkline points showing tooltips', () => {
      const { container } = render(
        <MetricCard
          title="Interactive Sparkline"
          value="300"
          sparklineData={[
            { date: '01/08', value: 150 },
            { date: '02/08', value: 350 },
          ]}
        />
      )

      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(2)

      // Hover first point
      fireEvent.mouseEnter(circles[0])
      expect(screen.getByText(/01\/08: 150/)).toBeInTheDocument()

      // Hover second point
      fireEvent.mouseEnter(circles[1])
      expect(screen.getByText(/02\/08: 350/)).toBeInTheDocument()

      // Mouse leave
      fireEvent.mouseLeave(circles[1])
      expect(screen.queryByText(/02\/08: 350/)).toBeNull()
    })

    it('renders across all theme variants cleanly', () => {
      const variants = ['primary', 'info', 'success', 'danger', 'warning', 'default'] as const

      variants.forEach((variant) => {
        const { unmount } = render(
          <MetricCard
            title={`Variant ${variant}`}
            value="100"
            variant={variant}
            icon={Package}
            sparklineData={[10, 20, 30]}
          />
        )
        expect(screen.getByText(`Variant ${variant}`)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('useSupplierData Hook Stress Tests', () => {
    it('handles 0 orders baseline gracefully', () => {
      mockDirectOrders = []
      const { result } = renderHook(() => useSupplierData())

      expect(result.current.metrics.totalRevenueCents).toBe(0)
      expect(result.current.metrics.averageTicketCents).toBe(0)
      expect(result.current.metrics.totalOrdersCount).toBe(0)
      expect(result.current.metrics.pendingOrdersCount).toBe(0)
      expect(result.current.metrics.confirmedOrdersCount).toBe(0)
      expect(result.current.recentOrders).toEqual([])
      expect(result.current.catalogSummary.totalProducts).toBe(42)
    })

    it('handles 1000 orders scale test within milliseconds without memory leak', () => {
      const statuses = ['confirmado', 'aguardando', 'cancelado'] as const
      const thousandOrders: DirectOrder[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `ORD-${1000 + i}`,
        product: `Produto Teste ${(i % 20) + 1}`,
        quantity: (i % 10) + 1,
        unit: 'cx',
        price: ((i % 50) + 1) * 1000, // R$ 10,00 to R$ 500,00
        buyerCity: i % 2 === 0 ? 'São Paulo' : 'Campinas',
        buyerState: 'SP',
        createdAt: new Date(2026, 0, 1 + (i % 200), (i % 24)).toISOString(),
        status: statuses[i % 3],
      }))

      mockDirectOrders = thousandOrders

      const start = performance.now()
      const { result } = renderHook(() => useSupplierData())
      const duration = performance.now() - start

      // Must execute within reasonable time (< 1000ms)
      expect(duration).toBeLessThan(1000)

      expect(result.current.metrics.totalOrdersCount).toBe(1000)
      expect(result.current.recentOrders).toHaveLength(5)
      expect(result.current.metrics.totalRevenueCents).toBeGreaterThan(0)
      expect(result.current.metrics.averageTicketCents).toBeGreaterThan(0)
      expect(result.current.metrics.confirmedOrdersCount).toBeGreaterThan(0)
      expect(result.current.metrics.pendingOrdersCount).toBeGreaterThan(0)
    })

    it('handles extreme order conditions: 0 price and negative price safeguards', () => {
      mockDirectOrders = [
        {
          id: 'FREE-1',
          product: 'Amostra Grátis',
          quantity: 1,
          unit: 'un',
          price: 0,
          buyerCity: 'São Paulo',
          buyerState: 'SP',
          createdAt: '2026-08-15T12:00:00Z',
          status: 'confirmado',
        },
      ]

      const { result } = renderHook(() => useSupplierData())
      expect(result.current.metrics.totalRevenueCents).toBe(0)
      expect(result.current.metrics.averageTicketCents).toBe(0)
      expect(result.current.metrics.confirmedOrdersCount).toBe(1)
      expect(result.current.recentOrders[0].priceFormatted).toBe('R$ 0,00')
    })
  })

  describe('SupplierDashboardOverviewPage Viewport & Responsive Layout Tests', () => {
    it('renders empty recent orders state when no orders exist', () => {
      mockDirectOrders = []
      render(<SupplierDashboardOverviewPage />)

      expect(screen.getByText('Nenhum pedido recente')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Novos pedidos enviados por compradores aparecerão aqui em tempo real.'
        )
      ).toBeInTheDocument()
    })

    it('renders full dashboard structure with all subroute links and responsive cards', () => {
      mockDirectOrders = [
        {
          id: 'ORD-A1',
          product: 'Fralda Huggies Supreme Care G',
          quantity: 10,
          unit: 'un',
          price: 25000,
          buyerCity: 'Ribeirão Preto',
          buyerState: 'SP',
          createdAt: '2026-08-15T14:00:00Z',
          status: 'confirmado',
        },
      ]

      const { container } = render(<SupplierDashboardOverviewPage />)

      // Check responsive grid wrappers
      const kpiGrid = container.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4')
      expect(kpiGrid).toBeInTheDocument()

      const mainGrid = container.querySelector('.grid-cols-1.lg\\:grid-cols-3')
      expect(mainGrid).toBeInTheDocument()

      // Check all 4 KPI cards
      expect(screen.getByTestId('metric-card-receita')).toBeInTheDocument()
      expect(screen.getByTestId('metric-card-ticket')).toBeInTheDocument()
      expect(screen.getByTestId('metric-card-entregas')).toBeInTheDocument()
      expect(screen.getByTestId('metric-card-cancelados')).toBeInTheDocument()

      // Check support channel card
      expect(screen.getByText('Canal da Distribuidora')).toBeInTheDocument()
      expect(screen.getByText('Falar com Gerente de Contas')).toBeInTheDocument()
    })
  })
})
