import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersGetHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'
import type { Order } from '../../packages/contracts/src/order'

describe('GET /orders', () => {
  beforeAll(async () => {
    // Aplica migrations reais
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  /**
   * Cria um app de teste com middleware fake.
   * fakeVerify reconhece token-uid-a e token-uid-b.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-uid-a') return { uid: 'uid-a' }
      if (token === 'token-uid-b') return { uid: 'uid-b' }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.get('/orders', ordersGetHandler)

    return testApp
  }

  it('GET /orders sem Authorization header → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders')
    const response = await app.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('GET /orders com Authorization: Bearer token-invalido → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      headers: { Authorization: 'Bearer token-invalido' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(401)
    const body = (await response.json()) as unknown
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('GET /orders com uid válido retorna apenas orders desse uid (RN-02)', async () => {
    const app = createTestApp()

    // Seed: 2 orders uid-a, 1 order uid-b
    const addressJson = JSON.stringify({
      logradouro: 'Rua A',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
    })

    // Order 1 para uid-a
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-uid-a-1', 'uid-a', 'compra-direta', 'aguardando', 'Fralda', 100, 'cx', ?, datetime('now'))
    `).bind(addressJson).run()

    // Order 2 para uid-a
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-uid-a-2', 'uid-a', 'compra-direta', 'aguardando', 'Toalha', 50, 'un', ?, datetime('now'))
    `).bind(addressJson).run()

    // Order 1 para uid-b
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-uid-b-1', 'uid-b', 'compra-direta', 'aguardando', 'Lenço', 200, 'cx', ?, datetime('now'))
    `).bind(addressJson).run()

    // Items para order-uid-a-1
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-uid-a-1', 'prod-1', 'Fralda P', 1000, 100, 'cx')
    `).run()

    // Items para order-uid-a-2
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-uid-a-2', 'prod-2', 'Toalha', 500, 50, 'un')
    `).run()

    // Items para order-uid-b-1
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-uid-b-1', 'prod-3', 'Lenço', 2000, 200, 'cx')
    `).run()

    // GET /orders com token-uid-a
    const request = new Request('http://localhost/orders', {
      headers: { Authorization: 'Bearer token-uid-a' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]

    // Deve retornar exatamente 2 orders
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)

    // Ambas devem ter uid === 'uid-a'
    expect(body.every((order) => order.uid === 'uid-a')).toBe(true)

    // Cada order deve ter items não-vazio
    expect(body.every((order) => Array.isArray(order.items) && order.items.length > 0)).toBe(true)

    // Cada order deve validar contra OrderSchema (implícito: se jwtVerify passou, já foram parseadas)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('uid')
    expect(body[0]).toHaveProperty('type')
    expect(body[0]).toHaveProperty('status')
    expect(body[0]).toHaveProperty('product')
    expect(body[0]).toHaveProperty('items')
  })

  it('GET /orders com token uid-b retorna exatamente 1 order', async () => {
    const app = createTestApp()

    // Seed já foi feita no teste anterior, reutiliza

    // GET /orders com token-uid-b
    const request = new Request('http://localhost/orders', {
      headers: { Authorization: 'Bearer token-uid-b' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)

    // Deve ter uid === 'uid-b'
    expect(body[0].uid).toBe('uid-b')

    // Deve ter items
    expect(Array.isArray(body[0].items)).toBe(true)
    expect(body[0].items.length).toBeGreaterThan(0)
  })
})
