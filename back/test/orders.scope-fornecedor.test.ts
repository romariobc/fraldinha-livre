import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersGetHandler } from '../src/routes/orders'
import type { Env, AppContext } from '../src/env'
import type { Order } from '../../packages/contracts/src/order'

describe('GET /orders?scope=fornecedor', () => {
  beforeAll(async () => {
    // Aplica migrations reais
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  /**
   * Cria um app de teste com middleware fake.
   * fakeVerify reconhece: token-fornecedor-a, token-fornecedor-b, token-comprador-a.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-fornecedor-a') return { uid: 'uid-fornecedor-a' }
      if (token === 'token-fornecedor-b') return { uid: 'uid-fornecedor-b' }
      if (token === 'token-comprador-a') return { uid: 'uid-comprador-a' }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.get('/orders', ordersGetHandler)

    return testApp
  }

  it('GET /orders?scope=fornecedor sem Authorization header → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders?scope=fornecedor')
    const response = await app.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('GET /orders?scope=fornecedor retorna pedidos cujos itens referenciam produtos do fornecedor', async () => {
    const app = createTestApp()

    const addressJson = JSON.stringify({
      logradouro: 'Rua A',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
    })

    // Seed: 2 fornecedores com seus produtos
    // Produto do fornecedor A
    await env.DB.prepare(`
      INSERT INTO products (id, name, brand, size, quantity, slug, categoria, descricao, price_cents, supplier_id, active)
      VALUES ('prod-fornecedor-a-1', 'Fralda A', 'Marca A', 'P', 100, 'fralda-a', 'Fraldas', 'Fralda tamanho P', 1000, 'uid-fornecedor-a', 1)
    `).run()

    // Produto do fornecedor B
    await env.DB.prepare(`
      INSERT INTO products (id, name, brand, size, quantity, slug, categoria, descricao, price_cents, supplier_id, active)
      VALUES ('prod-fornecedor-b-1', 'Fralda B', 'Marca B', 'M', 100, 'fralda-b', 'Fraldas', 'Fralda tamanho M', 1200, 'uid-fornecedor-b', 1)
    `).run()

    // Pedido 1: comprador-a pedindo produto do fornecedor A
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-comprador-a-1', 'uid-comprador-a', 'compra-direta', 'aguardando', 'Fralda A', 50, 'cx', ?, datetime('now'))
    `)
      .bind(addressJson)
      .run()

    // Item do pedido 1 referenciando produto do fornecedor A
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-comprador-a-1', 'prod-fornecedor-a-1', 'Fralda A', 1000, 50, 'cx')
    `).run()

    // Pedido 2: comprador-a pedindo produto do fornecedor B
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES ('order-comprador-a-2', 'uid-comprador-a', 'compra-direta', 'aguardando', 'Fralda B', 30, 'cx', ?, datetime('now'))
    `)
      .bind(addressJson)
      .run()

    // Item do pedido 2 referenciando produto do fornecedor B
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES ('order-comprador-a-2', 'prod-fornecedor-b-1', 'Fralda B', 1200, 30, 'cx')
    `).run()

    // GET /orders?scope=fornecedor com token do fornecedor A
    const request = new Request('http://localhost/orders?scope=fornecedor', {
      headers: { Authorization: 'Bearer token-fornecedor-a' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]

    // Deve retornar exatamente 1 pedido (o que tem item do fornecedor A)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)

    // O pedido retornado deve ter os items do fornecedor A
    expect(body[0].id).toBe('order-comprador-a-1')
    expect(body[0].items).toHaveLength(1)
    expect(body[0].items[0].productId).toBe('prod-fornecedor-a-1')
  })

  it('GET /orders?scope=fornecedor com fornecedor B não retorna pedidos do fornecedor A', async () => {
    const app = createTestApp()

    // Seed já foi feita no teste anterior, reutiliza

    // GET /orders?scope=fornecedor com token do fornecedor B
    const request = new Request('http://localhost/orders?scope=fornecedor', {
      headers: { Authorization: 'Bearer token-fornecedor-b' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]

    // Deve retornar exatamente 1 pedido (o que tem item do fornecedor B)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)

    // O pedido retornado deve ter os items do fornecedor B
    expect(body[0].id).toBe('order-comprador-a-2')
    expect(body[0].items).toHaveLength(1)
    expect(body[0].items[0].productId).toBe('prod-fornecedor-b-1')
  })

  it('GET /orders sem scope retorna pedidos por uid comprador (regressão)', async () => {
    const app = createTestApp()

    // Seed já foi feita nos testes anteriores, reutiliza

    // GET /orders SEM scope com token do comprador A
    const request = new Request('http://localhost/orders', {
      headers: { Authorization: 'Bearer token-comprador-a' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order[]

    // Deve retornar exatamente 2 pedidos (ambos do comprador-a)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)

    // Todos os pedidos devem ter uid === 'uid-comprador-a'
    expect(body.every((order) => order.uid === 'uid-comprador-a')).toBe(true)

    // Verificar que temos os 2 pedidos esperados
    const orderIds = body.map((o) => o.id).sort()
    expect(orderIds).toEqual(['order-comprador-a-1', 'order-comprador-a-2'])
  })
})
