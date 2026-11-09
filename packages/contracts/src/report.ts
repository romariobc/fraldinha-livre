import { z } from 'zod'
import { OrderStatusSchema } from './order'

export const REPORT_TIMEZONE = 'America/Fortaleza' as const
export const REPORT_CURRENCY = 'BRL' as const
export const MAX_REPORT_ROWS = 5000
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z')
  return value >= '1000-01-01' && value <= '9998-12-31' && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data inválida')
export const OrderReportQuerySchema = z.object({
  from: day.optional(), to: day.optional(), q: z.string().trim().max(100).default(''),
  status: OrderStatusSchema.optional(), supplierId: z.string().trim().min(1).max(128).optional(),
  timezone: z.literal(REPORT_TIMEZONE).default(REPORT_TIMEZONE),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.from) !== Boolean(value.to)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe início e fim juntos' })
  if (value.from && value.to) {
    const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000
    if (days < 0 || days >= 366) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Período deve ter de 1 a 366 dias' })
  }
})
export function reportDay(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
export function nextReportDay(value: string, offset = 1): string {
  const date = new Date(value + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function defaultReportPeriod(now = new Date()) {
  const to = reportDay(now)
  return { from: nextReportDay(to, -29), to }
}
export function reportMidnightUTC(value: string): string {
  const desired = Date.parse(value + 'T00:00:00Z')
  let utc = desired
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc))
    const n = (type: string) => Number(parts.find(p => p.type === type)!.value)
    const local = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
    if (local === desired) return new Date(utc).toISOString()
    utc -= local - desired
  }
  throw new Error('Limite de período indisponível neste fuso')
}
const money = z.number().int().nonnegative().safe()
export const ReportOrderSchema = z.object({
  id: z.string(), buyerId: z.string(), supplierId: z.string().nullable(), product: z.string(),
  status: z.string(), priceCents: money.nullable(), paymentMode: z.enum(['simulated', 'legacy']),
  createdAt: z.string().datetime(), day: day,
})
export const OrderReportSchema = z.object({
  timezone: z.literal(REPORT_TIMEZONE), currency: z.literal(REPORT_CURRENCY), snapshotAt: z.string().datetime(),
  filters: z.object({ from: day, to: day, q: z.string(), status: z.string().nullable(), supplierId: z.string().nullable() }),
  rows: z.array(ReportOrderSchema).max(MAX_REPORT_ROWS),
  summary: z.object({ total: z.number().int().nonnegative(), delivered: z.number().int().nonnegative(), cancelled: z.number().int().nonnegative(),
    simulatedValueCents: money, legacyValueCents: money, financialReceivedCents: z.null(), unknownPriceCount: z.number().int().nonnegative(), invalidDateCount: z.number().int().nonnegative() }),
  daily: z.array(z.object({ day, orders: z.number().int().nonnegative(), delivered: z.number().int().nonnegative(), cancelled: z.number().int().nonnegative(), simulatedValueCents: money })).max(366),
})
export const AdminOccurrencesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(100).default(''), status: z.enum(['aberta','em_atendimento','resolvida']).optional(),
}).strict()
export const AdminOccurrencesPageSchema = z.object({
  items: z.array(z.object({ id: z.string(), orderId: z.string(), buyerId: z.string(), supplierId: z.string(), status: z.enum(['aberta','em_atendimento','resolvida']), createdAt: z.string(), legacy: z.boolean() })).max(50),
  total: z.number().int().nonnegative(), page: z.number().int().positive(), limit: z.number().int().positive().max(50),
})
export type OrderReport = z.infer<typeof OrderReportSchema>
export type ReportOrder = z.infer<typeof ReportOrderSchema>
