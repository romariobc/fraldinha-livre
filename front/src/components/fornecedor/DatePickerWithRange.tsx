'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, type DateRange } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

export interface DatePickerWithRangeProps {
  date: DateRange | undefined
  onDateChange: (range: DateRange | undefined) => void
  className?: string
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  'data-testid'?: string
}

export type DatePresetKey = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'year' | 'all'

export interface DatePreset {
  key: DatePresetKey
  label: string
  getRange: () => DateRange
}

export function formatPtBrDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatDateRangeLabel(range?: DateRange): string {
  if (!range?.from) {
    return 'Selecione o período'
  }
  if (!range.to) {
    return `${formatPtBrDate(range.from)} - Hoje`
  }
  return `${formatPtBrDate(range.from)} - ${formatPtBrDate(range.to)}`
}

export const DATE_PRESETS: DatePreset[] = [
  {
    key: '7d',
    label: 'Últimos 7 dias',
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(to.getDate() - 6)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: '30d',
    label: 'Últimos 30 dias',
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(to.getDate() - 29)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: 'this_month',
    label: 'Este Mês',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: 'last_month',
    label: 'Mês Passado',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: '90d',
    label: 'Últimos 90 dias',
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(to.getDate() - 89)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: 'year',
    label: 'Ano Atual',
    getRange: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    key: 'all',
    label: 'Todo o Período',
    getRange: () => {
      const to = new Date()
      const from = new Date(2020, 0, 1, 0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
]

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
  align = 'end',
  disabled = false,
  'data-testid': testId = 'date-picker-with-range',
}: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelectPreset = (preset: DatePreset) => {
    const range = preset.getRange()
    onDateChange(range)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDateChange(undefined)
  }

  const isPresetActive = (preset: DatePreset): boolean => {
    if (!date?.from || !date?.to) return false
    const pr = preset.getRange()
    if (!pr.from || !pr.to) return false
    return (
      date.from.toDateString() === pr.from.toDateString() &&
      date.to.toDateString() === pr.to.toDateString()
    )
  }

  return (
    <div className={cn('grid gap-2', className)} data-testid={testId}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-testid="date-range-picker-trigger"
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-between gap-2 h-9 px-3 text-xs font-medium rounded-lg border border-border bg-card hover:bg-accent/60 transition-colors shadow-2xs text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
            !date && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="size-4 text-primary shrink-0" />
            <span className="truncate">{formatDateRangeLabel(date)}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {date && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpar filtro de data"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onDateChange(undefined)
                  }
                }}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                data-testid="clear-date-range-btn"
              >
                <X className="size-3" />
              </span>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </div>
        </PopoverTrigger>

        <PopoverContent
          align={align}
          className="w-auto p-0 border border-border shadow-lg rounded-xl bg-popover"
          data-testid="date-range-popover-content"
        >
          <div className="flex flex-col md:flex-row">
            {/* Presets Sidebar */}
            <div className="flex flex-col gap-1 p-3 border-b md:border-b-0 md:border-r border-border bg-muted/20 min-w-[150px]">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Atalhos
              </span>
              {DATE_PRESETS.map((preset) => {
                const active = isPresetActive(preset)
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      'text-left text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer',
                      active
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    data-testid={`preset-${preset.key}`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Interactive Calendar */}
            <div className="p-3">
              <Calendar
                mode="range"
                selected={date}
                onSelect={(newDate) => {
                  onDateChange(newDate as DateRange | undefined)
                }}
                numberOfMonths={1}
                className="border-0 shadow-none p-0"
              />

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    onDateChange(undefined)
                    setOpen(false)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={() => setOpen(false)}
                  className="text-xs bg-primary hover:bg-primary-dark text-primary-foreground"
                  data-testid="apply-date-range-btn"
                >
                  Aplicar Período
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
export default DatePickerWithRange
