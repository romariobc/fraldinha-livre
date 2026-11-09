import type { Context } from 'hono'
import { ZodError } from 'zod'
import { OrderReportQuerySchema, OrderReportSchema, MAX_REPORT_ROWS, REPORT_TIMEZONE, REPORT_CURRENCY, defaultReportPeriod, nextReportDay, reportMidnightUTC, reportDay, AdminOccurrencesQuerySchema, AdminOccurrencesPageSchema, type ReportOrder } from '../../../packages/contracts/src/report'
import type { Env, AppContext } from '../env'
import { hasAnyRole } from '../middleware/auth'
import { respondError, respondZodError } from '../lib/errors'

type Ctx = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>
type Row = { id: string; uid: string; supplier_id: string | null; product: string; status: string; price: number | null; payment_mode: string | null; created_at: string }
export function createOrderReportHandler(scope: 'admin' | 'fornecedor') {
  return async (c: Ctx) => {
    if (!hasAnyRole(c, [scope])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
    try {
      const query = OrderReportQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams))
      const period = query.from && query.to ? { from: query.from, to: query.to } : defaultReportPeriod()
      if (scope === 'fornecedor' && query.supplierId && query.supplierId !== c.get('uid')) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
      const supplierId = scope === 'fornecedor' ? c.get('uid') : query.supplierId ?? null
      const where = ['1 = 1'], args: (string | number)[] = []
      if (supplierId) { where.push('o.supplier_id = ?'); args.push(supplierId) }
      if (query.status) { where.push('o.status = ?'); args.push(query.status) }
      if (query.q) { where.push("instr(lower(o.id || ' ' || o.uid || ' ' || COALESCE(o.supplier_id,'') || ' ' || o.product), lower(?)) > 0"); args.push(query.q) }
      const filter = where.join(' AND ')
      // One bounded snapshot: metrics, pagination and CSV all use these exact rows, without N+1 reads.
      const [data, invalid] = await c.env.DB.batch([
        c.env.DB.prepare(`SELECT o.id,o.uid,o.supplier_id,o.product,o.status,o.price,o.payment_mode,
          strftime('%Y-%m-%dT%H:%M:%fZ',julianday(o.created_at)) AS created_at FROM orders o WHERE ${filter}
          AND julianday(o.created_at) >= julianday(?) AND julianday(o.created_at) < julianday(?)
          ORDER BY julianday(o.created_at) DESC,o.id DESC LIMIT ?`)
          .bind(...args, reportMidnightUTC(period.from), reportMidnightUTC(nextReportDay(period.to)), MAX_REPORT_ROWS + 1),
        c.env.DB.prepare(`SELECT COUNT(*) AS total FROM orders o WHERE ${filter} AND julianday(o.created_at) IS NULL`).bind(...args),
      ])
      if (data.results.length > MAX_REPORT_ROWS) return respondError(c, 'INVALID_REQUEST', 400, 'Consulta excede 5.000 pedidos. Restrinja o período ou os filtros; nenhum relatório parcial foi gerado.')
      const rows: ReportOrder[] = (data.results as unknown as Row[]).map(row => ({ id: row.id, buyerId: row.uid, supplierId: row.supplier_id, product: row.product, status: row.status,
        priceCents: row.price !== null && Number.isSafeInteger(row.price) && row.price >= 0 ? row.price : null,
        paymentMode: row.payment_mode === 'simulated' ? 'simulated' : 'legacy', createdAt: row.created_at, day: reportDay(row.created_at) }))
      const daily = []
      for (let day = period.from; day <= period.to; day = nextReportDay(day)) daily.push({ day, orders: 0, delivered: 0, cancelled: 0, simulatedValueCents: 0 })
      const byDay = new Map(daily.map(row => [row.day, row]))
      let simulatedValueCents = 0, legacyValueCents = 0
      for (const row of rows) {
        const bucket = byDay.get(row.day)!
        bucket.orders++; if (row.status === 'entregue') bucket.delivered++; if (row.status === 'cancelado') bucket.cancelled++
        if (row.status !== 'cancelado' && row.priceCents !== null) {
          if (row.paymentMode === 'simulated') { simulatedValueCents += row.priceCents; bucket.simulatedValueCents += row.priceCents }
          else legacyValueCents += row.priceCents
        }
      }
      return c.json(OrderReportSchema.parse({ timezone: REPORT_TIMEZONE, currency: REPORT_CURRENCY, snapshotAt: new Date().toISOString(),
        filters: { ...period, q: query.q, status: query.status ?? null, supplierId }, rows, daily,
        summary: { total: rows.length, delivered: rows.filter(r => r.status === 'entregue').length, cancelled: rows.filter(r => r.status === 'cancelado').length,
          simulatedValueCents, legacyValueCents, financialReceivedCents: null, unknownPriceCount: rows.filter(r => r.priceCents === null).length,
          invalidDateCount: (invalid.results[0] as { total: number }).total } }))
    } catch (error) { if (error instanceof ZodError) return respondZodError(c, error); throw error }
  }
}

export const adminOccurrencesListHandler = async (c: Ctx) => {
  if (!hasAnyRole(c, ['admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  try {
    const query = AdminOccurrencesQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams))
    const where = ['1 = 1'], args: string[] = []
    if (query.status) { where.push('status = ?'); args.push(query.status) }
    if (query.q) { where.push("instr(lower(id || ' ' || order_id || ' ' || client_id || ' ' || supplier_id),lower(?)) > 0"); args.push(query.q) }
    const filter = where.join(' AND ')
    const [rows, total] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT * FROM reports WHERE ${filter} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...args, query.limit, (query.page - 1) * query.limit),
      c.env.DB.prepare(`SELECT COUNT(*) AS total FROM reports WHERE ${filter}`).bind(...args),
    ])
    type Report = { id: string; order_id: string; client_id: string; supplier_id: string; status: string; created_at: string; opened_by: string | null }
    return c.json(AdminOccurrencesPageSchema.parse({ items: (rows.results as unknown as Report[]).map(r => ({ id: r.id, orderId: r.order_id, buyerId: r.client_id, supplierId: r.supplier_id, status: r.status, createdAt: r.created_at, legacy: r.opened_by === null })), total: (total.results[0] as { total: number }).total, page: query.page, limit: query.limit }))
  } catch (error) { if (error instanceof ZodError) return respondZodError(c, error); throw error }
}
