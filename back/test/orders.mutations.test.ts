import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { createAuthMiddleware } from '../src/middleware/auth'
import { ordersPostHandler, ordersCancelHandler, ordersGetHandler } from '../src/routes/orders'
import { orders, orderItems } from '../src/schema/orders'
import type { Env, AppContext } from '../src/env'
import type { Order } from '../../packages/contracts/src/order'

describe('POST /orders + PATCH /orders/:id/cancel', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  /**
   * Cria um app de teste com middleware fake.
   * fakeVerify reconhece token-uid-a, token-uid-b e token-uid-c.
   */
  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-uid-a') return { uid: 'uid-a', email: 'uid-a@example.com', role: 'comprador', claims: { comprador: true } }
      if (token === 'token-uid-b') return { uid: 'uid-b', email: 'uid-b@example.com', role: 'comprador', claims: { comprador: true } }
      if (token === 'token-uid-c') return { uid: 'uid-c', email: 'uid-c@example.com', role: 'comprador', claims: { comprador: true } }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
    testApp.use('*', async (c, next) => {
      const incomingId = c.req.header('x-request-id') || 'req-test-orders'
      c.set('requestId', incomingId)
      c.header('X-Request-Id', incomingId)
      await next()
    })
    testApp.use('*', async (c, next) => {
      if (c.req.method === 'POST' && c.req.path === '/orders') {
        const hasKey = c.req.header('idempotency-key') || c.req.header('Idempotency-Key')
        const omit = c.req.header('x-omit-idempotency')
        if (!hasKey && !omit) {
          try {
            c.req.raw.headers.set('Idempotency-Key', crypto.randomUUID())
          } catch {
            const newHeaders = new Headers(c.req.raw.headers)
            newHeaders.set('Idempotency-Key', crypto.randomUUID())
            // @ts-ignore
            c.req.raw = new Request(c.req.raw, { headers: newHeaders })
          }
        }
      }
      await next()
    })
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.get('/orders', ordersGetHandler)
    testApp.post('/orders', ordersPostHandler)
    testApp.patch('/orders/:id/cancel', ordersCancelHandler)

    return testApp
  }

  // ============================================================
  // CASOS DE POST /orders
  // ============================================================

  it('POST /orders sem Authorization header → 401', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 10,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 18000,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(401)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('POST /orders com body inválido (items: []) → 400', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [], // Inválido: deve ter ao menos 1 item
        supplierId: 'sup-001',
        price: 0,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as unknown
    expect(body).toHaveProperty('error')
  })

  it('POST /orders com id/uid/status maliciosos no body → 201, uid é do TOKEN (RN-03)', { timeout: 15000 }, async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        // Tenta injetar id/uid/status falsos
        id: 'fake-id',
        uid: 'uid-malicioso',
        status: 'confirmado',
        // Dados válidos
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 10,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 18000,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(201)
    const body = (await response.json()) as unknown as Order

    // Verifica que o uid da order é o do token, não o malicioso
    expect(body.uid).toBe('uid-a')
    expect(body.status).toBe('aguardando')
    expect(body.id).not.toBe('fake-id') // ID foi gerado pelo servidor
  })

  it('POST /orders bem-sucedido: items foram persistidos via SELECT direto', async () => {
    const app = createTestApp()
    const db = drizzle(env.DB)

    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-b',
      },
      body: JSON.stringify({
        product: 'Fralda Mix',
        quantity: 50,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua B',
          numero: '456',
          bairro: 'Zona',
          cidade: 'Rio',
          estado: 'RJ',
          cep: '20000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 10,
            unit: 'cx',
          },
          {
            productId: 'p2',
            productName: 'Fralda M',
            unitPrice: 2200,
            quantity: 10,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 40000,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(201)
    const body = (await response.json()) as unknown as Order

    // Agora faz SELECT direto em order_items para confirmar persistência
    const dbItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, body.id))
      .all()

    // Deve ter exatamente 2 items
    expect(dbItems).toHaveLength(2)
    // E devem corresponder aos items da resposta
    expect(body.items).toHaveLength(2)
  })

  // Novos testes P2 — validação contra products

  it('POST /orders com unitPrice divergente do produto → 400, preco divergente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 9999, // Divergente: p1 é 1800
            quantity: 1,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 9999,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('PRICE_MISMATCH')
  })

  it('POST /orders com productId inexistente → 400, produto nao encontrado', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'produto-fantasma',
            productName: 'Produto Fantasma',
            unitPrice: 1000,
            quantity: 1,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 1000,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('POST /orders com supplierId divergente do produto → 400, fornecedor divergente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 1,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-999', // Divergente: p1 é sup-001
        price: 1800,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('SUPPLIER_MISMATCH')
  })

  it('POST /orders sem price → 400, price ausente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 1,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        // price ausente
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('INVALID_REQUEST')
  })

  it('POST /orders sem supplierId → 400, supplierId ausente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 1,
            unit: 'cx',
          },
        ],
        price: 1800,
        // supplierId ausente
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('INVALID_REQUEST')
  })

  it('POST /orders com total divergente → 400, total divergente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 10,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 2, // 2 * 1800 = 3600
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 9999, // Divergente: deveria ser 3600
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('TOTAL_MISMATCH')
  })

  it('POST /orders com NOTIFICATIONS_ENABLED=false: nao chama Resend, pedido cria normalmente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-uid-a', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'Fralda A',
        quantity: 1,
        unit: 'un',
        price: 1800,
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        deliveryAddress: {
          logradouro: 'Rua A', numero: '1', bairro: 'Centro',
          cidade: 'Sao Paulo', estado: 'SP', cep: '01000-000',
        },
        items: [{ productId: 'p1', productName: 'Fralda A', unitPrice: 1800, quantity: 1, unit: 'un' }],
      }),
    })
    // env.NOTIFICATIONS_ENABLED nao setado nesse teste => vazio => !== 'true' => desligado
    const response = await app.fetch(request, env)
    expect(response.status).toBe(201)
  })

  // ============================================================
  // CASOS DE PATCH /orders/:id/cancel
  // ============================================================

  it('PATCH /orders/:id/cancel de order de OUTRO uid → 403', async () => {
    const app = createTestApp()
    const db = drizzle(env.DB)

    // Seed: cria order para uid-c
    const addressJson = JSON.stringify({
      logradouro: 'Rua C',
      numero: '789',
      bairro: 'Bairro',
      cidade: 'Brasília',
      estado: 'DF',
      cep: '70000-000',
    })
    const orderId = 'order-uid-c-to-cancel'
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES (?, 'uid-c', 'compra-direta', 'aguardando', 'Fralda', 100, 'cx', ?, datetime('now'))
    `)
      .bind(orderId, addressJson)
      .run()

    // Tenta cancelar com uid-a (não é dono)
    const request = new Request(`http://localhost/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('PATCH /orders/:id/cancel de order com status != "aguardando" → 409', async () => {
    const app = createTestApp()

    // Seed: cria order com status "confirmado"
    const addressJson = JSON.stringify({
      logradouro: 'Rua D',
      numero: '999',
      bairro: 'Bairro',
      cidade: 'Salvador',
      estado: 'BA',
      cep: '40000-000',
    })
    const orderId = 'order-confirmed-to-cancel'
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES (?, 'uid-a', 'compra-direta', 'confirmado', 'Fralda', 100, 'cx', ?, datetime('now'))
    `)
      .bind(orderId, addressJson)
      .run()

    // Tenta cancelar (status não é 'aguardando')
    const request = new Request(`http://localhost/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('PATCH /orders/:id/cancel de order aguardando do dono → 200, status = cancelado', async () => {
    const app = createTestApp()

    // Seed: cria order com status "aguardando" para uid-a
    const addressJson = JSON.stringify({
      logradouro: 'Rua E',
      numero: '111',
      bairro: 'Bairro',
      cidade: 'Manaus',
      estado: 'AM',
      cep: '69000-000',
    })
    const orderId = 'order-to-cancel-success'
    await env.DB.prepare(`
      INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
      VALUES (?, 'uid-a', 'compra-direta', 'aguardando', 'Fralda', 100, 'cx', ?, datetime('now'))
    `)
      .bind(orderId, addressJson)
      .run()

    // Adiciona um item para ter estrutura completa
    await env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit)
      VALUES (?, 'prod-test', 'Fralda Test', 1000, 100, 'cx')
    `)
      .bind(orderId)
      .run()

    // Cancela (uid-a é dono, status é 'aguardando')
    const request = new Request(`http://localhost/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as unknown as Order

    expect(body.status).toBe('cancelado')
    expect(body.id).toBe(orderId)
  })

  it('PATCH /orders/:id/cancel de id inexistente → 404', async () => {
    const app = createTestApp()

    const request = new Request('http://localhost/orders/order-inexistente-xyz/cancel', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('POST /orders com estoque insuficiente → 409 Conflict', async () => {
    const app = createTestApp()
    const db = drizzle(env.DB)

    // Garante que p1 existe com estoque limitado (ex: 2 unidades)
    await env.DB.prepare(`UPDATE products SET quantity = 2 WHERE id = 'p1'`).run()

    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 5,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 5, // Solicita 5 mas só tem 2
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 9000,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(409)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('INSUFFICIENT_STOCK')
  })

  // ============================================================
  // CASOS DE IDEMPOTÊNCIA (Idempotency-Key)
  // ============================================================

  it('POST /orders sem Idempotency-Key header → 400 Bad Request', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
        'x-omit-idempotency': '1',
      },
      body: JSON.stringify({
        product: 'Fralda',
        quantity: 1,
        unit: 'cx',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '123',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000-000',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Fralda P',
            unitPrice: 1800,
            quantity: 1,
            unit: 'cx',
          },
        ],
        supplierId: 'sup-001',
        price: 1800,
      }),
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('POST /orders com Idempotency-Key duplicado → 200 OK com mesmo pedido e estoque inalterado', async () => {
    const app = createTestApp()
    const idempotencyKey = 'idemp-key-test-123'
    const payload = {
      product: 'Fralda',
      quantity: 1,
      unit: 'cx',
      deliveryAddress: {
        logradouro: 'Rua A',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      items: [
        {
          productId: 'p1',
          productName: 'Fralda P',
          unitPrice: 1800,
          quantity: 1,
          unit: 'cx',
        },
      ],
      supplierId: 'sup-001',
      price: 1800,
    }

    // 1ª Requisição: Deve criar o pedido com 201
    const req1 = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    const res1 = await app.fetch(req1, env)
    expect(res1.status).toBe(201)
    const order1 = (await res1.json()) as Order
    expect(order1.id).toBeDefined()

    // 2ª Requisição: Exatamente a mesma chave e payload → Deve retornar 200 com o mesmo ID
    const req2 = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    const res2 = await app.fetch(req2, env)
    expect(res2.status).toBe(200)
    const order2 = (await res2.json()) as Order
    expect(order2.id).toBe(order1.id)
    expect(order2.price).toBe(order1.price)
    expect(order2.items).toHaveLength(1)
  })

  it('POST /orders com mesmo Idempotency-Key por outro usuário → 403 Forbidden', async () => {
    const app = createTestApp()
    const idempotencyKey = 'idemp-key-shared-test-456'
    const payload = {
      product: 'Fralda',
      quantity: 1,
      unit: 'cx',
      deliveryAddress: {
        logradouro: 'Rua A',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      items: [
        {
          productId: 'p1',
          productName: 'Fralda P',
          unitPrice: 1800,
          quantity: 1,
          unit: 'cx',
        },
      ],
      supplierId: 'sup-001',
      price: 1800,
    }

    // Criado por uid-a
    const req1 = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-a',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    const res1 = await app.fetch(req1, env)
    expect(res1.status).toBe(201)

    // Tentativa por uid-b com a mesma chave → 403 Forbidden
    const req2 = new Request('http://localhost/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-uid-b',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    const res2 = await app.fetch(req2, env)
    expect(res2.status).toBe(403)
  })
})
