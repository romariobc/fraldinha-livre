import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { OrderDetailSchema, type OrderDetail } from '../../packages/contracts/src/order'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersDetailHandler, ordersGetHandler, ordersPostHandler, ordersStatusPatchHandler, ordersCancelHandler } from '../src/routes/orders'
import { approveFixtures } from './approve-fixtures'
const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
app.use('*', createAuthMiddleware(async token => { const [role, uid] = token.split(':'); return { uid, role } }))
app.get('/orders', ordersGetHandler)
app.get('/orders/:id', ordersDetailHandler)
app.post('/orders', ordersPostHandler)
app.patch('/orders/:id/status', ordersStatusPatchHandler)
app.patch('/orders/:id/cancel', ordersCancelHandler)
function send(path: string, token = 'comprador:buyer-history', body?: unknown, method?: string) {
  return app.fetch(new Request('http://localhost' + path, { method: method ?? (body ? path.endsWith('/status') ? 'PATCH' : 'POST' : 'GET'), headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined }), { ...env, NOTIFICATIONS_ENABLED: 'false' })
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

describe('MP-07: operações e disputas com D1 real', () => {
  beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); await approveFixtures(env.DB, 'supplier-history') })
  const change = (id: string, status: string, role = 'fornecedor:supplier-history', reason?: string) => send('/orders/' + id + '/status', role, { status, reason })
  const cancel = (id: string) => send('/orders/' + id + '/cancel', 'comprador:buyer-history', undefined, 'PATCH')
  async function stock(productId: string) { return (await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(productId).first<{ quantity: number }>())!.quantity }
  it('fornecedor confirma, despacha e entrega; terminais não reabrem nem repetem eventos', async () => {
    const { order, productId } = await fixture()
    for (const status of ['confirmado','a-caminho','entregue']) expect((await change(order.id,status)).status).toBe(200)
    expect(await stock(productId)).toBe(8)
    for (const status of ['aguardando','confirmado','a-caminho','cancelado']) expect((await change(order.id,status,'fornecedor:supplier-history','Tentativa após entrega')).status).toBe(409)
    expect((await change(order.id,'entregue')).status).toBe(200)
    expect((await detail(order.id)).events).toHaveLength(4)
    expect((await cancel(order.id)).status).toBe(409)
  })
  it('comprador cancela apenas aguardando, repete sem duplicar restituição e não altera status de venda', async () => {
    const { order, productId } = await fixture()
    expect((await change(order.id,'confirmado','comprador:buyer-history')).status).toBe(403)
    expect((await cancel(order.id)).status).toBe(200)
    expect((await cancel(order.id)).status).toBe(200)
    expect(await stock(productId)).toBe(10)
    expect((await detail(order.id)).events).toHaveLength(2)
    expect((await change(order.id,'confirmado')).status).toBe(409)
  })
  it.each(['fornecedor:supplier-history','admin:admin-history'])('%s cancela antes do despacho com motivo obrigatório', async token => {
    const { order, productId } = await fixture()
    await change(order.id,'confirmado')
    expect((await change(order.id,'cancelado',token)).status).toBe(400)
    expect((await change(order.id,'cancelado',token,'    ')).status).toBe(400)
    expect((await change(order.id,'cancelado',token,'Motivo operacional QA')).status).toBe(200)
    expect(await stock(productId)).toBe(10)
    const history = await detail(order.id)
    expect(history.events[history.events.length - 1]).toMatchObject({ toStatus:'cancelado', reason:'Motivo operacional QA', actorId:token.split(':')[1] })
  })
  it('despacho impede cancelamento de todos os papéis; propriedade é validada pelo servidor', async () => {
    const { order, productId } = await fixture()
    expect((await change(order.id,'confirmado','fornecedor:other-supplier')).status).toBe(403)
    expect((await send('/orders/' + order.id + '/cancel','comprador:other-buyer',undefined,'PATCH')).status).toBe(403)
    await change(order.id,'confirmado')
    expect((await cancel(order.id)).status).toBe(409)
    await change(order.id,'a-caminho')
    expect((await cancel(order.id)).status).toBe(409)
    for (const token of ['fornecedor:supplier-history','admin:admin-history']) expect((await change(order.id,'cancelado',token,'Não pode após despacho')).status).toBe(409)
    expect(await stock(productId)).toBe(8)
    expect((await detail(order.id)).events).toHaveLength(3)
  })
  it('cancelamento do comprador versus confirmação: somente um vencedor, sem estado/estoque parcial', async () => {
    const { order, productId } = await fixture()
    const results = await Promise.all([cancel(order.id), change(order.id,'confirmado')])
    expect(results.map(result=>result.status).sort()).toEqual([200,409])
    const saved=await detail(order.id)
    expect(['confirmado','cancelado']).toContain(saved.order.status)
    expect(saved.events).toHaveLength(2)
    expect(await stock(productId)).toBe(saved.order.status==='cancelado'?10:8)
  })
  it('cancelamento versus despacho: uma transição ganha e nenhum cancelamento pode reverter despacho', async () => {
    const { order, productId } = await fixture(); await change(order.id,'confirmado')
    const results=await Promise.all([change(order.id,'cancelado','admin:admin-history','Disputa cancelamento QA'),change(order.id,'a-caminho')])
    expect(results.map(result=>result.status).sort()).toEqual([200,409])
    const saved=await detail(order.id)
    expect(['a-caminho','cancelado']).toContain(saved.order.status)
    expect(saved.events).toHaveLength(3)
    expect(await stock(productId)).toBe(saved.order.status==='cancelado'?10:8)
  })
})
