import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware, requireAnyRole } from '../src/middleware/auth'
import { ordersPostHandler, ordersCancelHandler, ordersStatusPatchHandler } from '../src/routes/orders'
import { supplierApplicationHandler, supplierDecisionHandler } from '../src/routes/suppliers'
import { occurrencesPostHandler, occurrencesReplyHandler } from '../src/routes/occurrences'
import { notificationsGetHandler, notificationReadHandler, notificationDestinationHandler } from '../src/routes/notifications'
import { orderNotificationStatement } from '../src/lib/internal-notifications'
import { NotificationsPageSchema, NotificationReadSchema } from '../../packages/contracts/src/notification'

function app() {
  const api = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  api.onError((_error, c) => c.json({ error: 'internal' }, 500))
  api.use('*', createAuthMiddleware(async token => {
    const [role, uid] = token.split(':')
    return { uid, role, claims: { role } }
  }))
  api.use('/notifications/*', requireAnyRole(['comprador', 'fornecedor', 'admin']))
  api.get('/notifications', notificationsGetHandler)
  api.patch('/notifications/:notificationId/read', notificationReadHandler)
  api.get('/notifications/:notificationId/destination', notificationDestinationHandler)
  api.post('/orders', requireAnyRole(['comprador']), ordersPostHandler)
  api.patch('/orders/:id/cancel', ordersCancelHandler)
  api.patch('/orders/:id/status', ordersStatusPatchHandler)
  api.post('/auth/supplier-application', supplierApplicationHandler)
  api.patch('/admin/suppliers/:uid', supplierDecisionHandler)
  api.post('/orders/:id/occurrences', occurrencesPostHandler)
  api.post('/orders/:id/occurrences/:reportId/messages', occurrencesReplyHandler)
  return api
}
const send = (token: string, method: string, path: string, body?: unknown, key = crypto.randomUUID()) => app().fetch(new Request('http://localhost' + path, {
  method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body),
}), env)
const admin = 'admin:mp09-admin'
async function list(token: string, query = '') {
  const response = await send(token, 'GET', '/notifications' + query)
  expect(response.status).toBe(200)
  return NotificationsPageSchema.parse(await response.json())
}
const destination = (token: string, id: string) => send(token, 'GET', '/notifications/' + id + '/destination')
async function fixture() {
  const id = crypto.randomUUID(), buyerUid = 'mp09-b-' + id, supplierUid = 'mp09-s-' + id
  const buyer = 'comprador:' + buyerUid, supplier = 'fornecedor:' + supplierUid, product = 'mp09-p-' + id
  await env.DB.prepare("INSERT INTO supplier_applications (uid,status,created_at,updated_at) VALUES (?,'aprovado',?,?)").bind(supplierUid, now, now).run()
  await env.DB.prepare("INSERT INTO products (id,name,price_cents,supplier_id,quantity,active) VALUES (?,'Produto MP09',100,?,10,1)").bind(product, supplierUid).run()
  const payload = { product: 'Produto MP09', quantity: 2, unit: 'un', price: 200, supplierId: supplierUid, deliveryAddress: { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }, items: [{ productId: product, productName: 'Produto MP09', unitPrice: 100, quantity: 2, unit: 'un' }] }
  const key = crypto.randomUUID()
  const response = await send(buyer, 'POST', '/orders', payload, key)
  expect(response.status).toBe(201)
  const order = await response.json() as { id: string }
  return { buyerUid, supplierUid, buyer, supplier, product, payload, key, orderId: order.id }
}
const now = '2026-11-05T12:00:00.000Z'

describe('MP-09: durable, account-isolated internal notifications', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter(m => !m.name.startsWith('0017')))
    await env.DB.prepare("INSERT INTO orders (id,uid,type,status,product,quantity,unit,price,delivery_address,created_at) VALUES ('mp09-old','mp09-old-buyer','compra-direta','aguardando','Legado',1,'un',100,'{}',?)").bind(now).run()
    await env.DB.prepare("INSERT INTO order_events (id,order_id,mutation_id,to_status,actor_id,stock_effect,created_at) VALUES ('mp09-old-event','mp09-old','mp09-old-mutation','aguardando','mp09-old-buyer','none',?)").bind(now).run()
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })
  it('adds storage without inventing historical recipients or altering old events', async () => {
    expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM notifications').first()).toEqual({ total: 0 })
    expect(await env.DB.prepare("SELECT id,actor_id FROM order_events WHERE id='mp09-old-event'").first()).toEqual({ id: 'mp09-old-event', actor_id: 'mp09-old-buyer' })
  })
  it('new order notifies only its supplier; persisted read survives replay and a new request session', async () => {
    const f = await fixture(), page = await list(f.supplier)
    expect(page.items.map(i => i.kind)).toEqual(['new_order'])
    expect((await list(f.buyer)).items).toEqual([])
    expect((await list('fornecedor:outsider')).items).toEqual([])
    const id = page.items[0].id
    expect(await (await destination(f.supplier, id)).json()).toEqual({ type: 'order', orderId: f.orderId, scope: 'fornecedor' })
    const first = NotificationReadSchema.parse(await (await send(f.supplier, 'PATCH', '/notifications/' + id + '/read')).json())
    const second = NotificationReadSchema.parse(await (await send(f.supplier, 'PATCH', '/notifications/' + id + '/read')).json())
    expect(second).toEqual(first)
    expect((await send(f.buyer, 'POST', '/orders', f.payload, f.key)).status).toBe(200)
    const resumed = await list(f.supplier)
    expect(resumed.items).toHaveLength(1); expect(resumed.unreadCount).toBe(0); expect(resumed.items[0].readAt).toBe(first.readAt)
  })
  it('confirmation, dispatch and delivery notify buyer once per recorded transition, excluding actor', async () => {
    const f = await fixture()
    for (const status of ['confirmado', 'a-caminho', 'entregue']) expect((await send(f.supplier, 'PATCH', '/orders/' + f.orderId + '/status', { status })).status).toBe(200)
    const page = await list(f.buyer)
    expect(page.items.map(i => i.message)).toEqual(['Pedido entregue.', 'Pedido a caminho.', 'Pedido confirmado.'])
    expect((await list(f.supplier)).items).toHaveLength(1)
    expect((await send(f.buyer, 'PATCH', '/orders/' + f.orderId + '/cancel')).status).toBe(409)
    expect((await list(f.buyer)).items).toHaveLength(3)
  })
  it.each(['buyer', 'supplier', 'admin'] as const)('cancellation by %s reaches counterpart(s) and repeated cancellation adds no notice', async actor => {
    const f = await fixture()
    const token = actor === 'buyer' ? f.buyer : actor === 'supplier' ? f.supplier : admin
    const path = '/orders/' + f.orderId + (actor === 'buyer' ? '/cancel' : '/status')
    const body = actor === 'buyer' ? undefined : { status: 'cancelado', reason: 'Motivo obrigatório MP09' }
    expect((await send(token, 'PATCH', path, body)).status).toBe(200)
    await send(token, 'PATCH', path, body)
    expect((await list(f.buyer)).items.filter(i => i.kind === 'order_cancelled')).toHaveLength(actor === 'buyer' ? 0 : 1)
    expect((await list(f.supplier)).items.filter(i => i.kind === 'order_cancelled')).toHaveLength(actor === 'supplier' ? 0 : 1)
  })
  it('supplier decisions use recorded audits, preserve read on retry, and paginate without dropping older notices', async () => {
    const uid = 'mp09-app-' + crypto.randomUUID(), token = 'fornecedor:' + uid
    expect((await send(token, 'POST', '/auth/supplier-application', {})).status).toBe(200)
    for (const [version, status] of ['aprovado', 'suspenso', 'aprovado', 'suspenso', 'aprovado'].entries()) {
      const body = { status, expectedVersion: version, reason: 'Decisão registrada MP09' }
      expect((await send(admin, 'PATCH', '/admin/suppliers/' + uid, body)).status).toBe(200)
      expect((await send(admin, 'PATCH', '/admin/suppliers/' + uid, body)).status).toBe(200)
    }
    const first = await list(token, '?limit=2')
    expect(first.unreadCount).toBe(5); expect(first.items).toHaveLength(2)
    expect(await (await destination(token, first.items[0].id)).json()).toEqual({ type: 'supplier', href: '/painel-fornecedor' })
    expect((await send(admin, 'PATCH', '/admin/suppliers/' + uid, { status: 'suspenso', expectedVersion: 5, reason: 'Nova decisão enquanto paginando' })).status).toBe(200)
    const second = await list(token, '?limit=2&cursor=' + first.nextCursor)
    const third = await list(token, '?limit=2&cursor=' + second.nextCursor)
    expect(new Set([...first.items, ...second.items, ...third.items].map(i => i.id)).size).toBe(5)
    expect(third.nextCursor).toBeNull(); expect((await list(token)).items).toHaveLength(6)
  })
  it('rejection reaches the applicant without broadcasting an admin inbox', async () => {
    const uid = 'mp09-reject-' + crypto.randomUUID(), token = 'fornecedor:' + uid
    await send(token, 'POST', '/auth/supplier-application', {})
    expect((await send(admin, 'PATCH', '/admin/suppliers/' + uid, { status: 'rejeitado', expectedVersion: 0, reason: 'Cadastro incompleto para QA' })).status).toBe(200)
    expect((await list(token)).items[0].message).toContain('rejeitado')
    expect((await list(admin)).items).toHaveLength(0)
  })
  it('occurrence replies/resolution reach other parties, replay deduplicates and commercial data remain unchanged', async () => {
    const f = await fixture(), reportId = crypto.randomUUID()
    expect((await send(f.buyer, 'POST', '/orders/' + f.orderId + '/occurrences', { message: 'Problema documentado MP09', requestId: reportId })).status).toBe(201)
    const before = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(f.orderId).first()
    const path = '/orders/' + f.orderId + '/occurrences/' + reportId + '/messages'
    for (const [version, token] of [f.supplier, f.buyer, admin].entries()) {
      const body = { message: 'Resposta persistida MP09', expectedVersion: version, requestId: crypto.randomUUID(), status: version === 2 ? 'resolvida' : 'em_atendimento' }
      expect((await send(token, 'POST', path, body)).status).toBe(201)
      expect((await send(token, 'POST', path, body)).status).toBe(200)
    }
    const buyerNotices = (await list(f.buyer)).items.filter(i => i.kind === 'occurrence_reply')
    const supplierNotices = (await list(f.supplier)).items.filter(i => i.kind === 'occurrence_reply')
    expect(buyerNotices).toHaveLength(2); expect(supplierNotices).toHaveLength(2)
    expect(await (await destination(f.buyer, buyerNotices[0].id)).json()).toEqual({ type: 'occurrence', orderId: f.orderId, reportId })
    expect(await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(f.orderId).first()).toEqual(before)
    expect(await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(f.product).first()).toEqual({ quantity: 8 })
  })
  it('recipient cannot be chosen by query/body; even admin cannot list/read/open another account notice', async () => {
    const f = await fixture(), item = (await list(f.supplier)).items[0]
    expect((await list(f.buyer, '?recipient_uid=' + f.supplierUid)).items).toEqual([])
    for (const token of [f.buyer, admin, 'fornecedor:outsider']) {
      expect((await destination(token, item.id)).status).toBe(404)
      expect((await send(token, 'PATCH', '/notifications/' + item.id + '/read', { uid: f.supplierUid })).status).toBe(404)
    }
    expect((await list(f.supplier)).unreadCount).toBe(1)
  })
  it('legacy occurrence uses its preserved supplier snapshot, never the current product owner', async () => {
    const f = await fixture(), reportId = crypto.randomUUID()
    await send(f.buyer, 'POST', '/orders/' + f.orderId + '/occurrences', { message: 'Atendimento legado preservado', requestId: reportId })
    await env.DB.prepare('UPDATE orders SET supplier_id = NULL WHERE id = ?').bind(f.orderId).run()
    await env.DB.prepare('UPDATE products SET supplier_id = ? WHERE id = ?').bind('mp09-transferred-owner', f.product).run()
    const path = '/orders/' + f.orderId + '/occurrences/' + reportId + '/messages'
    const body = { message: 'Solução do atendimento legado', requestId: crypto.randomUUID(), expectedVersion: 0, status: 'resolvida' }
    expect((await send(admin, 'POST', path, body)).status).toBe(201)
    const notices = (await list(f.supplier)).items.filter(i => i.kind === 'occurrence_reply')
    expect(notices).toHaveLength(1)
    expect((await destination(f.supplier, notices[0].id)).status).toBe(200)
    expect((await list('fornecedor:mp09-transferred-owner')).items).toHaveLength(0)
    expect((await send('fornecedor:mp09-transferred-owner', 'POST', path, { ...body, requestId: crypto.randomUUID() })).status).toBe(403)
  })
  it('link rechecks present role/ownership and does not transfer notice with product ownership', async () => {
    const f = await fixture(), item = (await list(f.supplier)).items[0]
    await env.DB.prepare('UPDATE products SET supplier_id = ? WHERE id = ?').bind('mp09-new-owner', f.product).run()
    expect((await destination(f.supplier, item.id)).status).toBe(200)
    expect((await destination('comprador:' + f.supplierUid, item.id)).status).toBe(403)
    expect((await destination('fornecedor:mp09-new-owner', item.id)).status).toBe(404)
    await env.DB.prepare('UPDATE orders SET supplier_id = NULL WHERE id = ?').bind(f.orderId).run()
    expect((await destination(f.supplier, item.id)).status).toBe(403)
  })
  it('notification failure rolls back order/event/stock, allowing the same key to retry without loss', async () => {
    const f = await fixture(), key = crypto.randomUUID()
    await env.DB.exec("CREATE TRIGGER mp09_fail_notice BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT, 'forced QA notification failure'); END;")
    try {
      expect((await send(f.buyer, 'POST', '/orders', f.payload, key)).status).toBe(500)
      expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM orders WHERE uid = ?').bind(f.buyerUid).first()).toEqual({ total: 1 })
      expect(await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(f.product).first()).toEqual({ quantity: 8 })
      expect((await list(f.supplier)).items).toHaveLength(1)
    } finally { await env.DB.exec('DROP TRIGGER mp09_fail_notice') }
    expect((await send(f.buyer, 'POST', '/orders', f.payload, key)).status).toBe(201)
    expect((await list(f.supplier)).items).toHaveLength(2)
  })
  it('reprojecting an existing recorded event deduplicates without resetting read state', async () => {
    const f = await fixture(), item = (await list(f.supplier)).items[0]
    await send(f.supplier, 'PATCH', '/notifications/' + item.id + '/read')
    const event = await env.DB.prepare('SELECT mutation_id FROM order_events WHERE order_id = ?').bind(f.orderId).first<{ mutation_id: string }>()
    await orderNotificationStatement(env.DB, event!.mutation_id).run()
    expect((await list(f.supplier)).items).toHaveLength(1); expect((await list(f.supplier)).unreadCount).toBe(0)
  })
  it('failed notice rolls back supplier decision/audit and occurrence response/state together', async () => {
    const f = await fixture(), reportId = crypto.randomUUID()
    await send(f.buyer, 'POST', '/orders/' + f.orderId + '/occurrences', { message: 'Ocorrência para testar falha', requestId: reportId })
    const path = '/orders/' + f.orderId + '/occurrences/' + reportId + '/messages'
    const body = { message: 'Resposta com falha intermediária', requestId: crypto.randomUUID(), expectedVersion: 0, status: 'em_atendimento' }
    await env.DB.exec("CREATE TRIGGER mp09_fail_other_notice BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT, 'forced QA failure'); END;")
    try {
      expect((await send(admin, 'PATCH', '/admin/suppliers/' + f.supplierUid, { status: 'suspenso', expectedVersion: 0, reason: 'Suspensão de QA' })).status).toBe(500)
      expect(await env.DB.prepare('SELECT status,version FROM supplier_applications WHERE uid = ?').bind(f.supplierUid).first()).toEqual({ status: 'aprovado', version: 0 })
      expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM audit_logs WHERE target_id = ?').bind(f.supplierUid).first()).toEqual({ total: 0 })
      expect((await send(f.supplier, 'POST', path, body)).status).toBe(500)
      expect(await env.DB.prepare('SELECT status,version FROM reports WHERE id = ?').bind(reportId).first()).toEqual({ status: 'aberta', version: 0 })
      expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM report_messages WHERE report_id = ?').bind(reportId).first()).toEqual({ total: 0 })
    } finally { await env.DB.exec('DROP TRIGGER mp09_fail_other_notice') }
    expect((await send(f.supplier, 'POST', path, body)).status).toBe(201)
    expect((await list(f.buyer)).items).toHaveLength(1)
  })
  it('concurrent read acknowledgements return the same durable timestamp', async () => {
    const f = await fixture(), id = (await list(f.supplier)).items[0].id
    const replies = await Promise.all([send(f.supplier, 'PATCH', '/notifications/' + id + '/read'), send(f.supplier, 'PATCH', '/notifications/' + id + '/read')])
    const receipts = await Promise.all(replies.map(async r => { expect(r.status).toBe(200); return NotificationReadSchema.parse(await r.json()) }))
    expect(receipts[0]).toEqual(receipts[1]); expect((await list(f.supplier)).unreadCount).toBe(0)
  })
  it('validates cursor/limit and authentication, including zero and unsafe numbers', async () => {
    for (const query of ['?limit=0', '?limit=51', '?limit=abc', '?cursor=1%20OR%201=1', '?cursor=9007199254740992']) expect((await send('comprador:mp09-user', 'GET', '/notifications' + query)).status).toBe(400)
    expect((await app().fetch(new Request('http://localhost/notifications'), env)).status).toBe(401)
    expect((await destination('comprador:mp09-user', '0')).status).toBe(404)
  })
})
