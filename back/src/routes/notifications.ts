import type { Context } from 'hono'
import { NotificationIdSchema, NotificationSchema, NotificationsPageSchema, NotificationDestinationSchema, NotificationReadSchema } from '../../../packages/contracts/src/notification'
import type { Env, AppContext } from '../env'
import { getUserRole } from '../middleware/auth'
import { respondError } from '../lib/errors'

type Ctx = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>
type Row = { id: number; recipient_uid: string; kind: 'new_order' | 'order_status' | 'order_cancelled' | 'supplier_decision' | 'occurrence_reply'; order_id: string | null; report_id: string | null; detail: string; created_at: string; read_at: string | null }
const statusLabels: Record<string, string> = { aguardando: 'aguardando confirmação', confirmado: 'confirmado', 'a-caminho': 'a caminho', entregue: 'entregue', cancelado: 'cancelado' }
function serialize(row: Row) {
  const message = row.kind === 'new_order' ? 'Você recebeu um novo pedido simulado.'
    : row.kind === 'order_cancelled' ? 'Um pedido foi cancelado.'
    : row.kind === 'order_status' ? 'Pedido ' + (statusLabels[row.detail] ?? 'atualizado') + '.'
    : row.kind === 'supplier_decision' ? 'Seu cadastro de fornecedor foi ' + (row.detail.split('.')[1] ?? 'atualizado') + '.'
    : row.detail === 'resolved' ? 'Uma ocorrência recebeu resposta de resolução.' : 'Você recebeu uma resposta em ocorrência.'
  return NotificationSchema.parse({ id: String(row.id), kind: row.kind, message, createdAt: row.created_at, readAt: row.read_at })
}

async function owned(c: Ctx) {
  const parsed = NotificationIdSchema.safeParse(c.req.param('notificationId'))
  return parsed.success ? c.env.DB.prepare('SELECT * FROM notifications WHERE id = ? AND recipient_uid = ?').bind(Number(parsed.data), c.get('uid')).first<Row>() : null
}
const missing = (c: Ctx) => respondError(c, 'RESOURCE_NOT_FOUND', 404, 'Aviso não encontrado.')

export const notificationsGetHandler = async (c: Ctx) => {
  const rawLimit = c.req.query('limit') ?? '30', cursor = c.req.query('cursor')
  if (!/^[1-9]\d*$/.test(rawLimit) || !Number.isSafeInteger(Number(rawLimit)) || Number(rawLimit) > 50 || (cursor !== undefined && !NotificationIdSchema.safeParse(cursor).success)) {
    return respondError(c, 'INVALID_REQUEST', 400, 'Paginação inválida.')
  }
  const limit = Number(rawLimit), uid = c.get('uid')
  const before = cursor ? ' AND id < ?' : ''
  const pageArgs = cursor ? [uid, Number(cursor), limit + 1] : [uid, limit + 1]
  const [rows, unread] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM notifications WHERE recipient_uid = ?' + before + ' ORDER BY id DESC LIMIT ?').bind(...pageArgs),
    c.env.DB.prepare('SELECT COUNT(*) AS total FROM notifications WHERE recipient_uid = ? AND read_at IS NULL').bind(uid),
  ])
  const items = rows.results as unknown as Row[]
  return c.json(NotificationsPageSchema.parse({ items: items.slice(0, limit).map(serialize), nextCursor: items.length > limit ? String(items[limit - 1].id) : null, unreadCount: (unread.results[0] as { total: number }).total }))
}

export const notificationReadHandler = async (c: Ctx) => {
  const row = await owned(c)
  if (!row) return missing(c)
  // Monotonic and idempotent, including retry after the response was lost.
  const [result] = await c.env.DB.batch([
    c.env.DB.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND recipient_uid = ? RETURNING id, read_at').bind(new Date().toISOString(), row.id, c.get('uid')),
  ])
  const saved = result.results[0] as { id: number; read_at: string } | undefined
  if (!saved) return missing(c)
  return c.json(NotificationReadSchema.parse({ id: String(saved.id), readAt: saved.read_at }))
}

export const notificationDestinationHandler = async (c: Ctx) => {
  const row = await owned(c)
  if (!row) return missing(c)
  const uid = c.get('uid'), role = getUserRole(c)
  const denied = () => respondError(c, 'FORBIDDEN', 403, 'O destino deste aviso não está disponível para seu acesso atual.')
  if (row.kind === 'supplier_decision') {
    if (role !== 'fornecedor') return denied()
    const application = await c.env.DB.prepare('SELECT uid FROM supplier_applications WHERE uid = ?').bind(uid).first()
    if (!application) return denied()
    return c.json(NotificationDestinationSchema.parse({ type: 'supplier', href: '/painel-fornecedor' }))
  }
  const order = await c.env.DB.prepare('SELECT uid, supplier_id FROM orders WHERE id = ?').bind(row.order_id).first<{ uid: string; supplier_id: string | null }>()
  if (!order) return respondError(c, 'RESOURCE_NOT_FOUND', 404, 'O pedido deste aviso não está disponível.')
  if (row.kind === 'occurrence_reply') {
    const report = await c.env.DB.prepare('SELECT supplier_id FROM reports WHERE id = ? AND order_id = ?').bind(row.report_id, row.order_id).first<{ supplier_id: string }>()
    if (!report || (role !== 'admin' && !(role === 'comprador' && order.uid === uid) && !(role === 'fornecedor' && (order.supplier_id === uid || (!order.supplier_id && report.supplier_id === uid))))) return denied()
    return c.json(NotificationDestinationSchema.parse({ type: 'occurrence', orderId: row.order_id, reportId: row.report_id }))
  }
  if (role !== 'admin' && !(role === 'comprador' && order.uid === uid) && !(role === 'fornecedor' && order.supplier_id === uid)) return denied()
  return c.json(NotificationDestinationSchema.parse({ type: 'order', orderId: row.order_id, scope: role }))
}
