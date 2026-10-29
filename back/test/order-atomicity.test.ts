import { approveFixtures, seedSuppliers } from './approve-fixtures'
import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersPostHandler, ordersCancelHandler, ordersStatusPatchHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'

type Bindings = { Bindings: Env; Variables: AppContext['Variables'] }
const address = { logradouro: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }

function app() {
  const api = new Hono<Bindings>()
  api.onError((_error, c) => c.json({ error: 'internal' }, 500))
  api.use('*', async (c, next) => { c.set('requestId', c.req.header('X-Request-Id') ?? 'mp02-test'); await next() })
  api.use('*', createAuthMiddleware(async (token) => {
    const role = token.startsWith('supplier') ? 'fornecedor' : token === 'admin' ? 'admin' : 'comprador'
    return { uid: token, role, claims: { role } }
  }))
  api.post('/orders', ordersPostHandler)
  api.patch('/orders/:id/cancel', ordersCancelHandler)
  api.patch('/orders/:id/status', ordersStatusPatchHandler)
  return api
}

async function fixture(count = 1, quantity = 10) {
  const items = []
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO products (id, name, price_cents, supplier_id, quantity, active) VALUES (?, ?, 100, ?, ?, 1)')
      .bind(id, 'Produto de teste', 'supplier-a', quantity).run()
    items.push({ productId: id, productName: 'Produto de teste', unitPrice: 100, quantity: 2, unit: 'un' as const })
  }
  return { product: 'Compra teste', quantity: count * 2, unit: 'un' as const, price: count * 200, supplierId: 'supplier-a', deliveryAddress: address, items }
}

async function send(method: string, path: string, body?: unknown, options: { token?: string; key?: string; db?: Env['DB']; requestId?: string } = {}) {
  return app().fetch(new Request('http://localhost' + path, {
    method, headers: { Authorization: 'Bearer ' + (options.token ?? 'buyer-a'), 'Content-Type': 'application/json',
      'Idempotency-Key': options.key ?? crypto.randomUUID(), 'X-Request-Id': options.requestId ?? 'mp02-test' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ...env, DB: options.db ?? env.DB })
}
async function create(payload: Awaited<ReturnType<typeof fixture>>) {
  const response = await send('POST', '/orders', payload)
  expect(response.status).toBe(201)
  return await response.json() as { id: string; status: string }
}
async function stock(productId: string) {
  return (await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(productId).first<{ quantity: number }>())!.quantity
}
async function state(orderId: string) {
  return (await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(orderId).first<{ status: string }>())!.status
}
async function eventCount(orderId: string) {
  return (await env.DB.prepare('SELECT count(*) AS n FROM order_events WHERE order_id = ?').bind(orderId).first<{ n: number }>())!.n
}
function barrierDatabase() {
  let arrivals = 0
  let release!: () => void
  const barrier = new Promise<void>((resolve) => { release = resolve })
  return new Proxy(env.DB, { get(target, prop) {
    if (prop === 'batch') return async (...args: Parameters<Env['DB']['batch']>) => {
      if (++arrivals === 2) release()
      await barrier
      return target.batch(...args)
    }
    const value = Reflect.get(target, prop)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
async function injectEventFailure(requestId: string, work: () => Promise<void>) {
  const name = 'mp02_fault_' + crypto.randomUUID().replaceAll('-', '')
  await env.DB.exec(`CREATE TRIGGER ${name} BEFORE INSERT ON order_events WHEN NEW.request_id = '${requestId}' BEGIN SELECT RAISE(ABORT, 'MP02_TEST_FAULT'); END;`)
  try { await work() } finally { await env.DB.exec(`DROP TRIGGER ${name};`) }
}

describe('MP-02: atomicidade em D1 pelos handlers reais', () => {
  beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    await approveFixtures(env.DB, ...seedSuppliers, 'uid-fornecedor-teste', 'uid-outro-fornecedor', 'uid-fornecedor-a', 'uid-fornecedor-b', 'supplier-a') })

  it('cria pedido/itens/estoque/evento juntos sem expor hash ou mutation_id', async () => {
    const payload = await fixture(2)
    const response = await send('POST', '/orders', { ...payload, uid: 'attacker' })
    expect(response.status).toBe(201)
    const order = await response.json() as { id: string; uid: string; mutationId?: string; requestFingerprint?: string }
    expect(order.uid).toBe('buyer-a')
    expect(order.mutationId).toBeUndefined()
    expect(order.requestFingerprint).toBeUndefined()
    expect(await stock(payload.items[0].productId)).toBe(8)
    expect(await stock(payload.items[1].productId)).toBe(8)
    expect(await eventCount(order.id)).toBe(1)
  })

  it('falha no evento final desfaz pedido, todos os itens e todos os decrementos', async () => {
    const payload = await fixture(2)
    const key = crypto.randomUUID()
    await injectEventFailure('create-failure', async () => {
      expect((await send('POST', '/orders', payload, { key, requestId: 'create-failure' })).status).toBe(500)
      expect(await stock(payload.items[0].productId)).toBe(10)
      expect(await stock(payload.items[1].productId)).toBe(10)
      const row = await env.DB.prepare('SELECT count(*) AS n FROM orders WHERE idempotency_key = ?').bind(key).first<{ n: number }>()
      expect(row!.n).toBe(0)
      const items = await env.DB.prepare('SELECT count(*) AS n FROM order_items WHERE product_id IN (?, ?)')
        .bind(...payload.items.map((i) => i.productId)).first<{ n: number }>()
      expect(items!.n).toBe(0)
    })
    expect((await send('POST', '/orders', payload, { key })).status).toBe(201)
  })

  it('duas compras concorrentes disputam o último estoque sem decremento parcial', async () => {
    const payload = await fixture(1, 2)
    const db = barrierDatabase()
    const responses = await Promise.all([send('POST', '/orders', payload, { db }), send('POST', '/orders', payload, { db })])
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await stock(payload.items[0].productId)).toBe(0)
  })

  it('retry concorrente da mesma chave devolve o pedido sem estoque/evento duplicado', async () => {
    const payload = await fixture()
    const db = barrierDatabase(), key = crypto.randomUUID()
    const responses = await Promise.all([send('POST', '/orders', payload, { db, key }), send('POST', '/orders', payload, { db, key })])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201])
    const [a, b] = await Promise.all(responses.map((r) => r.json() as Promise<{ id: string }>))
    expect(a.id).toBe(b.id)
    expect(await stock(payload.items[0].productId)).toBe(8)
    expect(await eventCount(a.id)).toBe(1)
  })

  it('mesma chave com conteúdo diferente conflita e com outro usuário nega acesso', async () => {
    const payload = await fixture(), key = crypto.randomUUID()
    expect((await send('POST', '/orders', payload, { key })).status).toBe(201)
    const conflict = await send('POST', '/orders', { ...payload, deliveryAddress: { ...address, numero: '2' } }, { key })
    expect(conflict.status).toBe(409)
    expect((await conflict.json() as { error: { code: string } }).error.code).toBe('IDEMPOTENCY_CONFLICT')
    expect((await send('POST', '/orders', payload, { key, token: 'buyer-b' })).status).toBe(403)
    expect(await stock(payload.items[0].productId)).toBe(8)
  })

  it('requisições concorrentes diferentes não compartilham resultado pela mesma chave', async () => {
    const payload = await fixture(), key = crypto.randomUUID(), db = barrierDatabase()
    const other = { ...payload, deliveryAddress: { ...address, numero: '2' } }
    const responses = await Promise.all([send('POST', '/orders', payload, { key, db }), send('POST', '/orders', other, { key, db })])
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await stock(payload.items[0].productId)).toBe(8)
    const row = await env.DB.prepare('SELECT id FROM orders WHERE idempotency_key = ?').bind(key).first<{ id: string }>()
    expect(await eventCount(row!.id)).toBe(1)
  })

  it('normaliza ordem dos itens e compara snapshot legado sem hash', async () => {
    const payload = await fixture(2), key = crypto.randomUUID()
    const first = await send('POST', '/orders', payload, { key })
    const order = await first.json() as { id: string }
    await env.DB.prepare('UPDATE orders SET request_fingerprint = NULL WHERE id = ?').bind(order.id).run()
    expect((await send('POST', '/orders', { ...payload, items: [...payload.items].reverse() }, { key })).status).toBe(200)
    expect((await send('POST', '/orders', { ...payload, price: payload.price + 1 }, { key })).status).toBe(409)
    expect(await eventCount(order.id)).toBe(1)
  })

  it('rejeita produtos duplicados sem consumir estoque', async () => {
    const payload = await fixture()
    expect((await send('POST', '/orders', { ...payload, items: [payload.items[0], payload.items[0]], price: 400 })).status).toBe(400)
    expect(await stock(payload.items[0].productId)).toBe(10)
  })

  it('recupera retry de snapshot legado com linhas repetidas sem nova escrita', async () => {
    const payload = await fixture(1, 6), key = crypto.randomUUID(), id = crypto.randomUUID()
    const legacy = { ...payload, quantity: 4, price: 400, items: [payload.items[0], payload.items[0]] }
    await env.DB.prepare(`INSERT INTO orders (id, uid, type, status, product, quantity, unit, price, supplier_id, delivery_address, created_at, idempotency_key)
      VALUES (?, 'buyer-a', 'compra-direta', 'aguardando', ?, 4, 'un', 400, 'supplier-a', ?, ?, ?)`)
      .bind(id, legacy.product, JSON.stringify(address), new Date().toISOString(), key).run()
    for (const item of legacy.items) {
      await env.DB.prepare('INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit) VALUES (?, ?, ?, 100, 2, ?)')
        .bind(id, item.productId, item.productName, item.unit).run()
    }
    const response = await send('POST', '/orders', legacy, { key })
    expect(response.status).toBe(200)
    expect((await response.json() as { id: string }).id).toBe(id)
    expect(await stock(payload.items[0].productId)).toBe(6)
    expect(await eventCount(id)).toBe(0)
  })

  it('valida uma sacola com 21 produtos sem exceder parâmetros na guarda SQL', async () => {
    const payload = await fixture(21)
    const order = await create(payload)
    expect(await eventCount(order.id)).toBe(1)
    expect(await stock(payload.items[0].productId)).toBe(8)
    expect(await stock(payload.items[20].productId)).toBe(8)
  })

  it('revalida preço dentro da transação quando o catálogo muda após a leitura', async () => {
    const payload = await fixture()
    const db = new Proxy(env.DB, { get(target, prop) {
      if (prop === 'batch') return async (...args: Parameters<Env['DB']['batch']>) => {
        await target.prepare('UPDATE products SET price_cents = 101 WHERE id = ?').bind(payload.items[0].productId).run()
        return target.batch(...args)
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    const response = await send('POST', '/orders', payload, { db })
    expect(response.status).toBe(400)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('PRICE_MISMATCH')
    expect(await stock(payload.items[0].productId)).toBe(10)
  })

  it('cancelamentos concorrentes do fornecedor restituem uma única vez', async () => {
    const payload = await fixture(), order = await create(payload), db = barrierDatabase()
    const opts = { db, token: 'supplier-a' }, body = { status: 'cancelado', reason: 'Sem disponibilidade' }
    const responses = await Promise.all([send('PATCH', '/orders/' + order.id + '/status', body, opts), send('PATCH', '/orders/' + order.id + '/status', body, opts)])
    expect(responses.map((r) => r.status)).toEqual([200, 200])
    expect(await stock(payload.items[0].productId)).toBe(10)
    expect(await eventCount(order.id)).toBe(2)
  })

  it('cancelamento do comprador contra confirmação tem um único vencedor', async () => {
    const payload = await fixture(), order = await create(payload), db = barrierDatabase()
    const responses = await Promise.all([
      send('PATCH', '/orders/' + order.id + '/cancel', undefined, { db }),
      send('PATCH', '/orders/' + order.id + '/status', { status: 'confirmado' }, { db, token: 'supplier-a' }),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    const result = await state(order.id)
    expect(['cancelado', 'confirmado']).toContain(result)
    expect(await stock(payload.items[0].productId)).toBe(result === 'cancelado' ? 10 : 8)
    expect(await eventCount(order.id)).toBe(2)
  })

  it('cancelamento contra despacho não sobrescreve o vencedor', async () => {
    const payload = await fixture(), order = await create(payload)
    await send('PATCH', '/orders/' + order.id + '/status', { status: 'confirmado' }, { token: 'supplier-a' })
    const db = barrierDatabase()
    const responses = await Promise.all([
      send('PATCH', '/orders/' + order.id + '/status', { status: 'cancelado', reason: 'Pedido indisponível' }, { db, token: 'supplier-a' }),
      send('PATCH', '/orders/' + order.id + '/status', { status: 'a-caminho' }, { db, token: 'supplier-a' }),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await stock(payload.items[0].productId)).toBe(await state(order.id) === 'cancelado' ? 10 : 8)
    expect(await eventCount(order.id)).toBe(3)
  })

  it('falha no evento do cancelamento desfaz status e restituição; retry funciona', async () => {
    const payload = await fixture(), order = await create(payload)
    await injectEventFailure('cancel-failure', async () => {
      const response = await send('PATCH', '/orders/' + order.id + '/cancel', undefined, { requestId: 'cancel-failure' })
      expect(response.status).toBe(500)
      expect(await state(order.id)).toBe('aguardando')
      expect(await stock(payload.items[0].productId)).toBe(8)
      expect(await eventCount(order.id)).toBe(1)
    })
    expect((await send('PATCH', '/orders/' + order.id + '/cancel')).status).toBe(200)
    expect((await send('PATCH', '/orders/' + order.id + '/cancel')).status).toBe(200)
    expect(await stock(payload.items[0].productId)).toBe(10)
    expect(await eventCount(order.id)).toBe(2)
  })

  it('falha no evento da confirmação não grava status parcial', async () => {
    const payload = await fixture(), order = await create(payload)
    await injectEventFailure('confirm-failure', async () => {
      const response = await send('PATCH', '/orders/' + order.id + '/status', { status: 'confirmado' }, { token: 'supplier-a', requestId: 'confirm-failure' })
      expect(response.status).toBe(500)
      expect(await state(order.id)).toBe('aguardando')
      expect(await stock(payload.items[0].productId)).toBe(8)
      expect(await eventCount(order.id)).toBe(1)
    })
  })

  it('exige motivo e proíbe cancelamento depois do despacho, inclusive para admin', async () => {
    const payload = await fixture(), order = await create(payload)
    const path = '/orders/' + order.id + '/status', opts = { token: 'supplier-a' }
    expect((await send('PATCH', path, { status: 'cancelado' }, opts)).status).toBe(400)
    expect((await send('PATCH', path, { status: 'confirmado' }, opts)).status).toBe(200)
    expect((await send('PATCH', '/orders/' + order.id + '/cancel')).status).toBe(409)
    expect((await send('PATCH', path, { status: 'a-caminho' }, opts)).status).toBe(200)
    expect((await send('PATCH', path, { status: 'cancelado', reason: 'Tentativa tardia' }, { token: 'admin' })).status).toBe(409)
    expect((await send('PATCH', path, { status: 'entregue' }, opts)).status).toBe(200)
    expect((await send('PATCH', path, { status: 'confirmado' }, opts)).status).toBe(409)
    expect(await stock(payload.items[0].productId)).toBe(8)
    expect(await eventCount(order.id)).toBe(4)
  })
})
