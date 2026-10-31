import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware } from '../src/middleware/auth'
import { productsGetHandler, productsPostHandler, productsPutHandler, productsDeleteHandler } from '../src/routes/products'
import { ordersPostHandler, ordersGetHandler, ordersCancelHandler } from '../src/routes/orders'
import { approveFixtures } from './approve-fixtures'
import { adminProductStatusPatchHandler } from '../src/routes/admin'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
app.use('*', async (c, next) => {
  c.set('requestId', 'mp04-test')
  if (c.req.method === 'GET' && c.req.path === '/products' && !c.req.query('scope')) return next()
  return createAuthMiddleware(async token => ({ uid: token,
    role: token.startsWith('supplier') ? 'fornecedor' : token.startsWith('admin') ? 'admin' : 'comprador' }))(c, next)
})
app.get('/products', productsGetHandler)
app.post('/products', productsPostHandler)
app.put('/products/:id', productsPutHandler)
app.delete('/products/:id', productsDeleteHandler)
app.post('/orders', ordersPostHandler)
app.get('/orders', ordersGetHandler)
app.patch('/orders/:id/cancel', ordersCancelHandler)
app.patch('/admin/products/:id/status', adminProductStatusPatchHandler)

async function send(method: string, route: string, body?: unknown, token = 'supplier-mp04-a', key = crypto.randomUUID()) {
  return app.fetch(new Request('http://localhost' + route, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env)
}
const draft = () => ({ name: 'Oferta original', brand: 'Marca QA', size: 'M', quantity: 8,
  priceCents: 1200, slug: 'oferta-mp04', categoria: 'fraldas', descricao: 'Demonstração',
  atributos: { faixaPeso: '5-10 kg', genero: 'unissex', absorcao: 'Padrão', tecnologia: 'Padrão' } })
async function create(token = 'supplier-mp04-a') {
  const response = await send('POST', '/products', draft(), token)
  expect(response.status).toBe(201)
  return await response.json() as { id: string; priceCents: number }
}
async function publicIds() {
  return (await (await send('GET', '/products')).json() as { id: string }[]).map(p => p.id)
}
const address = { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }
const purchase = (id: string) => ({ product: 'Nome adulterado', quantity: 2, unit: 'un', price: 2400,
  supplierId: 'supplier-mp04-a', supplierName: 'Fornecedor adulterado', deliveryAddress: address,
  items: [{ productId: id, productName: 'Nome adulterado', quantity: 2, unitPrice: 1200, unit: 'un' }] })

describe('MP-04: catálogo, manutenção e histórico pelos handlers reais/D1', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    await approveFixtures(env.DB, 'supplier-mp04-a', 'supplier-mp04-b')
  })

  it.each([{ priceCents: 0 }, { priceCents: -1 }, { priceCents: 1.5 },
    { quantity: -1 }, { quantity: 1.5 }, { name: '  ' }])('rejeita oferta inválida %j', async invalid => {
    expect((await send('POST', '/products', { ...draft(), ...invalid })).status).toBe(400)
  })

  it('não permite criar, editar ou remover sem habilitação comercial', async () => {
    const p = await create()
    expect((await send('POST', '/products', draft(), 'supplier-pending')).status).toBe(403)
    await env.DB.prepare("UPDATE supplier_applications SET status = 'suspenso' WHERE uid = ?").bind('supplier-mp04-a').run()
    try {
      expect((await send('PUT', '/products/' + p.id, { quantity: 20 })).status).toBe(403)
      expect((await send('DELETE', '/products/' + p.id)).status).toBe(403)
      expect(await publicIds()).not.toContain(p.id)
    } finally {
      await env.DB.prepare("UPDATE supplier_applications SET status = 'aprovado' WHERE uid = ?").bind('supplier-mp04-a').run()
    }
  })

  it('isola catálogo e escrita entre dois fornecedores e ignora identidade/preço antigo enviados', async () => {
    const response = await send('POST', '/products', { ...draft(), supplierId: 'attacker', oldPriceCents: 900000 })
    const p = await response.json() as { id: string; supplierId: string; oldPriceCents?: number | null }
    expect(p.supplierId).toBe('supplier-mp04-a')
    expect(p.oldPriceCents ?? null).toBeNull()
    const publicProducts = await (await send('GET', '/products')).json() as { id: string }[]
    expect(publicProducts.find(item => item.id === p.id)).not.toHaveProperty('supplierEmail')
    const b = await create('supplier-mp04-b')
    expect((await send('PUT', '/products/' + p.id, { priceCents: 2 }, 'supplier-mp04-b')).status).toBe(403)
    expect((await send('DELETE', '/products/' + p.id, undefined, 'supplier-mp04-b')).status).toBe(403)
    const own = await (await send('GET', '/products?scope=fornecedor', undefined, 'supplier-mp04-b')).json() as { id: string }[]
    expect(own.map(p => p.id)).toContain(b.id)
    expect(own.map(p => p.id)).not.toContain(p.id)
  })

  it('oculta sem estoque/despublicado e permite reposição e republicação', async () => {
    const p = await create()
    expect(await publicIds()).toContain(p.id)
    expect((await send('PUT', '/products/' + p.id, { quantity: 0 })).status).toBe(200)
    expect(await publicIds()).not.toContain(p.id)
    expect((await send('PUT', '/products/' + p.id, { quantity: 5, active: false })).status).toBe(200)
    expect(await publicIds()).not.toContain(p.id)
    await send('PUT', '/products/' + p.id, { active: true })
    expect(await publicIds()).toContain(p.id)
  })

  it('moderação não pode ser anulada pelo fornecedor nem pelo corpo da requisição', async () => {
    const p = await create()
    expect((await send('PATCH', '/admin/products/' + p.id + '/status', { active: false, reason: 'QA: oferta em revisão' }, 'admin-mp04')).status).toBe(200)
    expect(await publicIds()).not.toContain(p.id)
    expect((await send('PUT', '/products/' + p.id, { active: true, moderationBlocked: false })).status).toBe(403)
    expect((await send('POST', '/orders', purchase(p.id), 'buyer-mp04')).status).toBe(400)
    await send('PUT', '/products/' + p.id, { quantity: 50, moderationBlocked: false })
    expect(await publicIds()).not.toContain(p.id)
    expect((await send('PATCH', '/admin/products/' + p.id + '/status', { active: true, reason: 'QA: revisão concluída' }, 'admin-mp04')).status).toBe(200)
    expect(await publicIds()).toContain(p.id)
  })

  it('moderação entre preflight e transação impede a compra sem reservar estoque', async () => {
    const p = await create()
    const guarded = new Proxy(env.DB, { get(target, property) {
      if (property === 'batch') return async (...args: Parameters<Env['DB']['batch']>) => {
        await target.prepare('UPDATE products SET moderation_blocked = 1 WHERE id = ?').bind(p.id).run()
        return target.batch(...args)
      }
      const value = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    const response = await app.fetch(new Request('http://localhost/orders', { method: 'POST',
      headers: { Authorization: 'Bearer buyer-mp04', 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(purchase(p.id)),
    }), { ...env, DB: guarded })
    expect(response.status).toBe(400)
    expect(await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(p.id).first()).toMatchObject({ quantity: 8 })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').bind(p.id).first()).toMatchObject({ n: 0 })
  })

  it('revalida preço/estoque e não cria pedido nem baixa estoque quando divergentes', async () => {
    const p = await create()
    const payload = purchase(p.id)
    await send('PUT', '/products/' + p.id, { priceCents: 1300 })
    const stale = await send('POST', '/orders', payload, 'buyer-mp04')
    expect(stale.status).toBe(400)
    expect(await stale.json()).toMatchObject({ error: { code: 'PRICE_MISMATCH' } })
    await send('PUT', '/products/' + p.id, { priceCents: 1200, quantity: 1 })
    expect((await send('POST', '/orders', payload, 'buyer-mp04')).status).toBe(409)
    expect(await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(p.id).first()).toMatchObject({ quantity: 1 })
  })

  it('preserva snapshots canônicos e referências após editar/remover; replay e cancelamento continuam íntegros', async () => {
    const p = await create()
    const payload = purchase(p.id)
    const key = crypto.randomUUID()
    const created = await send('POST', '/orders', payload, 'buyer-mp04', key)
    expect(created.status).toBe(201)
    const order = await created.json() as { id: string }
    await send('PUT', '/products/' + p.id, { name: 'Nome novo', priceCents: 1800, quantity: 20 })
    expect((await send('DELETE', '/products/' + p.id)).status).toBe(204)
    expect(await publicIds()).not.toContain(p.id)
    expect(await env.DB.prepare('SELECT active FROM products WHERE id = ?').bind(p.id).first()).toMatchObject({ active: 0 })
    const replay = await send('POST', '/orders', payload, 'buyer-mp04', key)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ id: order.id, supplierId: 'supplier-mp04-a',
      supplierName: 'Fornecedor supplier-mp04-a', price: 2400, deliveryAddress: address,
      items: [{ productId: p.id, productName: 'Oferta original M', unitPrice: 1200, quantity: 2 }] })
    expect((await send('PATCH', '/orders/' + order.id + '/cancel', {}, 'buyer-mp04')).status).toBe(200)
    expect(await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind(p.id).first()).toMatchObject({ quantity: 22 })
  })
})
