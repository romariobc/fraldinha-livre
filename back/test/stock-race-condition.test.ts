import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { eq, sql, and, gte } from 'drizzle-orm'
import { products } from '../src/schema/products'
import { orders } from '../src/schema/orders'

describe('Stock decrement race condition & constraints', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('Verifica o comportamento de db.batch com update e returning', async () => {
    const db = drizzle(env.DB)

    // Insere um produto de teste com estoque = 1
    const testId = 'prod-test-race-1'
    await db.insert(products).values({
      id: testId,
      name: 'Fralda Race Test',
      priceCents: 1000,
      supplierId: 'sup-test',
      quantity: 1,
    }).onConflictDoUpdate({
      target: products.id,
      set: { quantity: 1 },
    })

    // Executa update com RETURNING
    const updateQuery = db.update(products)
      .set({ quantity: sql`${products.quantity} - 1` })
      .where(and(eq(products.id, testId), gte(products.quantity, 1)))
      .returning({ id: products.id })

    const result = await db.batch([updateQuery])
    expect(result[0]).toHaveLength(1)
    expect(result[0][0].id).toBe(testId)

    // Tenta atualizar de novo quando estoque agora é 0 (deve retornar vazio [])
    const secondUpdate = db.update(products)
      .set({ quantity: sql`${products.quantity} - 1` })
      .where(and(eq(products.id, testId), gte(products.quantity, 1)))
      .returning({ id: products.id })

    const secondResult = await db.batch([secondUpdate])
    expect(secondResult[0]).toHaveLength(0)
  })

  it('Verifica decremento atômico com rollback caso um item falhe', async () => {
    const db = drizzle(env.DB)
    const p1 = 'prod-atomic-1'
    const p2 = 'prod-atomic-2'

    // Insere p1 com estoque 5 e p2 com estoque 0
    await db.insert(products).values([
      { id: p1, name: 'Fralda P1', priceCents: 1000, supplierId: 'sup-1', quantity: 5 },
      { id: p2, name: 'Fralda P2', priceCents: 1000, supplierId: 'sup-1', quantity: 0 },
    ]).onConflictDoUpdate({
      target: products.id,
      set: { quantity: sql`excluded.quantity` },
    })

    const items = [
      { productId: p1, quantity: 2 },
      { productId: p2, quantity: 1 }, // Vai falhar pois estoque é 0
    ]

    const updates = items.map((item) =>
      db.update(products)
        .set({ quantity: sql`${products.quantity} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), gte(products.quantity, item.quantity)))
        .returning({ id: products.id })
    )

    const results = await db.batch(updates as any)
    const failedIndex = results.findIndex((r) => r.length === 0)

    expect(failedIndex).toBe(1) // p2 falhou

    // Simula a lógica de compensação/reversão
    const rollbacks = []
    for (let i = 0; i < items.length; i++) {
      if (i !== failedIndex && results[i]?.length > 0) {
        rollbacks.push(
          db.update(products)
            .set({ quantity: sql`${products.quantity} + ${items[i].quantity}` })
            .where(eq(products.id, items[i].productId))
        )
      }
    }
    if (rollbacks.length > 0) {
      await db.batch(rollbacks as any)
    }

    // Verifica que p1 voltou a ter 5 e p2 continuou 0
    const row1 = await db.select().from(products).where(eq(products.id, p1)).get()
    const row2 = await db.select().from(products).where(eq(products.id, p2)).get()
    expect(row1?.quantity).toBe(5)
    expect(row2?.quantity).toBe(0)
  })

  it('Verifica que a constraint products_quantity_check no D1 impede quantity < 0', async () => {
    const db = drizzle(env.DB)
    const testId = 'prod-check-neg-1'
    await db.insert(products).values({
      id: testId,
      name: 'Fralda Check Negativa',
      priceCents: 1000,
      supplierId: 'sup-check',
      quantity: 0,
    }).onConflictDoUpdate({
      target: products.id,
      set: { quantity: 0 },
    })

    let failed = false
    try {
      await db.update(products)
        .set({ quantity: -1 })
        .where(eq(products.id, testId))
    } catch (e: any) {
      failed = true
      const fullError = `${e.message} ${e.cause?.message || ''}`
      expect(fullError).toMatch(/CHECK constraint failed/i)
    }

    expect(failed).toBe(true)
  })

  it('Concorrência real: duas requisições simultâneas para o último item em estoque → 1 sucesso (201) e 1 conflito (409)', async () => {
    const { Hono } = await import('hono')
    const { createAuthMiddleware } = await import('../src/middleware/auth')
    const { ordersPostHandler } = await import('../src/routes/orders')

    const fakeVerify = async (token: string) => {
      if (token === 'token-uid-a') return { uid: 'uid-a', email: 'uid-a@example.com', role: 'comprador', claims: { comprador: true } }
      if (token === 'token-uid-b') return { uid: 'uid-b', email: 'uid-b@example.com', role: 'comprador', claims: { comprador: true } }
      return null
    }

    const testApp = new Hono<{ Bindings: any; Variables: any }>()
    testApp.use('*', createAuthMiddleware(fakeVerify))
    testApp.post('/orders', ordersPostHandler)

    const db = drizzle(env.DB)
    const raceProductId = 'prod-last-item-race'

    // Garante que o produto existe com exatamente 1 item no estoque
    await db.insert(products).values({
      id: raceProductId,
      name: 'Última Fralda Disponível',
      priceCents: 2000,
      supplierId: 'sup-race',
      quantity: 1,
    }).onConflictDoUpdate({
      target: products.id,
      set: { quantity: 1 },
    })

    const makeOrderRequest = (token: string, idempotencyKey: string = crypto.randomUUID()) =>
      new Request('http://localhost/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          product: 'Última Fralda Disponível',
          quantity: 1,
          unit: 'cx',
          deliveryAddress: {
            logradouro: 'Rua Race',
            numero: '10',
            bairro: 'Centro',
            cidade: 'São Paulo',
            estado: 'SP',
            cep: '01000-000',
          },
          items: [
            {
              productId: raceProductId,
              productName: 'Última Fralda Disponível',
              unitPrice: 2000,
              quantity: 1,
              unit: 'cx',
            },
          ],
          supplierId: 'sup-race',
          price: 2000,
        }),
      })

    // Dispara as duas requisições simultaneamente (Promise.all)
    const [resA, resB] = await Promise.all([
      testApp.fetch(makeOrderRequest('token-uid-a'), env),
      testApp.fetch(makeOrderRequest('token-uid-b'), env),
    ])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([201, 409])

    // Verifica que o estoque restante é 0 (e NUNCA negativo!)
    const productAfter = await db.select().from(products).where(eq(products.id, raceProductId)).get()
    expect(productAfter?.quantity).toBe(0)

    // O request que tomou 409 deve conter o contrato unificado de erro
    const rejectedRes = resA.status === 409 ? resA : resB
    const rejectedBody = (await rejectedRes.json()) as any
    expect(rejectedBody.error.code).toBe('INSUFFICIENT_STOCK')
    expect(rejectedBody.error.message).toBe(
      'Estoque insuficiente para o produto Última Fralda Disponível no momento da finalização.',
    )
    expect(rejectedBody.error.requestId).toBeDefined()
  })
})
