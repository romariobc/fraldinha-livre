import type { Context } from 'hono'
import { ZodError } from 'zod'
import { SupplierApplicationSchema, SupplierDecisionSchema } from '../../../packages/contracts/src/supplier'
import { hasAnyRole } from '../middleware/auth'
import { respondError, respondZodError } from '../lib/errors'
import type { Env, AppContext } from '../env'

type Ctx = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>
type Row = { uid: string; status: string; reason: string | null; version: number; created_at: string; updated_at: string }
const serialize = (row: Row) => SupplierApplicationSchema.parse({ ...row, createdAt: row.created_at, updatedAt: row.updated_at })
const find = (c: Ctx, uid: string) => c.env.DB.prepare('SELECT * FROM supplier_applications WHERE uid = ?').bind(uid).first<Row>()

// The UID always comes from the signed identity, never from the request body.
export const supplierApplicationHandler = async (c: Ctx) => {
  const uid = c.get('uid')
  if (!uid) return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
  if (!hasAnyRole(c, ['fornecedor'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  if (c.req.method === 'POST') {
    const now = new Date().toISOString()
    await c.env.DB.prepare(`INSERT INTO supplier_applications (uid, status, created_at, updated_at)
      VALUES (?, 'pendente', ?, ?) ON CONFLICT(uid) DO NOTHING`).bind(uid, now, now).run()
  }
  const row = await find(c, uid)
  return c.json({ application: row ? serialize(row) : null })
}

export const supplierApplicationsListHandler = async (c: Ctx) => {
  if (!hasAnyRole(c, ['admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  const cursor = c.req.query('cursor') ?? ''
  const { results } = await c.env.DB.prepare('SELECT * FROM supplier_applications WHERE uid > ? ORDER BY uid LIMIT 51').bind(cursor).all<Row>()
  return c.json({ applications: results.slice(0, 50).map(serialize), nextCursor: results.length > 50 ? results[49].uid : null })
}

export const supplierDecisionHandler = async (c: Ctx) => {
  if (!hasAnyRole(c, ['admin'])) return respondError(c, 'FORBIDDEN', 403, 'Acesso negado.')
  const uid = c.req.param('uid')!
  try {
    const request = SupplierDecisionSchema.parse(await c.req.json().catch(() => null))
    const previous = await find(c, uid)
    if (!previous) return respondError(c, 'RESOURCE_NOT_FOUND', 404, 'Solicitação não encontrada.')
    // A lost response can be retried verbatim; an old decision cannot overwrite a newer one.
    if (previous.version === request.expectedVersion + 1 && previous.status === request.status && previous.reason === request.reason) {
      return c.json({ application: serialize(previous) })
    }
    if (previous.version !== request.expectedVersion || previous.status === request.status ||
        (request.status === 'suspenso' && previous.status !== 'aprovado') ||
        (request.status === 'rejeitado' && previous.status !== 'pendente')) {
      return respondError(c, 'SUPPLIER_STATE_CONFLICT', 409, 'Estado alterado ou transição inválida. Atualize a lista.')
    }
    const now = new Date().toISOString()
    const auditId = crypto.randomUUID()
    // Audit first, guarded by the same version. Both statements commit or roll back together.
    const result = await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO audit_logs
        (id, actor_id, actor_role, target_type, target_id, action, reason, metadata, request_id, created_at)
        SELECT ?, ?, 'admin', 'user', uid, ?, ?, json_object('oldStatus', status, 'newStatus', ?, 'version', version + 1), ?, ?
        FROM supplier_applications WHERE uid = ? AND version = ?`)
        .bind(auditId, c.get('uid'), 'supplier.' + request.status, request.reason, request.status, c.get('requestId') ?? auditId, now, uid, request.expectedVersion),
      c.env.DB.prepare('UPDATE supplier_applications SET status = ?, reason = ?, version = version + 1, updated_at = ? WHERE uid = ? AND version = ?')
        .bind(request.status, request.reason, now, uid, request.expectedVersion),
    ])
    if (result[1].meta.changes !== 1) return respondError(c, 'SUPPLIER_STATE_CONFLICT', 409, 'Estado alterado. Atualize a lista.')
    return c.json({ application: serialize((await find(c, uid))!) })
  } catch (error) {
    if (error instanceof ZodError) return respondZodError(c, error)
    throw error
  }
}
