import { describe, expect, it } from 'vitest'
import { OrderReportQuerySchema, defaultReportPeriod, reportMidnightUTC, reportDay, nextReportDay } from './report'
describe('MP-10 reporting calendar contract',()=>{
  it('uses Fortaleza instead of the host timezone at day/year boundaries',()=>{
    expect(reportDay('2026-01-01T02:59:59.999Z')).toBe('2025-12-31')
    expect(reportDay('2026-01-01T03:00:00Z')).toBe('2026-01-01')
    expect(reportMidnightUTC('2026-01-01')).toBe('2026-01-01T03:00:00.000Z')
    expect(defaultReportPeriod(new Date('2026-01-01T02:00:00Z'))).toEqual({from:'2025-12-02',to:'2025-12-31'})
    expect(nextReportDay('2028-02-28')).toBe('2028-02-29')
  })
  it('accepts inclusive leap-year periods of at most366 days',()=>{
    expect(OrderReportQuerySchema.safeParse({from:'2028-01-01',to:'2028-12-31'}).success).toBe(true)
    expect(OrderReportQuerySchema.safeParse({from:'2028-01-01',to:'2029-01-01'}).success).toBe(false)
    expect(OrderReportQuerySchema.safeParse({from:'0001-01-01',to:'0001-01-02'}).success).toBe(false)
    expect(OrderReportQuerySchema.safeParse({from:'9999-12-31',to:'9999-12-31'}).success).toBe(false)
    expect(OrderReportQuerySchema.safeParse({from:'2026-02-29',to:'2026-03-01'}).success).toBe(false)
  })
})
