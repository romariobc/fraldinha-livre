import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { createAuthMiddleware, requireAnyRole, requireRole } from '../src/middleware/auth'
import { productsGetHandler, productsPostHandler, productsPutHandler, productsDeleteHandler } from '../src/routes/products'
import { ordersGetHandler, ordersPostHandler, ordersCancelHandler, ordersReportHandler } from '../src/routes/orders'
import { products } from '../src/schema/products'
import { orders, orderItems } from '../src/schema/orders'
import type { Env, AppContext } from '../src/env'

describe('RBAC Adversarial & Comprehensive Access Matrix Suite', () => {
  let prodFornecedorAId: string
  let prodFornecedorBId: string
  let orderFornecedorAId: string

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

    const db = drizzle(env.DB)
    prodFornecedorAId = `prod-adv-fornecedor-a-${Date.now()}`
    prodFornecedorBId = `prod-adv-fornecedor-b-${Date.now()}`
    orderFornecedorAId = `order-adv-a-${Date.now()}`

    // Produto do Fornecedor A
    await db.insert(products).values({
      id: prodFornecedorAId,
      supplierId: 'uid-fornecedor-a',
      name: 'Fralda Fornecedor A',
      brand: 'Pampers',
      size: 'P',
      quantity: 50,
      slug: `fralda-fornecedor-a-${Date.now()}`,
      categoria: 'fraldas',
      descricao: 'Descricao A',
      atributos: { faixaPeso: '5-9kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
      priceCents: 1500,
      active: true,
    })

    // Produto do Fornecedor B
    await db.insert(products).values({
      id: prodFornecedorBId,
      supplierId: 'uid-fornecedor-b',
      name: 'Fralda Fornecedor B',
      brand: 'Huggies',
      size: 'M',
      quantity: 60,
      slug: `fralda-fornecedor-b-${Date.now()}`,
      categoria: 'fraldas',
      descricao: 'Descricao B',
      atributos: { faixaPeso: '9-12kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
      priceCents: 1800,
      active: true,
    })

    // Pedido do Comprador com item do Fornecedor A
    const addressJson = JSON.stringify({
      logradouro: 'Rua das Flores',
      numero: '100',
      bairro: 'Jardim',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01234-000',
    })

    await db.insert(orders).values({
      id: orderFornecedorAId,
      uid: 'uid-comprador-teste',
      type: 'compra-direta',
      status: 'aguardando',
      product: 'Fralda Fornecedor A',
      quantity: 2,
      unit: 'cx',
      deliveryAddress: addressJson,
      supplierId: 'uid-fornecedor-a',
      price: 3000,
      createdAt: new Date().toISOString(),
    })

    await db.insert(orderItems).values({
      orderId: orderFornecedorAId,
      productId: prodFornecedorAId,
      productName: 'Fralda Fornecedor A',
      unitPrice: 1500,
      quantity: 2,
      unit: 'cx',
    })
  })

  /**
   * Constrói o app de teste integrando os middlewares e handlers idênticos ao back/src/index.ts.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-comprador') {
        return { uid: 'uid-comprador-teste', role: 'comprador', claims: { comprador: true } }
      }
      if (token === 'token-fornecedor-a') {
        return { uid: 'uid-fornecedor-a', role: 'fornecedor', claims: { fornecedor: true } }
      }
      if (token === 'token-fornecedor-b') {
        return { uid: 'uid-fornecedor-b', role: 'fornecedor', claims: { fornecedor: true } }
      }
      if (token === 'token-sem-role') {
        return { uid: 'uid-sem-role', claims: {} }
      }
      if (token === 'token-admin-claim') {
        return { uid: 'uid-admin-claim', claims: { admin: true } }
      }
      if (token === 'token-admin-role') {
        return { uid: 'uid-admin-role', role: 'admin' }
      }
      if (token === 'token-admin-legacy') {
        return { uid: env.ADMIN_UID }
      }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

    // Middleware condicional para /products (GET sem scope específico é público)
    testApp.use('/products', async (c, next) => {
      const scope = c.req.query('scope')
      const isPublicGet = c.req.method === 'GET' && scope !== 'fornecedor' && scope !== 'admin'
      if (isPublicGet) return next()
      return createAuthMiddleware(fakeVerify)(c, next)
    })
    testApp.get('/products', productsGetHandler)
    testApp.post('/products', requireAnyRole(['fornecedor', 'admin']), productsPostHandler)

    // /products/:id
    testApp.use('/products/:id', (c, next) => createAuthMiddleware(fakeVerify)(c, next))
    testApp.put('/products/:id', requireAnyRole(['fornecedor', 'admin']), productsPutHandler)
    testApp.delete('/products/:id', requireAnyRole(['fornecedor', 'admin']), productsDeleteHandler)

    // /orders/*
    testApp.use('/orders/*', (c, next) => createAuthMiddleware(fakeVerify)(c, next))
    testApp.get('/orders', ordersGetHandler)
    testApp.post('/orders', ordersPostHandler)
    testApp.patch('/orders/:id/cancel', ordersCancelHandler)
    testApp.post('/orders/:id/report', requireAnyRole(['fornecedor', 'admin']), ordersReportHandler)

    return testApp
  }

  // -------------------------------------------------------------
  // 1. Não autenticado (401)
  // -------------------------------------------------------------
  it('1. Operações protegidas sem token → 401', async () => {
    const app = createTestApp()

    const postProd = await app.fetch(new Request('http://localhost/products', { method: 'POST' }), env)
    expect(postProd.status).toBe(401)

    const getScopeFornecedor = await app.fetch(new Request('http://localhost/products?scope=fornecedor'), env)
    expect(getScopeFornecedor.status).toBe(401)

    const getOrders = await app.fetch(new Request('http://localhost/orders'), env)
    expect(getOrders.status).toBe(401)

    const putProd = await app.fetch(new Request(`http://localhost/products/${prodFornecedorAId}`, { method: 'PUT' }), env)
    expect(putProd.status).toBe(401)

    const delProd = await app.fetch(new Request(`http://localhost/products/${prodFornecedorAId}`, { method: 'DELETE' }), env)
    expect(delProd.status).toBe(401)
  })

  // -------------------------------------------------------------
  // 2. Comprador tentando operações de fornecedor (403)
  // -------------------------------------------------------------
  it('2. Comprador tentando criar produto via POST /products → 403', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-comprador',
      },
      body: JSON.stringify({
        name: 'Tentativa Comprador',
        brand: 'Pampers',
        size: 'RN',
        quantity: 10,
        slug: `slug-comprador-${Date.now()}`,
        categoria: 'fraldas',
        descricao: 'Desc',
        atributos: { faixaPeso: 'até 5kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
        priceCents: 1200,
      }),
    })

    const response = await app.fetch(request, env)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('3. Comprador tentando acessar GET /products?scope=fornecedor → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request('http://localhost/products?scope=fornecedor', {
        headers: { Authorization: 'Bearer token-comprador' },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('4. Comprador tentando acessar GET /orders?scope=fornecedor → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request('http://localhost/orders?scope=fornecedor', {
        headers: { Authorization: 'Bearer token-comprador' },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('5. Comprador tentando PUT /products/:id → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request(`http://localhost/products/${prodFornecedorAId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-comprador',
        },
        body: JSON.stringify({ name: 'Comprador Editando' }),
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('6. Comprador tentando DELETE /products/:id → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request(`http://localhost/products/${prodFornecedorAId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-comprador' },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('7. Comprador tentando POST /orders/:id/report → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request(`http://localhost/orders/${orderFornecedorAId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-comprador',
        },
        body: JSON.stringify({ message: 'Comprador reportando' }),
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  // -------------------------------------------------------------
  // 3. Usuário sem role tentando operações de role (403)
  // -------------------------------------------------------------
  it('8. Usuário sem role tentando POST /products → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request('http://localhost/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-sem-role',
        },
        body: JSON.stringify({
          name: 'Produto Sem Role',
          brand: 'Pampers',
          size: 'P',
          quantity: 10,
          slug: `slug-sem-role-${Date.now()}`,
          categoria: 'fraldas',
          descricao: 'Desc',
          atributos: { faixaPeso: '5-9kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
          priceCents: 1200,
        }),
      }),
      env,
    )
    expect(response.status).toBe(403)
  })

  it('9. Usuário sem role tentando GET /products?scope=fornecedor e GET /orders?scope=fornecedor → 403', async () => {
    const app = createTestApp()
    const prodRes = await app.fetch(
      new Request('http://localhost/products?scope=fornecedor', {
        headers: { Authorization: 'Bearer token-sem-role' },
      }),
      env,
    )
    expect(prodRes.status).toBe(403)

    const orderRes = await app.fetch(
      new Request('http://localhost/orders?scope=fornecedor', {
        headers: { Authorization: 'Bearer token-sem-role' },
      }),
      env,
    )
    expect(orderRes.status).toBe(403)
  })

  // -------------------------------------------------------------
  // 4. Fornecedor tentando operações de admin (403)
  // -------------------------------------------------------------
  it('10. Fornecedor tentando GET /products?scope=admin e GET /orders?scope=admin → 403', async () => {
    const app = createTestApp()
    const prodRes = await app.fetch(
      new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      }),
      env,
    )
    expect(prodRes.status).toBe(403)

    const orderRes = await app.fetch(
      new Request('http://localhost/orders?scope=admin', {
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      }),
      env,
    )
    expect(orderRes.status).toBe(403)
  })

  // -------------------------------------------------------------
  // 5. Fornecedor A tentando editar/deletar produto do Fornecedor B (403 Ownership)
  // -------------------------------------------------------------
  it('11. Fornecedor A tentando PUT no produto do Fornecedor B → 403 (Ownership)', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request(`http://localhost/products/${prodFornecedorBId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-fornecedor-a',
        },
        body: JSON.stringify({ name: 'Ataque Fornecedor A' }),
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  it('12. Fornecedor A tentando DELETE no produto do Fornecedor B → 403 (Ownership)', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request(`http://localhost/products/${prodFornecedorBId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'forbidden' })
  })

  // -------------------------------------------------------------
  // 6. Role injetada no body não altera autorização (Prevenção de spoofing)
  // -------------------------------------------------------------
  it('13. Comprador enviando { role: "admin", claims: { admin: true } } no body do POST /products → 403', async () => {
    const app = createTestApp()
    const response = await app.fetch(
      new Request('http://localhost/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-comprador',
        },
        body: JSON.stringify({
          role: 'admin',
          claims: { admin: true },
          name: 'Spoofing Role',
          brand: 'Pampers',
          size: 'P',
          quantity: 10,
          slug: `slug-spoofing-${Date.now()}`,
          categoria: 'fraldas',
          descricao: 'Desc',
          atributos: { faixaPeso: '5-9kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
          priceCents: 1200,
        }),
      }),
      env,
    )
    expect(response.status).toBe(403)
  })

  // -------------------------------------------------------------
  // 7. Administrador acessando escopos administrativos (Permitido)
  // -------------------------------------------------------------
  it('14. Admin com Custom Claim (admin: true) acessa escopos administrativos → 200', async () => {
    const app = createTestApp()
    const prodRes = await app.fetch(
      new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-admin-claim' },
      }),
      env,
    )
    expect(prodRes.status).toBe(200)

    const orderRes = await app.fetch(
      new Request('http://localhost/orders?scope=admin', {
        headers: { Authorization: 'Bearer token-admin-claim' },
      }),
      env,
    )
    expect(orderRes.status).toBe(200)
  })

  it('15. Admin com role: "admin" acessa escopos administrativos → 200', async () => {
    const app = createTestApp()
    const prodRes = await app.fetch(
      new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-admin-role' },
      }),
      env,
    )
    expect(prodRes.status).toBe(200)
  })

  it('16. Admin legado com ADMIN_UID acessa escopos administrativos → 200', async () => {
    const app = createTestApp()
    const prodRes = await app.fetch(
      new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-admin-legacy' },
      }),
      env,
    )
    expect(prodRes.status).toBe(200)
  })

  // -------------------------------------------------------------
  // 8. Fluxos legítimos de fornecedor funcionam (sem regressão)
  // -------------------------------------------------------------
  it('17. Fornecedor A cria, lista e atualiza seu próprio produto com sucesso', async () => {
    const app = createTestApp()
    const uniqueSlug = `fralda-fornecedor-a-legit-${Date.now()}`

    // Cria
    const createRes = await app.fetch(
      new Request('http://localhost/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-fornecedor-a',
        },
        body: JSON.stringify({
          name: 'Fralda Nova A',
          brand: 'Pampers',
          size: 'M',
          quantity: 20,
          slug: uniqueSlug,
          categoria: 'fraldas',
          descricao: 'Legítimo',
          atributos: { faixaPeso: '5-9kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'soft' },
          priceCents: 1600,
        }),
      }),
      env,
    )
    expect(createRes.status).toBe(201)
    const createdProd = (await createRes.json()) as { id: string; supplierId: string }
    expect(createdProd.supplierId).toBe('uid-fornecedor-a')

    // Consulta escopo fornecedor
    const listRes = await app.fetch(
      new Request('http://localhost/products?scope=fornecedor', {
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      }),
      env,
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as Array<{ id: string }>
    expect(listBody.some((p) => p.id === createdProd.id)).toBe(true)

    // Edita seu próprio produto
    const editRes = await app.fetch(
      new Request(`http://localhost/products/${createdProd.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-fornecedor-a',
        },
        body: JSON.stringify({ name: 'Fralda Nova A Atualizada' }),
      }),
      env,
    )
    expect(editRes.status).toBe(200)

    // Deleta seu próprio produto
    const delRes = await app.fetch(
      new Request(`http://localhost/products/${createdProd.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      }),
      env,
    )
    expect(delRes.status).toBe(204)
  })
})
