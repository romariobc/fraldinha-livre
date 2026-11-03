import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { OrderDetailSchema, type OrderDetail } from '../../packages/contracts/src/order'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersDetailHandler, ordersGetHandler, ordersPostHandler, ordersStatusPatchHandler } from '../src/routes/orders'
import { approveFixtures } from './approve-fixtures'
const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
app.use('*', createAuthMiddleware(async token => { const [role, uid] = token.split(':'); return { uid, role } }))
app.get('/orders', ordersGetHandler)
app.get('/orders/:id', ordersDetailHandler)
app.post('/orders', ordersPostHandler)
app.patch('/orders/:id/status', ordersStatusPatchHandler)
function send(path: string, token = 'comprador:buyer-history', body?: unknown) {
  return app.fetch(new Request('http://localhost' + path, { method: body ? path.endsWith('/status') ? 'PATCH' : 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined }), { ...env, NOTIFICATIONS_ENABLED: 'false' })
}
async function fixture() {
  const productId = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO products (id, name, brand, size, slug, categoria, atributos, price_cents, supplier_id, quantity, active) VALUES (?, 'Snapshot original', 'QA', 'M', 'history', 'infantil', '{}', 100, 'supplier-history', 10, 1)`).bind(productId).run()
  const response = await send('/orders', undefined, { product: 'Snapshot original M', quantity: 2, unit: 'un', price: 200, supplierId: 'supplier-history', deliveryAddress: { logradouro: 'Rua preservada', numero: '7', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }, items: [{ productId, productName: 'Snapshot original M', quantity: 2, unitPrice: 100, unit: 'un' }] })
  expect(response.status).toBe(201)
  return { order: await response.json() as OrderDetail['order'], productId }
}
async function detail(id: string, scope = 'comprador', uid = 'buyer-history') {
  const response = await send('/orders/' + id + '?scope=' + scope, scope + ':' + uid)
  expect(response.status).toBe(200)
  return OrderDetailSchema.parse(await response.json())
}
describe('MP-06: snapshot e histórico persistidos para os três papéis', () => {
  beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); await approveFixtures(env.DB, 'supplier-history') })
  it('nova sessão dos três papéis recupera os mesmos dados e ciclo inteiro sem eventos duplicados', async () => {
    const { order } = await fixture()
    for (const status of ['confirmado', 'a-caminho', 'entregue']) expect((await send('/orders/' + order.id + '/status', 'fornecedor:supplier-history', { status })).status).toBe(200)
    // Same timestamp keeps insertion order rather than random UUID order.
    await env.DB.prepare('UPDATE order_events SET created_at = ? WHERE order_id = ?').bind('2026-11-02T12:00:00.000Z', order.id).run()
    const buyer = await detail(order.id)
    expect(buyer).toEqual(await detail(order.id, 'fornecedor', 'supplier-history'))
    expect(buyer).toEqual(await detail(order.id, 'admin', 'admin-history'))
    expect(buyer.historySource).toBe('complete')
    expect(buyer.events.map(event => event.toStatus)).toEqual(['aguardando', 'confirmado', 'a-caminho', 'entregue'])
    expect(buyer.events.map(event => event.actorId)).toEqual(['buyer-history', 'supplier-history', 'supplier-history', 'supplier-history'])
    expect(buyer.order.status).toBe('entregue')
    expect(await detail(order.id)).toEqual(buyer)
    expect(buyer.events[0]).not.toHaveProperty('requestId')
  })
  it('snapshot e escopo não seguem edição/transferência de produto', async () => {
    const { order, productId } = await fixture()
    await env.DB.prepare("UPDATE products SET name = 'Novo nome', price_cents = 999, supplier_id = 'other-supplier' WHERE id = ?").bind(productId).run()
    expect((await detail(order.id, 'fornecedor', 'supplier-history')).order).toEqual(order)
    const oldList = await (await send('/orders?scope=fornecedor', 'fornecedor:supplier-history')).json() as { id: string }[]
    expect(oldList.some(item => item.id === order.id)).toBe(true)
    const newList = await (await send('/orders?scope=fornecedor', 'fornecedor:other-supplier')).json() as { id: string }[]
    expect(newList.some(item => item.id === order.id)).toBe(false)
    expect((await send('/orders/' + order.id + '?scope=fornecedor', 'fornecedor:other-supplier')).status).toBe(403)
    expect((await send('/orders/' + order.id, 'comprador:other-buyer')).status).toBe(403)
    expect((await send('/orders/' + order.id + '?scope=admin')).status).toBe(403)
    expect((await send('/orders/' + order.id + '?scope=invalid')).status).toBe(400)
    expect((await send('/orders/missing')).status).toBe(404)
  })
  it('motivo do cancelamento fica vinculado ao evento e disponível para todos os papéis', async () => {
    const { order } = await fixture()
    expect((await send('/orders/' + order.id + '/status', 'admin:admin-history', { status: 'cancelado', reason: 'Motivo administrativo registrado' })).status).toBe(200)
    const history = await detail(order.id)
    expect(history.events[1]).toMatchObject({ fromStatus: 'aguardando', toStatus: 'cancelado', actorId: 'admin-history', reason: 'Motivo administrativo registrado' })
    expect(history).toEqual(await detail(order.id, 'fornecedor', 'supplier-history'))
  })
  it('legado sem eventos não inventa autor, data ou linhas; mudanças posteriores são histórico parcial', async () => {
    const { order } = await fixture()
    await env.DB.prepare('DELETE FROM order_events WHERE order_id = ?').bind(order.id).run()
    await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(order.id).run()
    const legacy = await detail(order.id)
    expect(legacy.historySource).toBe('legacy')
    expect(legacy.events).toEqual([])
    expect(legacy.order.items).toEqual([])
    expect((await detail(order.id, 'fornecedor', 'supplier-history')).historySource).toBe('legacy')
    expect((await send('/orders/' + order.id + '/status', 'fornecedor:supplier-history', { status: 'confirmado' })).status).toBe(200)
    const partial = await detail(order.id)
    expect(partial.historySource).toBe('partial')
    expect(partial.events).toHaveLength(1)
    expect(partial.events[0]).toMatchObject({ fromStatus: 'aguardando', toStatus: 'confirmado' })
  })
})
