import type { Context } from 'hono'
import { ZodError } from 'zod'
import { CreateOccurrenceSchema, ReplyOccurrenceSchema, OccurrencesSchema, type Occurrence } from '../../../packages/contracts/src/occurrence'
import type { Env, AppContext } from '../env'
import { getUserRole } from '../middleware/auth'
import { AppError, sendAppError, respondZodError } from '../lib/errors'
import { occurrenceNotificationStatement } from '../lib/internal-notifications'

type Ctx = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>
type Report = { id: string; order_id: string; supplier_id: string; client_id: string; message: string; created_at: string; status: Occurrence['status']; version: number; opened_by: string | null; opened_role: 'comprador' | 'fornecedor' | null; resolved_by: string | null; resolved_at: string | null }
type Message = { id: string; report_id: string; actor_id: string; actor_role: 'comprador' | 'fornecedor' | 'admin'; message: string; created_at: string; resolution: number }
const fail = (code: 'FORBIDDEN' | 'UNAUTHORIZED' | 'ORDER_NOT_FOUND' | 'RESOURCE_NOT_FOUND' | 'OCCURRENCE_CONFLICT' | 'IDEMPOTENCY_CONFLICT', status: 401 | 403 | 404 | 409, message: string): never => { throw new AppError({ code, status, message }) }

function handle(handler: (c: Ctx) => Promise<Response>) {
  return async (c: Ctx) => {
    try { return await handler(c) }
    catch (error) {
      if (error instanceof AppError) return sendAppError(c, error)
      if (error instanceof ZodError) return respondZodError(c, error)
      throw error
    }
  }
}

async function access(c: Ctx) {
  const uid = c.get('uid'), role = getUserRole(c), orderId = c.req.param('id')
  if (!uid) return fail('UNAUTHORIZED', 401, 'Não autenticado.')
  if (!['comprador', 'fornecedor', 'admin'].includes(role ?? '')) return fail('FORBIDDEN', 403, 'Acesso negado.')
  const order = await c.env.DB.prepare('SELECT id, uid, supplier_id FROM orders WHERE id = ?').bind(orderId).first<{ id: string; uid: string; supplier_id: string | null }>()
  if (!order) return fail('ORDER_NOT_FOUND', 404, 'Pedido não encontrado.')
  if (role === 'comprador' && order.uid !== uid) return fail('FORBIDDEN', 403, 'Acesso negado.')
  if (role === 'fornecedor' && order.supplier_id !== uid) {
    // Only an existing report snapshot can grant legacy support access; current product ownership cannot.
    const legacy = !order.supplier_id && await c.env.DB.prepare('SELECT id FROM reports WHERE order_id = ? AND supplier_id = ? LIMIT 1').bind(orderId, uid).first()
    if (!legacy) return fail('FORBIDDEN', 403, 'Acesso negado.')
  }
  return { uid, role: role as 'comprador' | 'fornecedor' | 'admin', order }
}

export const occurrencesGetHandler = handle(async (c: Ctx) => {
  const { uid, role, order } = await access(c)
  const supplierFilter = role === 'fornecedor' && !order.supplier_id ? ' AND supplier_id = ?' : ''
  const args = supplierFilter ? [order.id, uid] : [order.id]
  // Same read transaction: status/version and messages cannot contradict each other.
  const [reports, messages] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM reports WHERE order_id = ?' + supplierFilter + ' ORDER BY created_at, id').bind(...args),
    c.env.DB.prepare('SELECT m.* FROM report_messages m JOIN reports r ON r.id = m.report_id WHERE r.order_id = ?' + (supplierFilter ? ' AND r.supplier_id = ?' : '') + ' ORDER BY m.created_at, m.rowid').bind(...args),
  ])
  return c.json(OccurrencesSchema.parse((reports.results as unknown as Report[]).map(r => ({
    id: r.id, orderId: r.order_id, status: r.status, version: r.version, createdAt: r.created_at,
    legacy: r.opened_by === null, resolvedBy: r.resolved_by, resolvedAt: r.resolved_at,
    messages: [{ id: r.id, actorId: r.opened_by ?? r.supplier_id, actorRole: r.opened_role ?? 'fornecedor', message: r.message, createdAt: r.created_at, resolution: false },
      ...(messages.results as unknown as Message[]).filter(m => m.report_id === r.id).map(m => ({ id: m.id, actorId: m.actor_id, actorRole: m.actor_role, message: m.message, createdAt: m.created_at, resolution: Boolean(m.resolution) }))],
  }))))
})

export const occurrencesPostHandler = handle(async (c: Ctx) => {
  const { uid, role, order } = await access(c)
  if (role === 'admin') return fail('FORBIDDEN', 403, 'Somente as partes abrem ocorrências.')
  try {
    const body = CreateOccurrenceSchema.parse(await c.req.json().catch(() => null))
    if (!order.supplier_id) return fail('OCCURRENCE_CONFLICT', 409, 'Pedido legado sem fornecedor definido. Solicite reconciliação administrativa; as ocorrências anteriores continuam disponíveis.')
    const id = body.requestId ?? crypto.randomUUID()
    const existing = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<Report>()
    const replay = (r: Report) => {
      if (r.order_id !== order.id || r.opened_by !== uid || r.message !== body.message) return fail('IDEMPOTENCY_CONFLICT', 409, 'Identificador já usado para outro envio.')
      return c.json({ success: true, reportId: id }, 200)
    }
    if (existing) return replay(existing)
    try {
      await c.env.DB.prepare('INSERT INTO reports (id, order_id, supplier_id, client_id, message, read, created_at, opened_by, opened_role) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)')
        .bind(id, order.id, order.supplier_id, order.uid, body.message, new Date().toISOString(), uid, role).run()
    } catch (error) {
      const winner = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<Report>()
      if (winner) return replay(winner)
      throw error
    }
    return c.json({ success: true, reportId: id }, 201)
  } catch (error) { if (error instanceof ZodError) return respondZodError(c, error); throw error }
})

export const occurrencesReplyHandler = handle(async (c: Ctx) => {
  const { uid, role, order } = await access(c)
  const reportId = c.req.param('reportId')
  const report = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ? AND order_id = ?').bind(reportId, order.id).first<Report>()
  if (!report) return fail('RESOURCE_NOT_FOUND', 404, 'Ocorrência não encontrada.')
  if (role === 'fornecedor' && !order.supplier_id && report.supplier_id !== uid) return fail('FORBIDDEN', 403, 'Acesso negado.')
  try {
    const body = ReplyOccurrenceSchema.parse(await c.req.json().catch(() => null))
    const replay = (m: Message) => {
      if (m.report_id !== reportId || m.actor_id !== uid || m.message !== body.message || Boolean(m.resolution) !== (body.status === 'resolvida')) return fail('IDEMPOTENCY_CONFLICT', 409, 'Identificador já usado para outro envio.')
      return c.json({ success: true, messageId: m.id })
    }
    const existing = await c.env.DB.prepare('SELECT * FROM report_messages WHERE id = ?').bind(body.requestId).first<Message>()
    if (existing) return replay(existing)
    const now = new Date().toISOString(), resolution = body.status === 'resolvida'
    let results: D1Result[]
    try {
      results = await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE reports SET status = ?, version = version + 1, mutation_id = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND version = ? AND status != 'resolvida'`)
          .bind(body.status, body.requestId, resolution ? uid : null, resolution ? now : null, reportId, body.expectedVersion),
        c.env.DB.prepare('INSERT INTO report_messages (id, report_id, actor_id, actor_role, message, created_at, resolution) SELECT ?, id, ?, ?, ?, ?, ? FROM reports WHERE id = ? AND mutation_id = ?')
          .bind(body.requestId, uid, role, body.message, now, resolution ? 1 : 0, reportId, body.requestId),
        occurrenceNotificationStatement(c.env.DB, body.requestId),
      ])
    } catch (error) {
      const winner = await c.env.DB.prepare('SELECT * FROM report_messages WHERE id = ?').bind(body.requestId).first<Message>()
      if (winner) return replay(winner)
      throw error
    }
    if (results[0].meta.changes !== 1) return fail('OCCURRENCE_CONFLICT', 409, 'Ocorrência alterada ou resolvida. Atualize antes de responder.')
    return c.json({ success: true, messageId: body.requestId }, 201)
  } catch (error) { if (error instanceof ZodError) return respondZodError(c, error); throw error }
})
