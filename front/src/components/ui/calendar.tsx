"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type DateRange = {
  from?: Date
  to?: Date
}

export interface CalendarProps {
  className?: string
  classNames?: Record<string, string>
  mode?: "single" | "range"
  selected?: Date | DateRange
  onSelect?: (date: Date | DateRange | undefined) => void
  numberOfMonths?: number
  initialMonth?: Date
  disabled?: (date: Date) => boolean
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function isSameDay(d1?: Date, d2?: Date): boolean {
  if (!d1 || !d2) return false
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function isDateInRange(date: Date, range?: DateRange): boolean {
  if (!range?.from || !range?.to) return false
  const time = date.getTime()
  const fromTime = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime()
  const toTime = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate()).getTime()
  return time >= fromTime && time <= toTime
}

function Calendar({
  className,
  mode = "single",
  selected,
  onSelect,
  numberOfMonths = 1,
  initialMonth,
  disabled,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (initialMonth) return new Date(initialMonth)
    if (mode === "single" && selected instanceof Date) return new Date(selected)
    if (mode === "range" && (selected as DateRange)?.from) return new Date((selected as DateRange).from!)
    return new Date()
  })

  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleDayClick = (day: Date) => {
    if (disabled && disabled(day)) return

    if (mode === "single") {
      onSelect?.(day)
    } else if (mode === "range") {
      const range = (selected as DateRange) || {}
      if (!range.from || (range.from && range.to)) {
        onSelect?.({ from: day, to: undefined })
      } else if (range.from && !range.to) {
        if (day < range.from) {
          onSelect?.({ from: day, to: range.from })
        } else {
          onSelect?.({ from: range.from, to: day })
        }
      }
    }
  }

  const renderMonth = (monthOffset: number) => {
    const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (Date | null)[] = []
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    const range = mode === "range" ? (selected as DateRange) : undefined
    const singleDate = mode === "single" ? (selected as Date) : undefined

    return (
      <div key={monthOffset} className="space-y-4">
        <div className="flex items-center justify-between pt-1 relative">
          <div className="text-sm font-semibold text-foreground text-center w-full">
            {MONTHS_PT[month]} {year}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-medium">
          {DAYS_PT.map((d) => (
            <div key={d} className="h-8 flex items-center justify-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-8 w-8" />
            }

            const isSelected =
              (singleDate && isSameDay(day, singleDate)) ||
              (range?.from && isSameDay(day, range.from)) ||
              (range?.to && isSameDay(day, range.to))

            const inRange = range ? isDateInRange(day, range) : false
            const isRangeStart = range?.from ? isSameDay(day, range.from) : false
            const isRangeEnd = range?.to ? isSameDay(day, range.to) : false
            const isDisabled = disabled ? disabled(day) : false
            const isToday = isSameDay(day, new Date())

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={isDisabled}
                onClick={() => handleDayClick(day)}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-md transition-colors",
                  isToday && !isSelected && "border border-primary text-primary font-bold",
                  inRange && !isSelected && "bg-accent/40 text-accent-foreground rounded-none",
                  isRangeStart && "rounded-l-md rounded-r-none bg-primary text-primary-foreground hover:bg-primary",
                  isRangeEnd && "rounded-r-md rounded-l-none bg-primary text-primary-foreground hover:bg-primary",
                  isSelected && !inRange && "bg-primary text-primary-foreground hover:bg-primary",
                  isDisabled && "text-muted-foreground opacity-50 cursor-not-allowed"
                )}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      data-slot="calendar"
      className={cn("p-3 bg-popover rounded-xl border border-border shadow-xs relative", className)}
    >
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={prevMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100"
          )}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <button
          type="button"
          onClick={nextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100"
          )}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className={cn("flex flex-col sm:flex-row gap-6", numberOfMonths > 1 && "sm:gap-8")}>
        {Array.from({ length: numberOfMonths }).map((_, i) => renderMonth(i))}
      </div>
    </div>
  )
}

export { Calendar }
