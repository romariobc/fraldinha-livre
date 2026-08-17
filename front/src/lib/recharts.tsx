'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ResponsiveContainerProps {
  children: React.ReactNode
  width?: string | number
  height?: string | number
  minWidth?: string | number
  minHeight?: string | number
  className?: string
  style?: React.CSSProperties
  aspect?: number
}

export function ResponsiveContainer({
  children,
  width = '100%',
  height = '100%',
  minHeight,
  minWidth,
  className,
  style,
}: ResponsiveContainerProps) {
  const containerStyle: React.CSSProperties = {
    width,
    height,
    minHeight,
    minWidth,
    position: 'relative',
    ...style,
  }

  return (
    <div
      data-slot="recharts-responsive-container"
      className={className}
      style={containerStyle}
    >
      {children}
    </div>
  )
}

export interface ChartProps {
  data?: Record<string, unknown>[]
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
  children?: React.ReactNode
  className?: string
  width?: number
  height?: number
  onClick?: (data: unknown) => void
}

export interface BarProps {
  dataKey: string
  name?: string
  fill?: string
  radius?: number | [number, number, number, number]
  maxBarSize?: number
  yAxisId?: string | number
  stackId?: string
}

export function Bar(_props: BarProps) {
  void _props
  return null
}
Bar.displayName = 'Bar'

export interface LineProps {
  dataKey: string
  name?: string
  type?: string
  stroke?: string
  strokeWidth?: number
  dot?: boolean | object
  activeDot?: boolean | object
  yAxisId?: string | number
}

export function Line(_props: LineProps) {
  void _props
  return null
}
Line.displayName = 'Line'

export interface AreaProps {
  dataKey: string
  name?: string
  type?: string
  stroke?: string
  fill?: string
  fillOpacity?: number
  strokeWidth?: number
  yAxisId?: string | number
  stackId?: string
}

export function Area(_props: AreaProps) {
  void _props
  return null
}
Area.displayName = 'Area'

export interface XAxisProps {
  dataKey?: string
  tickLine?: boolean
  axisLine?: boolean
  tick?: unknown
  dy?: number
  tickFormatter?: (value: unknown) => string
  stroke?: string
}

export function XAxis(_props: XAxisProps) {
  void _props
  return null
}
XAxis.displayName = 'XAxis'

export interface YAxisProps {
  yAxisId?: string | number
  orientation?: 'left' | 'right'
  domain?: [number | string, number | string] | unknown[]
  tickLine?: boolean
  axisLine?: boolean
  tick?: unknown
  tickFormatter?: (value: unknown) => string
  allowDecimals?: boolean
  stroke?: string
}

export function YAxis(_props: YAxisProps) {
  void _props
  return null
}
YAxis.displayName = 'YAxis'

export interface CartesianGridProps {
  strokeDasharray?: string
  vertical?: boolean
  horizontal?: boolean
  stroke?: string
}

export function CartesianGrid(_props: CartesianGridProps) {
  void _props
  return null
}
CartesianGrid.displayName = 'CartesianGrid'

export interface TooltipContentPayloadItem {
  name: string
  value: unknown
  color: string
  dataKey: string
}

export interface TooltipContentProps {
  active?: boolean
  payload?: TooltipContentPayloadItem[]
  label?: string
}

export interface TooltipProps {
  content?: React.ReactNode | ((props: TooltipContentProps) => React.ReactNode) | React.ComponentType<TooltipContentProps>
  formatter?: (value: unknown, name?: string, item?: unknown, index?: number) => unknown
  labelFormatter?: (label: unknown) => React.ReactNode
}

export function Tooltip(_props: TooltipProps) {
  void _props
  return null
}
Tooltip.displayName = 'Tooltip'

export interface LegendProps {
  verticalAlign?: 'top' | 'bottom' | 'middle'
  align?: 'left' | 'center' | 'right'
  iconType?: string
  wrapperStyle?: React.CSSProperties
}

export function Legend(_props: LegendProps) {
  void _props
  return null
}
Legend.displayName = 'Legend'

function BaseChart({
  data = [],
  margin = { top: 10, right: 10, left: 10, bottom: 20 },
  children,
  className,
}: ChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  // Extract chart configuration from child elements
  const childrenArray = React.Children.toArray(children)
  const barElements: React.ReactElement<BarProps>[] = []
  const lineElements: React.ReactElement<LineProps>[] = []
  const areaElements: React.ReactElement<AreaProps>[] = []
  let xAxisElement: React.ReactElement<XAxisProps> | null = null
  let leftYAxis: React.ReactElement<YAxisProps> | null = null
  let rightYAxis: React.ReactElement<YAxisProps> | null = null
  let gridElement: React.ReactElement<CartesianGridProps> | null = null
  let tooltipElement: React.ReactElement<TooltipProps> | null = null
  let legendElement: React.ReactElement<LegendProps> | null = null
  const defsElements: React.ReactNode[] = []

  for (const child of childrenArray) {
    if (!React.isValidElement(child)) continue
    const type = (child.type as { displayName?: string })?.displayName || child.type

    if (type === 'Bar' || (child.props && typeof child.props === 'object' && 'dataKey' in child.props && child.type === Bar)) {
      barElements.push(child as React.ReactElement<BarProps>)
    } else if (type === 'Line' || (child.props && typeof child.props === 'object' && 'dataKey' in child.props && child.type === Line)) {
      lineElements.push(child as React.ReactElement<LineProps>)
    } else if (type === 'Area' || (child.props && typeof child.props === 'object' && 'dataKey' in child.props && child.type === Area)) {
      areaElements.push(child as React.ReactElement<AreaProps>)
    } else if (type === 'XAxis' || child.type === XAxis) {
      xAxisElement = child as React.ReactElement<XAxisProps>
    } else if (type === 'YAxis' || child.type === YAxis) {
      const yProps = child.props as YAxisProps
      const ori = yProps?.orientation || 'left'
      if (ori === 'right') {
        rightYAxis = child as React.ReactElement<YAxisProps>
      } else {
        leftYAxis = child as React.ReactElement<YAxisProps>
      }
    } else if (type === 'CartesianGrid' || child.type === CartesianGrid) {
      gridElement = child as React.ReactElement<CartesianGridProps>
    } else if (type === 'Tooltip' || child.type === Tooltip) {
      tooltipElement = child as React.ReactElement<TooltipProps>
    } else if (type === 'Legend' || child.type === Legend) {
      legendElement = child as React.ReactElement<LegendProps>
    } else if (typeof child.type === 'string' && child.type === 'defs') {
      defsElements.push(child)
    }
  }

  // Dimensions & bounds
  const width = 800
  const height = 280
  const padLeft = margin.left ?? 20
  const padRight = margin.right ?? 20
  const padTop = margin.top ?? 20
  const padBottom = margin.bottom ?? 30

  const plotWidth = Math.max(10, width - padLeft - padRight)
  const plotHeight = Math.max(10, height - padTop - padBottom)

  // Compute maximums for left Y Axis (bar/deliveries/counts)
  let maxLeft = 1
  for (const item of data) {
    barElements.forEach((bar) => {
      const val = Number(item[bar.props.dataKey]) || 0
      if (val > maxLeft) maxLeft = val
    })
    areaElements.forEach((area) => {
      if (!area.props.yAxisId || area.props.yAxisId === 'left') {
        const val = Number(item[area.props.dataKey]) || 0
        if (val > maxLeft) maxLeft = val
      }
    })
    lineElements.forEach((line) => {
      if (!line.props.yAxisId || line.props.yAxisId === 'left') {
        const val = Number(item[line.props.dataKey]) || 0
        if (val > maxLeft) maxLeft = val
      }
    })
  }
  // Round up maxLeft nicely
  maxLeft = Math.ceil(maxLeft * 1.15) || 10

  // Right Y Axis (e.g. percentages 0-100)
  const maxRight = 100

  // Calculate coordinates for points
  const numItems = Math.max(1, data.length)
  const slotWidth = plotWidth / numItems
  const xKey = xAxisElement?.props?.dataKey || 'date'

  return (
    <div className={cn('relative w-full h-full flex flex-col select-none', className)} data-slot="composed-chart">
      {/* Optional Legend Header */}
      {legendElement && (
        <div
          className="flex items-center justify-end gap-4 text-xs text-muted-foreground pb-2 px-2"
          style={legendElement.props.wrapperStyle}
        >
          {barElements.map((b) => (
            <div key={b.props.dataKey} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full inline-block"
                style={{ backgroundColor: b.props.fill || '#2A9FD4' }}
              />
              <span>{b.props.name || b.props.dataKey}</span>
            </div>
          ))}
          {lineElements.map((l) => (
            <div key={l.props.dataKey} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full inline-block"
                style={{ backgroundColor: l.props.stroke || '#10b981' }}
              />
              <span>{l.props.name || l.props.dataKey}</span>
            </div>
          ))}
          {areaElements.map((a) => (
            <div key={a.props.dataKey} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full inline-block"
                style={{ backgroundColor: a.props.stroke || '#2A9FD4' }}
              />
              <span>{a.props.name || a.props.dataKey}</span>
            </div>
          ))}
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative w-full flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>{defsElements}</defs>

          {/* Grid lines */}
          {gridElement && (
            <g className="recharts-cartesian-grid" opacity={0.4}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = padTop + plotHeight * pct
                return (
                  <line
                    key={i}
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-border"
                  />
                )
              })}
            </g>
          )}

          {/* Area charts */}
          {areaElements.map((area) => {
            const isRight = area.props.yAxisId === 'right'
            const maxY = isRight ? maxRight : maxLeft
            const strokeColor = area.props.stroke || '#2A9FD4'
            const fillColor = area.props.fill || strokeColor

            const pts = data.map((item, i) => {
              const x = padLeft + slotWidth * i + slotWidth / 2
              const val = Number(item[area.props.dataKey]) || 0
              const y = padTop + plotHeight - (val / maxY) * plotHeight
              return { x, y }
            })

            if (pts.length === 0) return null

            let pathD = `M ${pts[0].x},${pts[0].y}`
            for (let i = 1; i < pts.length; i++) {
              pathD += ` L ${pts[i].x},${pts[i].y}`
            }
            const areaD = `${pathD} L ${pts[pts.length - 1].x},${padTop + plotHeight} L ${pts[0].x},${padTop + plotHeight} Z`

            return (
              <g key={area.props.dataKey} className="recharts-area-group">
                <path d={areaD} fill={fillColor} fillOpacity={area.props.fillOpacity ?? 0.3} />
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={area.props.strokeWidth || 2}
                  strokeLinecap="round"
                />
              </g>
            )
          })}

          {/* Bar charts */}
          {barElements.map((bar, barIdx) => {
            const numBars = barElements.length
            const barWidth = Math.min(
              bar.props.maxBarSize || 32,
              (slotWidth * 0.7) / Math.max(1, numBars)
            )

            return (
              <g key={bar.props.dataKey} className="recharts-bar-group">
                {data.map((item, itemIdx) => {
                  const val = Number(item[bar.props.dataKey]) || 0
                  const barH = (val / maxLeft) * plotHeight
                  const slotCenter = padLeft + slotWidth * itemIdx + slotWidth / 2
                  const totalBarsWidth = numBars * barWidth + (numBars - 1) * 3
                  const barLeft = slotCenter - totalBarsWidth / 2 + barIdx * (barWidth + 3)
                  const barTop = padTop + plotHeight - barH

                  return (
                    <rect
                      key={itemIdx}
                      x={barLeft}
                      y={barTop}
                      width={barWidth}
                      height={Math.max(2, barH)}
                      fill={bar.props.fill || '#2A9FD4'}
                      rx={Array.isArray(bar.props.radius) ? bar.props.radius[0] : bar.props.radius || 3}
                      className="transition-all duration-150"
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Line charts */}
          {lineElements.map((line) => {
            const isRight = line.props.yAxisId === 'right'
            const maxY = isRight ? maxRight : maxLeft
            const strokeColor = line.props.stroke || '#10b981'

            const pts = data.map((item, i) => {
              const x = padLeft + slotWidth * i + slotWidth / 2
              const val = Number(item[line.props.dataKey]) || 0
              const y = padTop + plotHeight - (val / maxY) * plotHeight
              return { x, y, val }
            })

            if (pts.length === 0) return null

            let pathD = `M ${pts[0].x},${pts[0].y}`
            for (let i = 1; i < pts.length; i++) {
              const prev = pts[i - 1]
              const curr = pts[i]
              const cp1x = prev.x + (curr.x - prev.x) / 2
              const cp1y = prev.y
              const cp2x = prev.x + (curr.x - prev.x) / 2
              const cp2y = curr.y
              pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`
            }

            return (
              <g key={line.props.dataKey} className="recharts-line-group">
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={line.props.strokeWidth || 2.5}
                  strokeLinecap="round"
                />
                {pts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredIndex === idx ? 5 : 3.5}
                    fill={strokeColor}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            )
          })}

          {/* Interactive Hover Zones */}
          {data.map((_, idx) => {
            const x = padLeft + slotWidth * idx
            return (
              <rect
                key={`hit-${idx}`}
                x={x}
                y={padTop}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredIndex(idx)
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null)
                }}
              />
            )
          })}

          {/* X Axis Labels */}
          {xAxisElement && (
            <g className="recharts-x-axis" fontSize={11} fill="currentColor">
              {data.map((item, idx) => {
                const x = padLeft + slotWidth * idx + slotWidth / 2
                const y = padTop + plotHeight + 18
                const label = String(item[xKey] ?? '')
                return (
                  <text
                    key={idx}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {label}
                  </text>
                )
              })}
            </g>
          )}

          {/* Left Y Axis Labels */}
          {leftYAxis && (
            <g className="recharts-y-axis-left" fontSize={10} fill="currentColor">
              {[0, 0.5, 1].map((pct, i) => {
                const val = Math.round(maxLeft * (1 - pct))
                const y = padTop + plotHeight * pct + 3
                return (
                  <text
                    key={i}
                    x={padLeft - 6}
                    y={y}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {val}
                  </text>
                )
              })}
            </g>
          )}

          {/* Right Y Axis Labels */}
          {rightYAxis && (
            <g className="recharts-y-axis-right" fontSize={10} fill="currentColor">
              {[0, 0.5, 1].map((pct, i) => {
                const val = Math.round(100 * (1 - pct))
                const y = padTop + plotHeight * pct + 3
                return (
                  <text
                    key={i}
                    x={width - padRight + 6}
                    y={y}
                    textAnchor="start"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {val}%
                  </text>
                )
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Render Custom Tooltip when Hovered */}
      {hoveredIndex !== null && tooltipElement && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${((padLeft + slotWidth * hoveredIndex + slotWidth / 2) / width) * 100}%`,
            top: `${(padTop / height) * 100}%`,
          }}
        >
          {(() => {
            const item = data[hoveredIndex]
            const payload: TooltipContentPayloadItem[] = [
              ...barElements.map((b) => ({
                name: b.props.name || b.props.dataKey,
                value: item[b.props.dataKey] ?? 0,
                color: b.props.fill || '#2A9FD4',
                dataKey: b.props.dataKey,
              })),
              ...lineElements.map((l) => ({
                name: l.props.name || l.props.dataKey,
                value: item[l.props.dataKey] ?? 0,
                color: l.props.stroke || '#10b981',
                dataKey: l.props.dataKey,
              })),
              ...areaElements.map((a) => ({
                name: a.props.name || a.props.dataKey,
                value: item[a.props.dataKey] ?? 0,
                color: a.props.stroke || '#2A9FD4',
                dataKey: a.props.dataKey,
              })),
            ]

            const content = tooltipElement.props.content
            const tooltipProps: TooltipContentProps = {
              active: true,
              payload,
              label: String(item.label || item[xKey] || ''),
            }

            if (typeof content === 'function') {
              return (content as (props: TooltipContentProps) => React.ReactNode)(tooltipProps)
            } else if (React.isValidElement(content)) {
              return React.cloneElement(content as React.ReactElement<TooltipContentProps>, tooltipProps)
            } else if (typeof content === 'string' || typeof content === 'number') {
              return <div>{content}</div>
            } else if (content) {
              const ContentComp = content as unknown as React.ComponentType<TooltipContentProps>
              return <ContentComp {...tooltipProps} />
            }
            return (
              <div className="bg-popover border border-border p-2 rounded shadow-md text-xs">
                {String(item[xKey] ?? '')}: {JSON.stringify(payload)}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function ComposedChart(props: ChartProps) {
  return <BaseChart {...props} />
}
ComposedChart.displayName = 'ComposedChart'

export function BarChart(props: ChartProps) {
  return <BaseChart {...props} />
}
BarChart.displayName = 'BarChart'

export function AreaChart(props: ChartProps) {
  return <BaseChart {...props} />
}
AreaChart.displayName = 'AreaChart'

export function LineChart(props: ChartProps) {
  return <BaseChart {...props} />
}
LineChart.displayName = 'LineChart'
