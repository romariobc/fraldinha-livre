import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { productsGetHandler, productsPostHandler, productsPutHandler, productsDeleteHandler } from '../src/routes/products'
import { products } from '../src/schema/products'
import type { Env, AppContext } from '../src/env'

describe('POST/PUT/DELETE /products — CRUD com autorizacao por dono', () => {
  let existingProductId: string
  let otherSupplierProductId: string

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

    const db = drizzle(env.DB)
    existingProductId = `crud-test-produto-1-${Date.now()}`
    otherSupplierProductId = `crud-test-produto-outro-${Date.now()}`

    // Fixture: produto do uid-fornecedor-teste (ativo)
    await db.insert(products).values({
      id: existingProductId,
      supplierId: 'uid-fornecedor-teste',
      name: 'Produto Existente',
      brand: 'Marca A',
      size: 'M',
      quantity: 50,
      slug: 'produto-existente',
      categoria: 'teste',
      descricao: 'Descrição',
      atributos: { faixaPeso: 'P', genero: 'unissex', absorcao: 'A', tecnologia: 'T' },
      priceCents: 1000,
      active: true,
    })

    // Fixture: produto de outro fornecedor
    await db.insert(products).values({
      id: otherSupplierProductId,
      supplierId: 'uid-outro-fornecedor',
      name: 'Produto Outro Fornecedor',
      brand: 'Marca B',
      size: 'L',
      quantity: 100,
      slug: 'produto-outro',
      categoria: 'teste',
      descricao: 'Descrição outro',
      atributos: { faixaPeso: 'M', genero: 'unissex', absorcao: 'B', tecnologia: 'T2' },
      priceCents: 2000,
      active: true,
    })
  })

  /**
   * Cria um app de teste com middleware e rotas CRUD.
   * fakeVerify reconhece token-uid-fornecedor-teste.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-uid-fornecedor-teste') return { uid: 'uid-fornecedor-teste' }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

    // Middleware condicional para /products (GET publico, POST/PUT/DELETE/scope=fornecedor exigem auth)
    testApp.use('/products', async (c, next) => {
      const isPublicGet = c.req.method === 'GET' && c.req.query('scope') !== 'fornecedor'
      if (isPublicGet) {
        return next()
      }
      const authMiddleware = createAuthMiddleware(fakeVerify)
      return authMiddleware(c, next)
    })

    testApp.get('/products', productsGetHandler)
    testApp.post('/products', productsPostHandler)

    // /products/:id (PUT/DELETE) sempre autenticado
    testApp.use('/products/:id', (c, next) => {
      const authMiddleware = createAuthMiddleware(fakeVerify)
      return authMiddleware(c, next)
    })
    testApp.put('/products/:id', productsPutHandler)
    testApp.delete('/products/:id', productsDeleteHandler)

    return testApp
  }

  // ===== POST /products =====
  it('POST /products sem token → 401', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Novo Produto',
        brand: 'Nova Marca',
        size: 'P',
        quantity: 10,
        slug: 'novo-produto',
        categoria: 'test',
        descricao: 'Desc',
        atributos: { faixaPeso: 'P', genero: 'unissex', absorcao: 'A', tecnologia: 'T' },
        priceCents: 500,
      }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('POST /products com token valido, body sem campos obrigatorios → 400', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({
        name: 'Produto Incompleto',
        // Faltam campos obrigatórios como brand, size, slug, etc.
      }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error).toBe('invalid request')
    expect(body).toHaveProperty('details')
  })

  it('POST /products com token valido, body valido + extras (id/supplierId/active) → 201, servidor define esses campos', async () => {
    const testApp = createTestApp()
    const slugUnique = `produto-crud-${Date.now()}`
    const request = new Request('http://localhost/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({
        name: 'Produto Completo',
        brand: 'Marca Teste',
        size: 'M',
        quantity: 25,
        slug: slugUnique,
        categoria: 'roupa',
        descricao: 'Descrição completa',
        atributos: { faixaPeso: 'M', genero: 'unissex', absorcao: 'A', tecnologia: 'T' },
        priceCents: 1500,
        // Tentar enviar campos que devem ser ignorados
        id: 'id-do-cliente',
        supplierId: 'uid-cliente',
        active: false,
      }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(typeof body.id).toBe('string')
    expect(body.id).not.toBe('id-do-cliente') // Servidor gerou UUID, não usou o do body
    expect(body.supplierId).toBe('uid-fornecedor-teste') // Servidor usou uid do token
    expect(body.supplierId).not.toBe('uid-cliente')
    expect(body.active).toBe(true) // Servidor sempre cria como true
    expect(body.name).toBe('Produto Completo')
    expect(body.slug).toBe(slugUnique)
    expect(body.priceCents).toBe(1500)
  })

  // ===== PUT /products/:id =====
  it('PUT /products/:id de produto inexistente → 404', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products/inexistente-id', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({ active: false }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: 'product not found' })
  })

  it('PUT /products/:id de produto de outro fornecedor → 403', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${otherSupplierProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({ name: 'Nome Modificado' }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('PUT /products/:id do próprio produto com { active: false } → 200, desaparece do GET público', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${existingProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({ active: false }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.id).toBe(existingProductId)
    expect(body.active).toBe(false)

    // Verificar que desaparece do GET /products público
    const getPublicRequest = new Request('http://localhost/products')
    const getPublicResponse = await testApp.fetch(getPublicRequest, env)
    const publicProducts = (await getPublicResponse.json()) as unknown[]
    const ids = publicProducts.map((p: unknown) => (p as Record<string, unknown>).id)
    expect(ids).not.toContain(existingProductId)
  })

  it('PUT /products/:id do próprio produto com { active: true } → reaparece no público', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${existingProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({ active: true }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.active).toBe(true)

    // Verificar que reaparece no GET /products público
    const getPublicRequest = new Request('http://localhost/products')
    const getPublicResponse = await testApp.fetch(getPublicRequest, env)
    const publicProducts = (await getPublicResponse.json()) as unknown[]
    const product = publicProducts.find((p: unknown) => (p as Record<string, unknown>).id === existingProductId)
    expect(product).toBeDefined()
  })

  // ===== DELETE /products/:id =====
  it('DELETE /products/:id de produto inexistente → 404', async () => {
    const testApp = createTestApp()
    const request = new Request('http://localhost/products/inexistente-delete', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-uid-fornecedor-teste' },
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: 'product not found' })
  })

  it('DELETE /products/:id de produto de outro fornecedor → 403', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${otherSupplierProductId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-uid-fornecedor-teste' },
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('DELETE /products/:id do próprio produto → 204 sem corpo, nao aparece mais em nenhuma consulta', async () => {
    const testApp = createTestApp()

    // Criar um novo produto para deletar
    const deleteTestSlug = `produto-delete-${Date.now()}`
    const postRequest = new Request('http://localhost/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-fornecedor-teste',
      },
      body: JSON.stringify({
        name: 'Produto para Deletar',
        brand: 'Marca Delete',
        size: 'P',
        quantity: 5,
        slug: deleteTestSlug,
        categoria: 'temp',
        descricao: 'Será deletado',
        atributos: { faixaPeso: 'P', genero: 'unissex', absorcao: 'A', tecnologia: 'T' },
        priceCents: 300,
      }),
    })
    const postResponse = await testApp.fetch(postRequest, env)
    const createdProduct = (await postResponse.json()) as Record<string, unknown>
    const productIdToDelete = createdProduct.id as string

    // Deletar
    const deleteRequest = new Request(`http://localhost/products/${productIdToDelete}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-uid-fornecedor-teste' },
    })
    const deleteResponse = await testApp.fetch(deleteRequest, env)

    expect(deleteResponse.status).toBe(204)
    expect(await deleteResponse.text()).toBe('')

    // Verificar que não aparece em GET /products (público)
    const getPublicRequest = new Request('http://localhost/products')
    const getPublicResponse = await testApp.fetch(getPublicRequest, env)
    const publicProducts = (await getPublicResponse.json()) as unknown[]
    const idsPublic = publicProducts.map((p: unknown) => (p as Record<string, unknown>).id)
    expect(idsPublic).not.toContain(productIdToDelete)

    // Verificar que não aparece em GET /products?scope=fornecedor (do dono)
    const getScopeRequest = new Request('http://localhost/products?scope=fornecedor', {
      headers: { Authorization: 'Bearer token-uid-fornecedor-teste' },
    })
    const getScopeResponse = await testApp.fetch(getScopeRequest, env)
    const scopeProducts = (await getScopeResponse.json()) as unknown[]
    const idsScope = scopeProducts.map((p: unknown) => (p as Record<string, unknown>).id)
    expect(idsScope).not.toContain(productIdToDelete)
  })

  // ===== Casos de falta de token =====
  it('PUT /products/:id sem token → 401', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${existingProductId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('DELETE /products/:id sem token → 401', async () => {
    const testApp = createTestApp()
    const request = new Request(`http://localhost/products/${existingProductId}`, {
      method: 'DELETE',
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })
})
