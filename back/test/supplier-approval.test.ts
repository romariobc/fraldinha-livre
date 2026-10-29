import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { supplierApplicationHandler, supplierApplicationsListHandler, supplierDecisionHandler } from '../src/routes/suppliers'
import { productsGetHandler, productsPostHandler, productsPutHandler } from '../src/routes/products'
import { ordersPostHandler, ordersGetHandler, ordersStatusPatchHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'

const product = { name: 'Teste', brand: 'Teste', size: 'M', quantity: 10, priceCents: 100,
  slug: 'teste', categoria: 'infantil', descricao: '', atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } }
const address = { logradouro: 'Rua teste', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }
function app() {
  const a = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  a.onError((_, c) => c.json({ error: 'test failure' }, 500))
  a.use('*', createAuthMiddleware(async token => {
    if (token === 'anonymous') return null
    const role = token === 'admin' ? 'admin' : token === 'buyer' ? 'comprador' : 'fornecedor'
    return { uid: token, role, claims: { role } }
  }))
  a.get('/application', supplierApplicationHandler); a.post('/application', supplierApplicationHandler)
  a.get('/admin/suppliers', supplierApplicationsListHandler); a.patch('/admin/suppliers/:uid', supplierDecisionHandler)
  a.get('/products', productsGetHandler); a.post('/products', productsPostHandler); a.put('/products/:id', productsPutHandler)
  a.get('/orders', ordersGetHandler); a.post('/orders', ordersPostHandler); a.patch('/orders/:id/status', ordersStatusPatchHandler)
  return a
}
async function send(token: string, method: string, path: string, body?: unknown, db = env.DB, key = crypto.randomUUID()) {
  return app().fetch(new Request('http://localhost' + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body) }), { ...env, DB: db })
}
async function apply(uid = 'supplier-' + crypto.randomUUID()) {
  expect((await send(uid, 'POST', '/application')).status).toBe(200)
  return uid
}
async function decide(uid: string, status: string, expectedVersion: number, reason = 'Análise administrativa de teste') {
  return send('admin', 'PATCH', '/admin/suppliers/' + uid, { status, expectedVersion, reason })
}
async function approved() {
  const uid = await apply()
  expect((await decide(uid, 'aprovado', 0)).status).toBe(200)
  return uid
}
async function offer(uid: string) {
  const response = await send(uid, 'POST', '/products', product)
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string }
}
const order = (uid: string, id: string) => ({ product: 'Teste', quantity: 1, unit: 'un', price: 100, supplierId: uid,
  deliveryAddress: address, items: [{ productId: id, productName: 'Teste', unitPrice: 100, quantity: 1, unit: 'un' }] })

describe('MP-03 — aprovação comercial com D1 real e identidades de teste', () => {
  beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS) })
  it('migração não aprova nem cadastra fornecedores legados', async () => {
    const row = await env.DB.prepare("SELECT count(*) AS n FROM supplier_applications WHERE uid LIKE 'sup-%'").first<{ n: number }>()
    expect(row!.n).toBe(0)
    expect((await (await send('buyer', 'GET', '/products')).json() as unknown[])).toHaveLength(0)
  })
  it('somente fornecedor autenticado solicita; UID/status do body não dão autoridade', async () => {
    expect((await send('anonymous', 'POST', '/application')).status).toBe(401)
    expect((await send('buyer', 'POST', '/application')).status).toBe(403)
    const uid = 'supplier-' + crypto.randomUUID()
    const response = await send(uid, 'POST', '/application', { uid: 'victim', status: 'aprovado' })
    const data = await response.json() as { application: { uid: string; status: string } }
    expect(data.application).toMatchObject({ uid, status: 'pendente' })
    expect(await env.DB.prepare("SELECT uid FROM supplier_applications WHERE uid = 'victim'").first()).toBeNull()
  })
  it('retries concorrentes da solicitação criam uma única pendência e preservam decisões', async () => {
    const uid = 'supplier-' + crypto.randomUUID()
    const responses = await Promise.all([send(uid, 'POST', '/application'), send(uid, 'POST', '/application')])
    expect(responses.map(r => r.status)).toEqual([200, 200])
    expect((await decide(uid, 'rejeitado', 0)).status).toBe(200)
    const data = await (await send(uid, 'POST', '/application')).json() as { application: { status: string; version: number } }
    expect(data.application).toMatchObject({ status: 'rejeitado', version: 1 })
  })
  it('claim de fornecedor sem registro, pendente e rejeitado não publicam nem recebem nova compra', async () => {
    for (const state of ['missing', 'pendente', 'rejeitado']) {
      const uid = state === 'missing' ? 'supplier-' + crypto.randomUUID() : await apply()
      if (state === 'rejeitado') await decide(uid, 'rejeitado', 0)
      expect((await send(uid, 'POST', '/products', product)).status).toBe(403)
      const id = crypto.randomUUID()
      await env.DB.prepare('INSERT INTO products (id, supplier_id, price_cents, quantity) VALUES (?, ?, 100, 10)').bind(id, uid).run()
      const response = await send('buyer', 'POST', '/orders', order(uid, id))
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'SUPPLIER_NOT_APPROVED' } })
    }
  })
  it('API nega decisões/listagem ao fornecedor e exige motivo, versão e transição válidos', async () => {
    const uid = await apply()
    expect((await send(uid, 'GET', '/admin/suppliers')).status).toBe(403)
    expect((await send(uid, 'PATCH', '/admin/suppliers/' + uid, { status: 'aprovado', expectedVersion: 0, reason: 'teste' })).status).toBe(403)
    expect((await decide(uid, 'aprovado', 0, '  ')).status).toBe(400)
    expect((await decide(uid, 'suspenso', 0)).status).toBe(409)
    expect((await decide(uid, 'pendente', 0)).status).toBe(400)
    expect((await decide(uid, 'aprovado', 9)).status).toBe(409)
  })
  it('admin aprova, retry não duplica auditoria, atualização obsoleta não sobrescreve suspensão', async () => {
    const uid = await approved()
    expect((await decide(uid, 'aprovado', 0)).status).toBe(200)
    const audit = await env.DB.prepare('SELECT * FROM audit_logs WHERE target_id = ?').bind(uid).all<{ actor_id: string; reason: string; metadata: string }>()
    expect(audit.results).toHaveLength(1)
    expect(audit.results[0].actor_id).toBe('admin')
    expect(JSON.parse(audit.results[0].metadata)).toMatchObject({ oldStatus: 'pendente', newStatus: 'aprovado', version: 1 })
    await decide(uid, 'suspenso', 1)
    expect((await decide(uid, 'aprovado', 0)).status).toBe(409)
  })
  it('duas decisões concorrentes com a mesma versão têm um único vencedor e um único evento', async () => {
    const uid = await apply()
    const responses = await Promise.all([decide(uid, 'aprovado', 0), decide(uid, 'rejeitado', 0)])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect((await env.DB.prepare('SELECT count(*) AS n FROM audit_logs WHERE target_id = ?').bind(uid).first<{ n: number }>())!.n).toBe(1)
  })
  it('falha na gravação da decisão reverte auditoria; retry depois da falha conclui', async () => {
    const uid = await apply()
    const trigger = 'fault_' + crypto.randomUUID().replaceAll('-', '')
    await env.DB.exec(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON supplier_applications WHEN OLD.uid = '${uid}' BEGIN SELECT RAISE(ABORT, 'test'); END;`)
    try { expect((await decide(uid, 'aprovado', 0)).status).toBe(500) }
    finally { await env.DB.exec(`DROP TRIGGER ${trigger}`) }
    expect((await env.DB.prepare('SELECT count(*) AS n FROM audit_logs WHERE target_id = ?').bind(uid).first<{ n: number }>())!.n).toBe(0)
    expect((await decide(uid, 'aprovado', 0)).status).toBe(200)
  })
  it('suspensão oculta ofertas, bloqueia escrita/compra, preserva replay e atendimento do pedido anterior', async () => {
    const uid = await approved(); const p = await offer(uid); const payload = order(uid, p.id); const key = crypto.randomUUID()
    const response = await send('buyer', 'POST', '/orders', payload, env.DB, key)
    expect(response.status).toBe(201)
    const created = await response.json() as { id: string }
    expect((await decide(uid, 'suspenso', 1)).status).toBe(200)
    expect((await send(uid, 'PUT', '/products/' + p.id, { active: true })).status).toBe(403)
    const list = await (await send('buyer', 'GET', '/products')).json() as { id: string }[]
    expect(list.some(row => row.id === p.id)).toBe(false)
    expect((await send('buyer', 'POST', '/orders', payload)).status).toBe(409)
    expect((await send('buyer', 'POST', '/orders', payload, env.DB, key)).status).toBe(200)
    expect((await send(uid, 'GET', '/orders?scope=fornecedor')).status).toBe(200)
    expect((await send(uid, 'GET', '/products?scope=fornecedor')).status).toBe(200)
    for (const status of ['confirmado', 'a-caminho', 'entregue']) expect((await send(uid, 'PATCH', '/orders/' + created.id + '/status', { status })).status).toBe(200)
  })
  it('suspensão entre preflight e batch da compra impede reserva e evento', async () => {
    const uid = await approved(); const p = await offer(uid)
    const db = new Proxy(env.DB, { get(target, prop) {
      if (prop === 'batch') return async (...args: Parameters<Env['DB']['batch']>) => {
        await target.prepare("UPDATE supplier_applications SET status = 'suspenso' WHERE uid = ?").bind(uid).run()
        return target.batch(...args)
      }
      const v = Reflect.get(target, prop); return typeof v === 'function' ? v.bind(target) : v
    } })
    expect((await send('buyer', 'POST', '/orders', order(uid, p.id), db)).status).toBe(409)
    expect((await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(p.id).first<{ quantity: number }>())!.quantity).toBe(10)
  })
  it('paginação administrativa não perde solicitações além da primeira página', async () => {
    await env.DB.batch(Array.from({ length: 55 }, (_, i) => env.DB.prepare("INSERT INTO supplier_applications (uid, status, created_at, updated_at) VALUES (?, 'pendente', '2026-10-29', '2026-10-29')").bind('page-' + String(i).padStart(3, '0'))))
    const first = await (await send('admin', 'GET', '/admin/suppliers')).json() as { applications: { uid: string }[]; nextCursor: string }
    expect(first.applications).toHaveLength(50)
    const second = await (await send('admin', 'GET', '/admin/suppliers?cursor=' + encodeURIComponent(first.nextCursor))).json() as { applications: { uid: string }[] }
    expect(second.applications.length).toBeGreaterThan(0)
    expect(new Set([...first.applications, ...second.applications].map(r => r.uid)).size).toBe(first.applications.length + second.applications.length)
  })
})
