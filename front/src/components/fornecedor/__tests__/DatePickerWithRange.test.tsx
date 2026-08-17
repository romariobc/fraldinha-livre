/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import {
  DatePickerWithRange,
  formatPtBrDate,
  formatDateRangeLabel,
  DATE_PRESETS,
} from '../DatePickerWithRange'

describe('DatePickerWithRange Component', () => {
  it('formats dates in pt-BR DD/MM/YYYY format correctly', () => {
    const d = new Date(2026, 7, 15) // 15 Aug 2026
    expect(formatPtBrDate(d)).toBe('15/08/2026')
  })

  it('formats date range label accurately', () => {
    expect(formatDateRangeLabel(undefined)).toBe('Selecione o período')

    const singleDate = { from: new Date(2026, 7, 1) }
    expect(formatDateRangeLabel(singleDate)).toBe('01/08/2026 - Hoje')

    const fullRange = {
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 15),
    }
    expect(formatDateRangeLabel(fullRange)).toBe('01/08/2026 - 15/08/2026')
  })

  it('renders trigger button displaying selected range', () => {
    const range = {
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 15),
    }
    render(<DatePickerWithRange date={range} onDateChange={vi.fn()} />)

    expect(screen.getByTestId('date-range-picker-trigger')).toHaveTextContent(
      '01/08/2026 - 15/08/2026'
    )
  })

  it('provides all standard date presets including Últimos 7 dias, 30 dias, Este Mês, 90 dias, Todo o Período', () => {
    expect(DATE_PRESETS).toHaveLength(7)

    const presetKeys = DATE_PRESETS.map((p) => p.key)
    expect(presetKeys).toContain('7d')
    expect(presetKeys).toContain('30d')
    expect(presetKeys).toContain('this_month')
    expect(presetKeys).toContain('90d')
    expect(presetKeys).toContain('all')

    DATE_PRESETS.forEach((preset) => {
      const range = preset.getRange()
      expect(range.from).toBeInstanceOf(Date)
      expect(range.to).toBeInstanceOf(Date)
      expect(range.from!.getTime()).toBeLessThanOrEqual(range.to!.getTime())
    })
  })

  it('clears range when clear button is clicked', () => {
    const handleDateChange = vi.fn()
    const range = {
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 15),
    }

    render(<DatePickerWithRange date={range} onDateChange={handleDateChange} />)

    const clearBtn = screen.getByTestId('clear-date-range-btn')
    fireEvent.click(clearBtn)

    expect(handleDateChange).toHaveBeenCalledWith(undefined)
  })

  it('opens popover and allows selecting a preset', () => {
    const handleDateChange = vi.fn()
    render(<DatePickerWithRange date={undefined} onDateChange={handleDateChange} />)

    const trigger = screen.getByTestId('date-range-picker-trigger')
    fireEvent.click(trigger)

    const preset7d = screen.getByTestId('preset-7d')
    expect(preset7d).toBeInTheDocument()
    fireEvent.click(preset7d)

    expect(handleDateChange).toHaveBeenCalled()
    const calledWith = handleDateChange.mock.calls[0][0]
    expect(calledWith).toHaveProperty('from')
    expect(calledWith).toHaveProperty('to')
  })
})
