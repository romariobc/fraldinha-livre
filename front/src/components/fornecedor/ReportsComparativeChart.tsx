'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from 'recharts'
import { CheckCircle2, XCircle, TrendingUp, BarChart2, Layers } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ReportDataPoint {
  date: string
  label?: string
  deliveries: number
  cancellations: number
  successRate?: number
  revenue?: number
  totalOrders?: number
}

export type ChartMetricView = 'all' | 'deliveries' | 'cancellations' | 'success_rate'
export type ChartType = 'composed' | 'bar' | 'area'

export interface ReportsComparativeChartProps {
  data: ReportDataPoint[]
  title?: string
  description?: string
  className?: string
  loading?: boolean
  'data-testid'?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    dataKey: string
  }>
  label?: string
}

export function CustomReportsTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const deliveriesItem = payload.find((p) => p.dataKey === 'deliveries')
  const cancellationsItem = payload.find((p) => p.dataKey === 'cancellations')
  const successRateItem = payload.find((p) => p.dataKey === 'successRate')

  const deliveries = deliveriesItem ? deliveriesItem.value : 0
  const cancellations = cancellationsItem ? cancellationsItem.value : 0
  const total = deliveries + cancellations
  const rate =
    successRateItem?.value !== undefined
      ? successRateItem.value
      : total > 0
      ? Number(((deliveries / total) * 100).toFixed(1))
      : 100

  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 p-3.5 shadow-xl backdrop-blur-md text-xs min-w-[200px] z-50">
      <div className="font-bold text-foreground pb-2 mb-2 border-b border-border/60 flex items-center justify-between">
        <span>Período: {label}</span>
        <Badge variant={rate >= 90 ? 'secondary' : rate >= 75 ? 'outline' : 'destructive'} className="text-[10px] h-4">
          {rate}% sucesso
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-3.5" />
            Entregas Concluídas:
          </span>
          <span className="font-bold">{deliveries}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
          <span className="flex items-center gap-1.5 font-medium">
            <XCircle className="size-3.5" />
            Cancelamentos:
          </span>
          <span className="font-bold">{cancellations}</span>
        </div>

        <div className="pt-1.5 mt-1.5 border-t border-border/40 flex items-center justify-between text-muted-foreground font-medium">
          <span>Total de Movimentações:</span>
          <span className="font-semibold text-foreground">{total} pedidos</span>
        </div>
      </div>
    </div>
  )
}

export function ReportsComparativeChart({
  data = [],
  title = 'Comparativo: Entregas vs Cancelamentos',
  description = 'Evolução temporal do volume de entregas bem-sucedidas vs cancelamentos operacionais.',
  className,
  loading = false,
  'data-testid': testId = 'reports-comparative-chart',
}: ReportsComparativeChartProps) {
  const [metricView, setMetricView] = React.useState<ChartMetricView>('all')
  const [chartType, setChartType] = React.useState<ChartType>('composed')

  // Calculate totals and summary metrics for the provided data
  const summary = React.useMemo(() => {
    let totalDeliveries = 0
    let totalCancellations = 0

    for (const d of data) {
      totalDeliveries += d.deliveries || 0
      totalCancellations += d.cancellations || 0
    }

    const totalOrders = totalDeliveries + totalCancellations
    const overallSuccessRate =
      totalOrders > 0 ? Number(((totalDeliveries / totalOrders) * 100).toFixed(1)) : 100

    return {
      totalDeliveries,
      totalCancellations,
      totalOrders,
      overallSuccessRate,
    }
  }, [data])

  // Augment data with calculated successRate if not explicitly provided
  const enrichedData = React.useMemo(() => {
    return data.map((item) => {
      const sum = (item.deliveries || 0) + (item.cancellations || 0)
      const calculatedRate =
        item.successRate !== undefined
          ? item.successRate
          : sum > 0
          ? Number((((item.deliveries || 0) / sum) * 100).toFixed(1))
          : 100

      return {
        ...item,
        successRate: calculatedRate,
      }
    })
  }, [data])

  return (
    <Card className={cn('border-border bg-card shadow-xs overflow-hidden', className)} data-testid={testId}>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2 text-foreground">
              <BarChart2 className="size-5 text-primary-dark" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          </div>

          {/* Quick Summary Pill on Header */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-[11px]">
              <CheckCircle2 className="size-3" />
              {summary.totalDeliveries} Entregues
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold text-[11px]">
              <XCircle className="size-3" />
              {summary.totalCancellations} Cancelados
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold text-[11px]">
              <TrendingUp className="size-3" />
              {summary.overallSuccessRate}% Sucesso
            </div>
          </div>
        </div>

        {/* View & Metric Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
          {/* Metric View Tabs */}
          <div className="inline-flex items-center rounded-lg bg-muted/40 p-0.5 text-muted-foreground" data-testid="metric-views-group">
            <button
              type="button"
              onClick={() => setMetricView('all')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                metricView === 'all'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'hover:text-foreground'
              )}
              data-testid="view-all-btn"
            >
              <Layers className="size-3" />
              Visão Geral
            </button>
            <button
              type="button"
              onClick={() => setMetricView('deliveries')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                metricView === 'deliveries'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'hover:text-foreground'
              )}
              data-testid="view-deliveries-btn"
            >
              <CheckCircle2 className="size-3 text-emerald-600" />
              Entregas
            </button>
            <button
              type="button"
              onClick={() => setMetricView('cancellations')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                metricView === 'cancellations'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'hover:text-foreground'
              )}
              data-testid="view-cancellations-btn"
            >
              <XCircle className="size-3 text-rose-600" />
              Cancelamentos
            </button>
            <button
              type="button"
              onClick={() => setMetricView('success_rate')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                metricView === 'success_rate'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'hover:text-foreground'
              )}
              data-testid="view-success-rate-btn"
            >
              <TrendingUp className="size-3 text-primary-dark" />
              Taxa (%)
            </button>
          </div>

          {/* Chart Type Toggle (Composto, Barras, Área) */}
          <div className="inline-flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-1">Visualização:</span>
            <Button
              type="button"
              variant={chartType === 'composed' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setChartType('composed')}
              className="text-xs h-7 px-2"
              data-testid="chart-type-composed"
            >
              Composto
            </Button>
            <Button
              type="button"
              variant={chartType === 'bar' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setChartType('bar')}
              className="text-xs h-7 px-2"
              data-testid="chart-type-bar"
            >
              Barras
            </Button>
            <Button
              type="button"
              variant={chartType === 'area' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setChartType('area')}
              className="text-xs h-7 px-2"
              data-testid="chart-type-area"
            >
              Área
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2">
        {loading ? (
          <div className="h-80 w-full flex items-center justify-center bg-muted/10 rounded-xl animate-pulse">
            <span className="text-xs text-muted-foreground font-medium">Carregando dados analíticos...</span>
          </div>
        ) : enrichedData.length === 0 ? (
          <div className="h-80 w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-center p-6">
            <BarChart2 className="size-10 text-muted-foreground/40 mb-2" />
            <h4 className="text-sm font-semibold text-foreground">Nenhum dado no período selecionado</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Ajuste o filtro de datas acima para visualizar as movimentações operacionais da sua distribuidora.
            </p>
          </div>
        ) : (
          <div className="h-80 w-full pt-4" data-testid="chart-container">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <ComposedChart
                data={enrichedData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  {/* Delivery gradients */}
                  <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2A9FD4" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#2A9FD4" stopOpacity={0.15} />
                  </linearGradient>
                  {/* Cancellation gradients */}
                  <linearGradient id="cancelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.15} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  dy={6}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  allowDecimals={false}
                />

                {metricView === 'all' && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                )}

                <Tooltip content={<CustomReportsTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                />

                {/* Renderings based on chartType and metricView */}
                {chartType === 'composed' && (
                  <>
                    {(metricView === 'all' || metricView === 'deliveries') && (
                      <Bar
                        yAxisId="left"
                        name="Entregas Concluídas"
                        dataKey="deliveries"
                        fill="#2A9FD4"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    )}
                    {(metricView === 'all' || metricView === 'cancellations') && (
                      <Bar
                        yAxisId="left"
                        name="Cancelamentos"
                        dataKey="cancellations"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    )}
                    {metricView === 'all' && (
                      <Line
                        yAxisId="right"
                        name="Taxa de Sucesso (%)"
                        type="monotone"
                        dataKey="successRate"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#10b981' }}
                        activeDot={{ r: 5 }}
                      />
                    )}
                    {metricView === 'success_rate' && (
                      <Line
                        yAxisId="left"
                        name="Taxa de Sucesso (%)"
                        type="monotone"
                        dataKey="successRate"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#10b981' }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </>
                )}

                {chartType === 'bar' && (
                  <>
                    {(metricView === 'all' || metricView === 'deliveries') && (
                      <Bar
                        yAxisId="left"
                        name="Entregas Concluídas"
                        dataKey="deliveries"
                        fill="#2A9FD4"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={45}
                      />
                    )}
                    {(metricView === 'all' || metricView === 'cancellations') && (
                      <Bar
                        yAxisId="left"
                        name="Cancelamentos"
                        dataKey="cancellations"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={45}
                      />
                    )}
                    {metricView === 'success_rate' && (
                      <Bar
                        yAxisId="left"
                        name="Taxa de Sucesso (%)"
                        dataKey="successRate"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={45}
                      />
                    )}
                  </>
                )}

                {chartType === 'area' && (
                  <>
                    {(metricView === 'all' || metricView === 'deliveries') && (
                      <Area
                        yAxisId="left"
                        name="Entregas Concluídas"
                        type="monotone"
                        dataKey="deliveries"
                        stroke="#2A9FD4"
                        fill="url(#deliveryGrad)"
                        strokeWidth={2}
                      />
                    )}
                    {(metricView === 'all' || metricView === 'cancellations') && (
                      <Area
                        yAxisId="left"
                        name="Cancelamentos"
                        type="monotone"
                        dataKey="cancellations"
                        stroke="#ef4444"
                        fill="url(#cancelGrad)"
                        strokeWidth={2}
                      />
                    )}
                    {metricView === 'success_rate' && (
                      <Area
                        yAxisId="left"
                        name="Taxa de Sucesso (%)"
                        type="monotone"
                        dataKey="successRate"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.2}
                        strokeWidth={2.5}
                      />
                    )}
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const ReportsChart = ReportsComparativeChart
export type ReportsChartProps = ReportsComparativeChartProps
export default ReportsComparativeChart
