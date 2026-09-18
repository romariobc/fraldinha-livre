import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersGetHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'
import type { Order } from '../../packages/contracts/src/order'

describe('GET /orders?scope=admin', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-admin') return { uid: env.ADMIN_UID }
      if (token === 'token-admin-role') return { uid: 'uid-role-admin', role: 'admin' }
      if (token === 'token-admin-claim') return { uid: 'uid-claim-admin', claims: { admin: true } }
      if (token === 'token-fornecedor-a') return { uid: 'uid-fornecedor-a' }
      return null
    }
    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('*', async (c, next) => {
      c.set('requestId', 'req-test-orders-admin')
      await next()
    })
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.get('/orders', ordersGetHandler)
    return testApp
  }

  it('GET /orders?scope=admin com uid nao-admin → 403', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders?scope=admin', {
      headers: { Authorization: 'Bearer token-fornecedor-a' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(403)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('GET /orders?scope=admin sem token → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders?scope=admin')
    const response = await app.fetch(request, env)
    expect(response.status).toBe(401)
  })

  it('GET /orders?scope=admin com uid admin legado → retorna TODOS os pedidos, de qualquer uid', async () => {
    const app = createTestApp()
    const addressJson = JSON.stringify({
      logradouro: 'Rua A', numero: '123', bairro: 'Centro',
      cidade: 'São Paulo', estado: 'SP', cep: '01000-000',
    })
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-admin-teste-1', 'uid-comprador-x', 'compra-direta', 'aguardando', 'Fralda X', 10, 'un', ?, datetime('now'))
    `).bind(addressJson).run()

    const request = new Request('http://localhost/orders?scope=admin', {
      headers: { Authorization: 'Bearer token-admin' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((o) => o.id === 'order-admin-teste-1')).toBe(true)
  })

  it('GET /orders?scope=admin com Custom Claim role: admin → 200 (RBAC)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders?scope=admin', {
      headers: { Authorization: 'Bearer token-admin-role' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((o) => o.id === 'order-admin-teste-1')).toBe(true)
  })

  it('GET /orders?scope=admin com Custom Claim admin: true → 200 (RBAC)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders?scope=admin', {
      headers: { Authorization: 'Bearer token-admin-claim' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((o) => o.id === 'order-admin-teste-1')).toBe(true)
  })
})
