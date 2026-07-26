import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { productsGetHandler } from '../src/routes/products'
import { products } from '../src/schema/products'
import type { Env, AppContext } from '../src/env'
import app from '../src/index'

describe('GET /products', () => {
  let testProductId: string

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

    // Fixture: inserir 1 produto despublicado (active=false) associado a uid-fornecedor-teste
    const db = drizzle(env.DB)
    testProductId = `test-product-${Date.now()}`
    await db.insert(products).values({
      id: testProductId,
      supplierId: 'uid-fornecedor-teste',
      name: 'Produto Teste Despublicado',
      brand: 'Marca Teste',
      size: 'M',
      quantity: 100,
      slug: 'produto-teste-despublicado',
      categoria: 'teste',
      descricao: 'Descrição de teste',
      atributos: {},
      priceCents: 9999,
      active: false,
    })
  })

  /**
   * Cria um app de teste com middleware condicional de autenticacao.
   * fakeVerify reconhece token-uid-fornecedor-teste.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-uid-fornecedor-teste') return { uid: 'uid-fornecedor-teste' }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

    // Middleware condicional identico ao de index.ts
    testApp.use('/products', async (c, next) => {
      if (c.req.query('scope') !== 'fornecedor') {
        return next()
      }
      const authMiddleware = createAuthMiddleware(fakeVerify)
      return authMiddleware(c, next)
    })

    testApp.get('/products', productsGetHandler)

    return testApp
  }

  it('GET /products sem scope → retorna 200 (rota publica)', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
  })

  it('GET /products sem scope → retorna 24 produtos (so active=true, sem o despublicado)', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const body = (await response.json()) as unknown

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(24)
    const firstProduct = (body as unknown[])[0] as Record<string, unknown>
    expect(firstProduct).toHaveProperty('id')
    expect(firstProduct).toHaveProperty('priceCents')
    expect(firstProduct).toHaveProperty('supplierId')
    expect(typeof firstProduct.priceCents).toBe('number')

    // Nao deve conter o produto despublicado
    const ids = (body as unknown[]).map((p: unknown) => (p as Record<string, unknown>).id)
    expect(ids).not.toContain(testProductId)
  })

  it('GET /products?scope=fornecedor sem token → retorna 401', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products?scope=fornecedor')
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('GET /products?scope=fornecedor com token invalido → retorna 401', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products?scope=fornecedor', {
      headers: { Authorization: 'Bearer token-invalido' },
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('GET /products?scope=fornecedor com token valido → retorna todos os produtos do uid (ativos+inativos)', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products?scope=fornecedor', {
      headers: { Authorization: 'Bearer token-uid-fornecedor-teste' },
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown[]

    expect(Array.isArray(body)).toBe(true)
    // Deve conter exatamente 1 produto (o despublicado que inserimos)
    expect(body).toHaveLength(1)
    expect((body[0] as Record<string, unknown>).id).toBe(testProductId)
    expect((body[0] as Record<string, unknown>).active).toBe(false)
    expect((body[0] as Record<string, unknown>).supplierId).toBe('uid-fornecedor-teste')
  })

  it('GET /products sem scope → regressao, continua retornando 24 produtos', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const body = (await response.json()) as unknown

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(24)
  })
})
