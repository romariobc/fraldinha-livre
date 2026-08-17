'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type MetricVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'

export interface SparklinePoint {
  date?: string
  value: number
}

export interface MetricChange {
  value: number | string
  label?: string
  isPositiveGood?: boolean
  trend?: 'up' | 'down' | 'neutral'
}

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: MetricChange | number | string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  icon?: LucideIcon | React.ComponentType<{ className?: string }>
  sparklineData?: SparklinePoint[] | number[]
  sparklineColor?: string
  variant?: MetricVariant
  className?: string
  loading?: boolean
  'data-testid'?: string
}

const VARIANT_CONFIGS: Record<
  MetricVariant,
  {
    stroke: string
    stopColor: string
    iconBg: string
    iconColor: string
    badgeBg: string
    badgeText: string
  }
> = {
  primary: {
    stroke: '#2A9FD4',
    stopColor: '#5BBFEA',
    iconBg: 'bg-primary/10 border-primary/20',
    iconColor: 'text-primary-dark',
    badgeBg: 'bg-primary-light text-primary-dark border-primary/20',
    badgeText: 'text-primary-dark',
  },
  info: {
    stroke: '#0284c7',
    stopColor: '#38bdf8',
    iconBg: 'bg-sky-50 border-sky-100',
    iconColor: 'text-sky-600',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    badgeText: 'text-sky-700',
  },
  success: {
    stroke: '#16a34a',
    stopColor: '#22c55e',
    iconBg: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeText: 'text-emerald-700',
  },
  danger: {
    stroke: '#dc2626',
    stopColor: '#ef4444',
    iconBg: 'bg-rose-50 border-rose-100',
    iconColor: 'text-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeText: 'text-rose-700',
  },
  warning: {
    stroke: '#d97706',
    stopColor: '#f59e0b',
    iconBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeText: 'text-amber-700',
  },
  default: {
    stroke: '#64748b',
    stopColor: '#94a3b8',
    iconBg: 'bg-slate-100 border-slate-200',
    iconColor: 'text-slate-600',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeText: 'text-slate-700',
  },
}

/**
 * Builds smooth cubic Bézier SVG path definitions for Area & Line Sparklines.
 */
function generateSparklinePaths(
  data: SparklinePoint[],
  width = 120,
  height = 40,
  padding = 4
) {
  if (!data || data.length === 0) {
    return { linePath: '', areaPath: '', points: [] }
  }

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min === 0 ? 1 : max - min

  const usableHeight = height - padding * 2
  const points = data.map((item, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width
    const y = height - padding - ((item.value - min) / range) * usableHeight
    return { x, y, item }
  })

  if (points.length === 1) {
    const p = points[0]
    return {
      linePath: `M 0,${p.y} L ${width},${p.y}`,
      areaPath: `M 0,${p.y} L ${width},${p.y} L ${width},${height} L 0,${height} Z`,
      points,
    }
  }

  // Smooth monotone spline
  let linePath = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cp1x = prev.x + (curr.x - prev.x) / 2
    const cp1y = prev.y
    const cp2x = prev.x + (curr.x - prev.x) / 2
    const cp2y = curr.y
    linePath += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`
  }

  const last = points[points.length - 1]
  const areaPath = `${linePath} L ${last.x.toFixed(2)},${height} L 0,${height} Z`

  return { linePath, areaPath, points }
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  badge,
  icon: Icon,
  sparklineData,
  sparklineColor,
  variant = 'primary',
  className,
  loading = false,
  'data-testid': testId,
}: MetricCardProps) {
  const gradientId = React.useId().replace(/:/g, '')
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    x: number
    y: number
    label?: string
    value: number
  } | null>(null)

  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.default
  const strokeColor = sparklineColor || config.stroke
  const fillColor = sparklineColor || config.stopColor

  // Parse change prop
  const parsedChange = React.useMemo(() => {
    if (change === undefined || change === null) return null

    if (typeof change === 'number' || typeof change === 'string') {
      const numVal = typeof change === 'number' ? change : parseFloat(change.replace(/[^0-9.-]+/g, ''))
      const isPos = numVal > 0
      const isNeg = numVal < 0
      const formatted = typeof change === 'number' ? `${isPos ? '+' : ''}${change.toFixed(1)}%` : change

      return {
        formatted,
        trend: isPos ? ('up' as const) : isNeg ? ('down' as const) : ('neutral' as const),
        isPositiveGood: true,
        label: 'vs mês anterior',
      }
    }

    const val = change.value
    const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''))
    const isPos = numVal > 0
    const isNeg = numVal < 0
    const trend = change.trend || (isPos ? 'up' : isNeg ? 'down' : 'neutral')
    const formatted = typeof val === 'number' ? `${isPos ? '+' : ''}${val.toFixed(1)}%` : String(val)

    return {
      formatted,
      trend,
      isPositiveGood: change.isPositiveGood ?? true,
      label: change.label || 'vs mês anterior',
    }
  }, [change])

  // Normalize sparkline data
  const normalizedData: SparklinePoint[] = React.useMemo(() => {
    if (!sparklineData || sparklineData.length === 0) return []
    if (typeof sparklineData[0] === 'number') {
      return (sparklineData as number[]).map((v, i) => ({
        date: `P${i + 1}`,
        value: v,
      }))
    }
    return sparklineData as SparklinePoint[]
  }, [sparklineData])

  const { linePath, areaPath, points } = React.useMemo(
    () => generateSparklinePaths(normalizedData, 120, 42, 4),
    [normalizedData]
  )

  // Trend color determination
  const trendColorClass = React.useMemo(() => {
    if (!parsedChange) return ''
    if (parsedChange.trend === 'neutral') return 'text-muted-foreground bg-slate-100'
    const isGood =
      (parsedChange.trend === 'up' && parsedChange.isPositiveGood) ||
      (parsedChange.trend === 'down' && !parsedChange.isPositiveGood)

    return isGood
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-rose-700 bg-rose-50 border-rose-200'
  }, [parsedChange])

  return (
    <Card
      data-testid={testId}
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:shadow-card bg-card border-border/80',
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-2">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
            ) : (
              <div className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {value}
              </div>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-xl border shadow-2xs shrink-0',
              config.iconBg,
              config.iconColor
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-3">
        {/* Change Indicator / Badges */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {parsedChange && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold',
                trendColorClass
              )}
            >
              {parsedChange.trend === 'up' && <TrendingUp className="size-3 shrink-0" />}
              {parsedChange.trend === 'down' && <TrendingDown className="size-3 shrink-0" />}
              {parsedChange.trend === 'neutral' && <Minus className="size-3 shrink-0" />}
              <span>{parsedChange.formatted}</span>
            </span>
          )}

          {badge && (
            <Badge variant={badge.variant || 'secondary'} className="text-[11px] font-semibold">
              {badge.text}
            </Badge>
          )}

          {parsedChange?.label && (
            <span className="text-muted-foreground text-[11px] truncate">
              {parsedChange.label}
            </span>
          )}

          {!parsedChange && subtitle && (
            <span className="text-muted-foreground text-[11px] truncate">
              {subtitle}
            </span>
          )}
        </div>

        {/* Embedded Responsive Sparkline */}
        {normalizedData.length > 0 && (
          <div className="pt-2 relative">
            <div className="h-11 w-full relative">
              <svg
                viewBox="0 0 120 42"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
                aria-label={`Gráfico sparkline para ${title}`}
              >
                <defs>
                  <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fillColor} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                {/* Area Gradient Fill */}
                <path d={areaPath} fill={`url(#grad-${gradientId})`} />

                {/* Smooth Curve Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive points & hover tooltips */}
                {points.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint?.x === pt.x ? 3.5 : 2}
                    className="transition-all cursor-pointer"
                    fill={hoveredPoint?.x === pt.x ? strokeColor : 'transparent'}
                    stroke={hoveredPoint?.x === pt.x ? '#ffffff' : 'transparent'}
                    strokeWidth="1.5"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: pt.x,
                        y: pt.y,
                        label: pt.item.date,
                        value: pt.item.value,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none -top-7 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-md whitespace-nowrap z-20"
                  style={{
                    left: `${(hoveredPoint.x / 120) * 100}%`,
                  }}
                >
                  {hoveredPoint.label ? `${hoveredPoint.label}: ` : ''}
                  {hoveredPoint.value.toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export default MetricCard
