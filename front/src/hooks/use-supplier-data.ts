'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useMarket } from '@/contexts/market-context'
import { useProducts } from '@/contexts/products-context'
import type { DirectOrder, MarketOrder, SupplierOffer } from '@/lib/domain/supplier'
import { formatPrice } from '@/lib/utils'
import type { DateRange } from '@/components/ui/calendar'
import type { ReportDataPoint } from '@/components/fornecedor/ReportsChart'

export interface MetricSparklinePoint {
  date: string
  value: number
}

export interface SupplierMetrics {
  totalRevenueCents: number
  totalRevenueFormatted: string
  revenueChangePercent: number | null
  averageTicketCents: number
  averageTicketFormatted: string
  ticketChangePercent: number | null
  totalDeliveries: number
  deliveriesChangePercent: number | null
  deliverySuccessRate: number
  totalCancellations: number
  cancellationRate: number
  cancellationsChangePercent: number | null
  totalOrdersCount: number
  pendingOrdersCount: number
  confirmedOrdersCount: number
  sparklines: {
    revenue: MetricSparklinePoint[]
    averageTicket: MetricSparklinePoint[]
    deliveries: MetricSparklinePoint[]
    cancellations: MetricSparklinePoint[]
  }
}

export interface RecentOrderItem {
  id: string
  product: string
  quantity: number
  unit: string
  priceCents: number
  priceFormatted: string
  buyerLocation: string
  createdAt: string
  status: DirectOrder['status']
  statusLabel: string
  statusVariant: 'default' | 'secondary' | 'destructive' | 'outline'
}

export interface StatusBreakdownItem {
  status: string
  label: string
  count: number
  percentage: number
  color: string
}

export interface CategoryBreakdownItem {
  category: string
  name: string
  quantity: number
  revenueCents: number
  revenueFormatted: string
  percentage: number
}

export interface CancellationReasonItem {
  reason: string
  count: number
  percentage: number
}

export interface SupplierReportSummary {
  totalRevenueCents: number
  totalRevenueFormatted: string
  averageTicketCents: number
  averageTicketFormatted: string
  totalDeliveries: number
  totalCancellations: number
  totalOrdersCount: number
  deliverySuccessRate: number
  cancellationRate: number
  averageDispatchTimeDays: number | null
  chartData: ReportDataPoint[]
  statusBreakdown: StatusBreakdownItem[]
  categoryBreakdown: CategoryBreakdownItem[]
  cancellationReasons: CancellationReasonItem[]
}

export interface SupplierDataResult {
  supplier: {
    name: string
    email: string
  }
  metrics: SupplierMetrics
  recentOrders: RecentOrderItem[]
  catalogSummary: {
    totalProducts: number
    activeProducts: number
  }
  loading: boolean
  error: string | null
  directOrders: DirectOrder[]
  marketOrders: MarketOrder[]
  offers: SupplierOffer[]
}

/**
 * Filters direct orders by a specified DateRange.
 */
export function filterOrdersByDateRange(orders: DirectOrder[] = [], range?: DateRange): DirectOrder[] {
  if (!range || (!range.from && !range.to)) {
    return orders
  }

  const fromTime = range.from ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0).getTime() : 0
  const toTime = range.to ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999).getTime() : Number.MAX_SAFE_INTEGER

  return orders.filter((order) => {
    const orderTime = new Date(order.createdAt).getTime()
    return orderTime >= fromTime && orderTime <= toTime
  })
}

/**
 * Builds comparative report time-series data points (deliveries vs cancellations vs successRate).
 */
export function generateReportTimeSeries(orders: DirectOrder[] = [], range?: DateRange): ReportDataPoint[] {
  // Determine date bounds
  const now = new Date()
  let startDate: Date
  let endDate: Date

  if (range?.from && range?.to) {
    startDate = new Date(range.from)
    endDate = new Date(range.to)
  } else if (range?.from && !range?.to) {
    startDate = new Date(range.from)
    endDate = new Date(now)
  } else {
    // Default to last 7 days
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    endDate = new Date(now)
  }

  // Normalize bounds to day start and end
  startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0)
  endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)

  // Calculate day diff
  const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)))

  // If range is large (> 31 days), group by weeks/intervals
  const isWeekly = diffDays > 31

  if (isWeekly) {
    const numWeeks = Math.max(1, Math.ceil(diffDays / 7))
    const buckets: {
      key: string
      label: string
      weekStart: Date
      weekEnd: Date
      deliveries: number
      cancellations: number
      revenue: number
    }[] = []

    for (let w = 0; w < numWeeks; w++) {
      const wStart = new Date(startDate)
      wStart.setDate(startDate.getDate() + w * 7)
      wStart.setHours(0, 0, 0, 0)

      const wEnd = new Date(wStart)
      wEnd.setDate(wStart.getDate() + 6)
      wEnd.setHours(23, 59, 59, 999)
      if (wEnd.getTime() > endDate.getTime()) {
        wEnd.setTime(endDate.getTime())
      }

      const key = `Semana ${w + 1}`
      const day = String(wStart.getDate()).padStart(2, '0')
      const month = String(wStart.getMonth() + 1).padStart(2, '0')

      buckets.push({
        key,
        label: `${key} (${day}/${month})`,
        weekStart: wStart,
        weekEnd: wEnd,
        deliveries: 0,
        cancellations: 0,
        revenue: 0,
      })
    }

    // Map each order to its corresponding week bucket interval
    for (const order of orders) {
      const oDate = new Date(order.createdAt)
      const orderTime = oDate.getTime()
      const bucket = buckets.find((b) => orderTime >= b.weekStart.getTime() && orderTime <= b.weekEnd.getTime())
      if (bucket) {
        if (order.status === 'cancelado') {
          bucket.cancellations += 1
        } else if (order.status === 'confirmado' || (order.status as string) === 'entregue') {
          bucket.deliveries += 1
          bucket.revenue += order.price || 0
        }
      }
    }

    return buckets.map((b) => {
      const sum = b.deliveries + b.cancellations
      const successRate = sum > 0 ? Number(((b.deliveries / sum) * 100).toFixed(1)) : 100
      return {
        date: b.key,
        label: b.label,
        deliveries: b.deliveries,
        cancellations: b.cancellations,
        successRate,
        revenue: b.revenue,
        totalOrders: sum,
      }
    })
  }

  // Daily grouping for <= 31 days
  const dailyBuckets: {
    key: string
    label: string
    dayStart: Date
    dayEnd: Date
    deliveries: number
    cancellations: number
    revenue: number
  }[] = []

  for (let d = 0; d < diffDays; d++) {
    const curDate = new Date(startDate)
    curDate.setDate(startDate.getDate() + d)
    const dayStr = String(curDate.getDate()).padStart(2, '0')
    const monthStr = String(curDate.getMonth() + 1).padStart(2, '0')
    const key = `${dayStr}/${monthStr}`

    const dStart = new Date(curDate)
    dStart.setHours(0, 0, 0, 0)
    const dEnd = new Date(curDate)
    dEnd.setHours(23, 59, 59, 999)

    dailyBuckets.push({
      key,
      label: key,
      dayStart: dStart,
      dayEnd: dEnd,
      deliveries: 0,
      cancellations: 0,
      revenue: 0,
    })
  }

  // Aggregate actual matching orders
  for (const order of orders) {
    const oDate = new Date(order.createdAt)
    const orderTime = oDate.getTime()
    const bucket = dailyBuckets.find((b) => orderTime >= b.dayStart.getTime() && orderTime <= b.dayEnd.getTime())
    if (bucket) {
      if (order.status === 'cancelado') {
        bucket.cancellations += 1
      } else if (order.status === 'confirmado' || (order.status as string) === 'entregue') {
        bucket.deliveries += 1
        bucket.revenue += order.price || 0
      }
    }
  }

  return dailyBuckets.map((b) => {
    const sum = b.deliveries + b.cancellations
    const successRate = sum > 0 ? Number(((b.deliveries / sum) * 100).toFixed(1)) : 100
    return {
      date: b.key,
      label: b.label,
      deliveries: b.deliveries,
      cancellations: b.cancellations,
      successRate,
      revenue: b.revenue,
      totalOrders: sum,
    }
  })
}

/**
 * @deprecated Legacy projection retained for compatibility. Active reporting uses /reports/orders.
 */
export function useSupplierReports(dateRange?: DateRange): {
  summary: SupplierReportSummary
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const { directOrders, directOrdersLoading, directOrdersError } = useMarket()

  const filteredOrders = useMemo(() => {
    return filterOrdersByDateRange(directOrders, dateRange)
  }, [directOrders, dateRange])

  const summary = useMemo<SupplierReportSummary>(() => {
    const all = filteredOrders
    const nonCancelled = all.filter((o) => o.status !== 'cancelado')
    const cancelled = all.filter((o) => o.status === 'cancelado')
    const confirmed = all.filter((o) => o.status === 'confirmado' || (o.status as string) === 'entregue')
    const pending = all.filter((o) => o.status === 'aguardando')

    const totalOrdersCount = all.length
    const totalDeliveries = confirmed.length
    const totalCancellations = cancelled.length
    const totalPending = pending.length

    const totalRevenueCents = nonCancelled.reduce((sum, o) => sum + (o.price || 0), 0)
    const averageTicketCents = totalDeliveries > 0
      ? Math.round(totalRevenueCents / totalDeliveries)
      : nonCancelled.length > 0
      ? Math.round(totalRevenueCents / nonCancelled.length)
      : 0

    const deliverySuccessRate = totalOrdersCount > 0
      ? Number(((totalDeliveries / totalOrdersCount) * 100).toFixed(1))
      : 0
    const cancellationRate = totalOrdersCount > 0
      ? Number(((totalCancellations / totalOrdersCount) * 100).toFixed(1))
      : 0

    const averageDispatchTimeDays = null // No persisted dispatch duration available.

    const chartData = generateReportTimeSeries(filteredOrders, dateRange)

    const statusBreakdown: StatusBreakdownItem[] = [
      {
        status: 'entregue',
        label: 'Entregas Concluídas',
        count: totalDeliveries,
        percentage: totalOrdersCount > 0 ? Number(((totalDeliveries / totalOrdersCount) * 100).toFixed(1)) : 0,
        color: 'bg-emerald-500',
      },
      {
        status: 'aguardando',
        label: 'Aguardando Despacho',
        count: totalPending,
        percentage: totalOrdersCount > 0 ? Number(((totalPending / totalOrdersCount) * 100).toFixed(1)) : 0,
        color: 'bg-amber-500',
      },
      {
        status: 'cancelado',
        label: 'Cancelados',
        count: totalCancellations,
        percentage: totalOrdersCount > 0 ? Number(((totalCancellations / totalOrdersCount) * 100).toFixed(1)) : 0,
        color: 'bg-rose-500',
      },
    ]

    // Category and cancellation-reason histories are not persisted in this legacy projection.
    const categoryBreakdown: CategoryBreakdownItem[] = []
    const cancellationReasons: CancellationReasonItem[] = []

    return {
      totalRevenueCents,
      totalRevenueFormatted: formatPrice(totalRevenueCents),
      averageTicketCents,
      averageTicketFormatted: formatPrice(averageTicketCents),
      totalDeliveries,
      totalCancellations,
      totalOrdersCount,
      deliverySuccessRate,
      cancellationRate,
      averageDispatchTimeDays,
      chartData,
      statusBreakdown,
      categoryBreakdown,
      cancellationReasons,
    }
  }, [filteredOrders, dateRange])

  return {
    summary,
    loading: directOrdersLoading,
    error: directOrdersError,
    refetch: () => {},
  }
}

/**
 * Legacy compatibility projection. Production reporting uses OrderReportPanel and the persisted report API;
 * and recent activity from real orders and catalog state.
 */
export function useSupplierData(): SupplierDataResult {
  const { user } = useAuth()
  const {
    directOrders,
    directOrdersLoading,
    directOrdersError,
    marketOrders,
    offers,
  } = useMarket()
  const { products } = useProducts()

  const supplier = useMemo(() => {
    return {
      name: user?.displayName || 'Fornecedor',
      email: user?.email || '',

    }
  }, [user])

  const metrics = useMemo<SupplierMetrics>(() => {
    // Orders to include in calculations
    const allOrders = directOrders || []
    const totalOrdersCount = allOrders.length

    // Active (non-cancelled) orders
    const nonCancelledOrders = allOrders.filter((o) => o.status !== 'cancelado')
    const cancelledOrders = allOrders.filter((o) => o.status === 'cancelado')
    const confirmedOrders = allOrders.filter((o) => o.status === 'confirmado')
    const pendingOrders = allOrders.filter((o) => o.status === 'aguardando')

    // Gross Revenue in centavos
    const totalRevenueCents = nonCancelledOrders.reduce((sum, o) => sum + (o.price || 0), 0)

    // Average Ticket in centavos
    const nonCancelledCount = nonCancelledOrders.length
    const averageTicketCents = nonCancelledCount > 0 ? Math.round(totalRevenueCents / nonCancelledCount) : 0

    // Deliveries: confirmed + active fulfillments
    const totalDeliveries = confirmedOrders.length
    const totalCancellations = cancelledOrders.length

    // Rates
    const cancellationRate = totalOrdersCount > 0
      ? Number(((totalCancellations / totalOrdersCount) * 100).toFixed(1))
      : 0
    const deliverySuccessRate = totalOrdersCount > 0
      ? Number((((totalOrdersCount - totalCancellations) / totalOrdersCount) * 100).toFixed(1))
      : 100

    // No persisted comparison period: never present estimates as observed metrics.
    const revenueChangePercent = null
    const ticketChangePercent = null
    const deliveriesChangePercent = null
    const cancellationsChangePercent = null
    const revenueSparkline: MetricSparklinePoint[] = []
    const ticketSparkline: MetricSparklinePoint[] = []
    const deliveriesSparkline: MetricSparklinePoint[] = []
    const cancellationsSparkline: MetricSparklinePoint[] = []

    return {
      totalRevenueCents,
      totalRevenueFormatted: formatPrice(totalRevenueCents),
      revenueChangePercent,
      averageTicketCents,
      averageTicketFormatted: formatPrice(averageTicketCents),
      ticketChangePercent,
      totalDeliveries,
      deliveriesChangePercent,
      deliverySuccessRate,
      totalCancellations,
      cancellationRate,
      cancellationsChangePercent,
      totalOrdersCount,
      pendingOrdersCount: pendingOrders.length,
      confirmedOrdersCount: confirmedOrders.length,
      sparklines: {
        revenue: revenueSparkline,
        averageTicket: ticketSparkline,
        deliveries: deliveriesSparkline,
        cancellations: cancellationsSparkline,
      },
    }
  }, [directOrders])

  const recentOrders = useMemo<RecentOrderItem[]>(() => {
    const list = [...(directOrders || [])]
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return list.slice(0, 5).map((order) => {
      let statusLabel = 'Aguardando'
      let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'

      if (order.status === 'confirmado') {
        statusLabel = 'Confirmado'
        statusVariant = 'default'
      } else if (order.status === 'cancelado') {
        statusLabel = 'Cancelado'
        statusVariant = 'destructive'
      }

      const buyerLocation = `${order.buyerCity || 'São Paulo'}, ${order.buyerState || 'SP'}`

      return {
        id: order.id,
        product: order.product,
        quantity: order.quantity,
        unit: order.unit,
        priceCents: order.price,
        priceFormatted: formatPrice(order.price),
        buyerLocation,
        createdAt: order.createdAt,
        status: order.status,
        statusLabel,
        statusVariant,
      }
    })
  }, [directOrders])

  const catalogSummary = useMemo(() => {
    const total = products.length
    const active = products.length
    return {
      totalProducts: total,
      activeProducts: active,
    }
  }, [products])

  return {
    supplier,
    metrics,
    recentOrders,
    catalogSummary,
    loading: directOrdersLoading,
    error: directOrdersError,
    directOrders,
    marketOrders,
    offers,
  }
}
