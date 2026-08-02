import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { productsGetHandler } from '../src/routes/products'
import { products } from '../src/schema/products'
import type { Env, AppContext } from '../src/env'

describe('GET /products?scope=admin', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    const db = drizzle(env.DB)
    await db.insert(products).values({
      id: 'produto-admin-teste',
      supplierId: 'uid-fornecedor-teste',
      name: 'Produto Admin Teste',
      brand: 'Marca Teste',
      size: 'M',
      quantity: 10,
      slug: 'produto-admin-teste',
      categoria: 'teste',
      descricao: 'Descricao',
      atributos: { faixaPeso: '5-9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'teste' },
      priceCents: 5000,
      active: false,
    })
  })

  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-admin') return { uid: env.ADMIN_UID }
      if (token === 'token-fornecedor-teste') return { uid: 'uid-fornecedor-teste' }
      return null
    }
    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('/products', async (c, next) => {
      const scope = c.req.query('scope')
      const isPublicGet = c.req.method === 'GET' && scope !== 'fornecedor' && scope !== 'admin'
      if (isPublicGet) return next()
      return createAuthMiddleware(fakeVerify)(c, next)
    })
    testApp.get('/products', productsGetHandler)
    return testApp
  }

  it('GET /products?scope=admin sem token → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/products?scope=admin')
    const response = await app.fetch(request, env)
    expect(response.status).toBe(401)
  })

  it('GET /products?scope=admin com uid nao-admin → 403', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/products?scope=admin', {
      headers: { Authorization: 'Bearer token-fornecedor-teste' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(403)
  })

  it('GET /products?scope=admin com uid admin → retorna produtos ativos e inativos de qualquer fornecedor', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/products?scope=admin', {
      headers: { Authorization: 'Bearer token-admin' },
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown[]
    const ids = body.map((p) => (p as Record<string, unknown>).id)
    expect(ids).toContain('produto-admin-teste')
  })
})
