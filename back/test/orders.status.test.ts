import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersStatusPatchHandler, ordersGetHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'
import type { Order } from '../../packages/contracts/src/order'

describe('PATCH /orders/:id/status', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-fornecedor-a') return { uid: 'uid-fornecedor-a', role: 'fornecedor' }
      if (token === 'token-fornecedor-b') return { uid: 'uid-fornecedor-b', role: 'fornecedor' }
      if (token === 'token-comprador-a') return { uid: 'uid-comprador-a', role: 'comprador' }
      if (token === 'token-admin') return { uid: 'uid-admin', role: 'admin', claims: { admin: true } }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('*', async (c, next) => {
      c.set('requestId', 'req-test-orders-status')
      await next()
    })
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.patch('/orders/:id/status', ordersStatusPatchHandler)
    testApp.get('/orders', ordersGetHandler)

    return testApp
  }

  const addressJson = JSON.stringify({
    logradouro: 'Rua das Flores',
    numero: '123',
    bairro: 'Jardins',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01400-000',
  })

  it('PATCH /orders/:id/status sem Authorization header → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders/order-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(401)
  })

  it('PATCH /orders/:id/status com token de comprador → 403 (RBAC)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders/order-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-comprador-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(403)
  })

  it('PATCH /orders/:id/status com id inexistente → 404', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders/order-inexistente/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(404)
  })

  it('PATCH /orders/:id/status por fornecedor alheio → 403', async () => {
    const app = createTestApp()

    // Seed produto do fornecedor A
    await env.DB.prepare(`
      INSERT INTO products (id, name, brand, size, quantity, slug, categoria, descricao, price_cents, supplier_id, active)
      VALUES ('prod-status-a', 'Fralda Status A', 'Marca A', 'G', 100, 'fralda-status-a', 'Fraldas', 'Desc', 2000, 'uid-fornecedor-a', 1)
    `).run()

    // Pedido vinculado ao fornecedor A
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, price, supplier_id, delivery_address, created_at)
      VALUES ('order-status-1', 'uid-comprador-a', 'compra-direta', 'aguardando', 'Fralda Status A', 10, 'cx', 20000, 'uid-fornecedor-a', ?, datetime('now'))
    `)
      .bind(addressJson)
      .run()

    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-status-1', 'prod-status-a', 'Fralda Status A', 2000, 10, 'cx')
    `).run()

    // Fornecedor B tenta alterar status do pedido do Fornecedor A
    const request = new Request('http://localhost/orders/order-status-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-b',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(403)
  })

  it('Ciclo completo: aguardando -> confirmado -> a-caminho -> entregue pelo fornecedor', async () => {
    const app = createTestApp()

    // 1. aguardando -> confirmado
    const req1 = new Request('http://localhost/orders/order-status-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const res1 = await app.fetch(req1, env)
    expect(res1.status).toBe(200)
    const order1 = (await res1.json()) as Order
    expect(order1.status).toBe('confirmado')

    // 2. confirmado -> a-caminho
    const req2 = new Request('http://localhost/orders/order-status-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'a-caminho' }),
    })
    const res2 = await app.fetch(req2, env)
    expect(res2.status).toBe(200)
    const order2 = (await res2.json()) as Order
    expect(order2.status).toBe('a-caminho')

    // 3. a-caminho -> entregue
    const req3 = new Request('http://localhost/orders/order-status-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'entregue' }),
    })
    const res3 = await app.fetch(req3, env)
    expect(res3.status).toBe(200)
    const order3 = (await res3.json()) as Order
    expect(order3.status).toBe('entregue')

    // 4. entregue -> cancelado (estado terminal deve rejeitar com 409)
    const req4 = new Request('http://localhost/orders/order-status-1/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelado' }),
    })
    const res4 = await app.fetch(req4, env)
    expect(res4.status).toBe(409)
  })

  it('Cancelamento pelo fornecedor restaura o estoque dos produtos no D1', async () => {
    const app = createTestApp()

    // Produto com estoque 50
    await env.DB.prepare(`
      INSERT INTO products (id, name, brand, size, quantity, slug, categoria, descricao, price_cents, supplier_id, active)
      VALUES ('prod-status-cancel', 'Fralda Cancel', 'Marca A', 'G', 50, 'fralda-cancel', 'Fraldas', 'Desc', 1000, 'uid-fornecedor-a', 1)
    `).run()

    // Pedido aguardando com 15 itens
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, price, supplier_id, delivery_address, created_at)
      VALUES ('order-to-cancel-by-sup', 'uid-comprador-a', 'compra-direta', 'aguardando', 'Fralda Cancel', 15, 'cx', 15000, 'uid-fornecedor-a', ?, datetime('now'))
    `)
      .bind(addressJson)
      .run()

    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-to-cancel-by-sup', 'prod-status-cancel', 'Fralda Cancel', 1000, 15, 'cx')
    `).run()

    // Cancela o pedido
    const req = new Request('http://localhost/orders/order-to-cancel-by-sup/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-fornecedor-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelado' }),
    })
    const res = await app.fetch(req, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Order
    expect(body.status).toBe('cancelado')

    // Verifica que o estoque subiu de 50 para 65 (+15)
    const product = (await env.DB.prepare('SELECT quantity FROM products WHERE id = ?').bind('prod-status-cancel').first()) as any
    expect(product.quantity).toBe(65)
  })

  it('Admin pode atualizar status de qualquer pedido', async () => {
    const app = createTestApp()

    // Pedido criado pelo fornecedor A
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, price, supplier_id, delivery_address, created_at)
      VALUES ('order-admin-update', 'uid-comprador-a', 'compra-direta', 'aguardando', 'Fralda A', 5, 'cx', 5000, 'uid-fornecedor-a', ?, datetime('now'))
    `)
      .bind(addressJson)
      .run()

    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-admin-update', 'prod-status-a', 'Fralda Status A', 1000, 5, 'cx')
    `).run()

    // Admin atualiza para confirmado
    const req = new Request('http://localhost/orders/order-admin-update/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const res = await app.fetch(req, env)
    expect(res.status).toBe(200)
    const order = (await res.json()) as Order
    expect(order.status).toBe('confirmado')
  })
})
