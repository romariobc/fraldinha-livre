import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersPostHandler } from '../src/routes/orders'
import { respondError } from '../src/lib/errors'
import { approveFixtures } from './approve-fixtures'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
app.onError((_error, c) => respondError(c, 'INTERNAL_ERROR', 500, 'Falha simulada de infraestrutura.'))
app.use('*', createAuthMiddleware(async token => ({ uid: token, role: 'comprador' })))
app.post('/orders', ordersPostHandler)
const address = { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }
async function fixture(supplier = 'supplier-mp05-a', stock = 10) {
  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO products (id, name, brand, size, slug, categoria, atributos, price_cents, supplier_id, quantity, active)
    VALUES (?, 'Oferta QA', 'QA', 'M', 'oferta-qa', 'infantil', ?, 100, ?, ?, 1)`)
    .bind(id, JSON.stringify({ faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' }), supplier, stock).run()
  return { product: 'Oferta QA M', quantity: 2, unit: 'un', price: 200, supplierId: supplier, deliveryAddress: address,
    items: [{ productId: id, productName: 'Oferta QA M', unitPrice: 100, quantity: 2, unit: 'un' }] }
}
function send(body: unknown, key = crypto.randomUUID(), db: Env['DB'] = env.DB, token = 'buyer-mp05-a') {
  return app.fetch(new Request('http://localhost/orders', { method: 'POST', headers: {
    Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key,
  }, body: JSON.stringify(body) }), { ...env, DB: db, NOTIFICATIONS_ENABLED: 'false' })
}
async function counts(id: string) {
  return {
    stock: (await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(id).first<{ quantity: number }>())!.quantity,
    lines: (await env.DB.prepare('SELECT count(*) AS n FROM order_items WHERE product_id = ?').bind(id).first<{ n: number }>())!.n,
    events: (await env.DB.prepare('SELECT count(*) AS n FROM order_events WHERE order_id IN (SELECT order_id FROM order_items WHERE product_id = ?)').bind(id).first<{ n: number }>())!.n,
  }
}
describe('MP-05: simulação e recuperação com D1 real', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    await approveFixtures(env.DB, 'supplier-mp05-a', 'supplier-mp05-b')
  })
  it('servidor gera modo, status e transação; metadados forjados não viram cobrança real', async () => {
    const payload = await fixture()
    const response = await send({ ...payload, simulationOutcome: 'approved', paymentMethod: 'card',
      paymentMode: 'real', paymentTransactionId: 'forged-real-transaction', paymentStatus: 'approved', quantity: 99 })
    expect(response.status).toBe(201)
    const order = await response.json() as { id: string }
    expect(order).toMatchObject({ paymentMode: 'simulated', paymentMethod: 'card', paymentStatus: 'approved', paymentTransactionId: 'sim-' + order.id, quantity: 2 })
    expect(await env.DB.prepare('SELECT payment_mode, payment_status, payment_transaction_id FROM orders WHERE id = ?').bind(order.id).first())
      .toMatchObject({ payment_mode: 'simulated', payment_status: 'approved', payment_transaction_id: 'sim-' + order.id })
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it.each([{ simulationOutcome: 'declined' }, { paymentStatus: 'declined' }, { simulationOutcome: 'pending' }, { paymentStatus: 'pending' }])('recusa/pending não cria pedido, evento ou reserva %j', async scenario => {
    const payload = await fixture()
    expect((await send({ ...payload, ...scenario })).status).toBe(400)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 10, lines: 0, events: 0 })
  })
  it('compatibilidade sem metadados também recebe simulação decidida pelo servidor', async () => {
    const response = await send(await fixture())
    expect(await response.json()).toMatchObject({ paymentMode: 'simulated', paymentMethod: 'pix', paymentStatus: 'approved' })
  })
  it('resposta perdida após commit recupera o mesmo pedido e transação, mesmo após mudança no catálogo', async () => {
    const payload = await fixture(), key = crypto.randomUUID()
    const first = await send(payload, key), saved = await first.json() as { id: string; paymentTransactionId: string }
    await env.DB.prepare('UPDATE products SET active = 0, price_cents = 999 WHERE id = ?').bind(payload.items[0].productId).run()
    const retry = await send(payload, key)
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ id: saved.id, paymentTransactionId: saved.paymentTransactionId, paymentMode: 'simulated', price: 200 })
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it('falha antes do commit não reserva; mesma chave permite retry íntegro', async () => {
    const payload = await fixture(), key = crypto.randomUUID()
    const fault = new Proxy(env.DB, { get(target, property) {
      if (property === 'batch') return () => { throw new Error('transport before commit') }
      const value = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    expect((await send(payload, key, fault)).status).toBe(500)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 10, lines: 0, events: 0 })
    expect((await send(payload, key)).status).toBe(201)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it('clique concorrente produz um pedido e uma única reserva', async () => {
    const payload = await fixture(), key = crypto.randomUUID()
    const responses = await Promise.all([send(payload, key), send(payload, key)])
    expect(responses.map(response => response.status).sort()).toEqual([200, 201])
    const orders = await Promise.all(responses.map(response => response.json())) as { id: string; paymentTransactionId: string }[]
    expect(orders[0].id).toBe(orders[1].id)
    expect(orders[0].paymentTransactionId).toBe(orders[1].paymentTransactionId)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it('sucesso parcial não desfaz fornecedor A nem muda a chave de B', async () => {
    const a = await fixture(), b = await fixture('supplier-mp05-b', 1), base = crypto.randomUUID()
    expect((await send(a, base + ':a')).status).toBe(201)
    expect((await send(b, base + ':b')).status).toBe(409)
    expect(await counts(a.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
    expect(await counts(b.items[0].productId)).toEqual({ stock: 1, lines: 0, events: 0 })
    await env.DB.prepare('UPDATE products SET quantity = 10 WHERE id = ?').bind(b.items[0].productId).run()
    expect((await send(b, base + ':b')).status).toBe(201)
    expect((await send(a, base + ':a')).status).toBe(200)
    expect(await counts(a.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
    expect(await counts(b.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it('outra conta não recupera pedido pela chave do comprador', async () => {
    const payload = await fixture(), key = crypto.randomUUID()
    await send(payload, key)
    expect((await send(payload, key, env.DB, 'buyer-mp05-b')).status).toBe(403)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 8, lines: 1, events: 1 })
  })
  it.each([{ ...address, bairro: ' ' }, { ...address, cep: '123' }, { ...address, estado: '   ' }])('endereço inválido não cria pedido %j', async deliveryAddress => {
    const payload = await fixture()
    expect((await send({ ...payload, deliveryAddress })).status).toBe(400)
    expect(await counts(payload.items[0].productId)).toEqual({ stock: 10, lines: 0, events: 0 })
  })
})
