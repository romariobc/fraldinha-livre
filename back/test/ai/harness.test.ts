import { describe, it, expect, vi, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { executeToolHarness } from '../../src/lib/ai/harness'

const USER_CONTEXT = { userId: 'uid-comprador-teste', email: 'comprador@example.com' }

describe('executeToolHarness', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  // ── search_products ──────────────────────────────────────────────────────────

  it('search_products: args válidos retornam produtos do DB', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness('search_products', { brand: 'Pampers' }, USER_CONTEXT, db)

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBeGreaterThan(0)
  })

  it('search_products: query excessivamente longa retorna erro de validação (não crashar)', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'search_products',
      { query: 'a'.repeat(201) },
      USER_CONTEXT,
      db,
    )

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  // ── get_product ──────────────────────────────────────────────────────────────

  it('get_product: productId válido retorna o produto', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness('get_product', { productId: 'p1' }, USER_CONTEXT, db)

    expect(result).not.toBeNull()
    expect((result as { id: string }).id).toBe('p1')
  })

  it('get_product: productId inexistente retorna null (produto não encontrado)', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'get_product',
      { productId: 'nao-existe-xyz' },
      USER_CONTEXT,
      db,
    )

    expect(result).toBeNull()
  })

  it('get_product: productId com SQL injection retorna erro de validação Zod', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'get_product',
      { productId: "p1'; DROP TABLE products;--" },
      USER_CONTEXT,
      db,
    )

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('get_product: productId ausente retorna erro de validação Zod', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness('get_product', {}, USER_CONTEXT, db)

    expect(result).toHaveProperty('error')
  })

  // ── select_product_for_purchase ──────────────────────────────────────────────

  it('select_product_for_purchase: args válidos retornam dados validados + userId do auth', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p3', quantity: 2, paymentMethod: 'pix' },
      USER_CONTEXT,
      db,
    )

    expect(result).toMatchObject({
      productId: 'p3',
      quantity: 2,
      paymentMethod: 'pix',
      userId: 'uid-comprador-teste', // userId vem do UserContext, não do LLM
    })
  })

  it('select_product_for_purchase: userId SEMPRE vem do UserContext (nunca do rawArgs)', async () => {
    const db = drizzle(env.DB)
    // Simula um LLM malicioso tentando injetar userId nos rawArgs
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 1, userId: 'uid-admin-injetado-pelo-llm' }, // campo extra ignorado pelo Zod strip
      USER_CONTEXT,
      db,
    ) as Record<string, unknown>

    // O userId retornado deve ser o do UserContext, não o injetado
    expect(result.userId).toBe('uid-comprador-teste')
    expect(result.userId).not.toBe('uid-admin-injetado-pelo-llm')
  })

  it('select_product_for_purchase: quantity = 51 retorna erro (limite máximo = 50)', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 51 },
      USER_CONTEXT,
      db,
    )

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('select_product_for_purchase: paymentMethod "boleto" retorna erro (fora do enum)', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 1, paymentMethod: 'boleto' },
      USER_CONTEXT,
      db,
    )

    expect(result).toHaveProperty('error')
  })

  // ── tool desconhecida ────────────────────────────────────────────────────────

  it('tool desconhecida retorna erro descritivo sem lançar exceção', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness('hack_the_planet', { evil: true }, USER_CONTEXT, db)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('tool desconhecida')
  })

  // ── erros de runtime do DB ───────────────────────────────────────────────────

  it('erro inesperado do DB é capturado e retorna mensagem segura (sem stack trace)', async () => {
    // Simula um DB quebrado que lança exceção
    const fakeDb = {
      select: () => { throw new Error('D1 connection error') },
    }
    const result = await executeToolHarness(
      'get_product',
      { productId: 'p1' },
      USER_CONTEXT,
      fakeDb as unknown as ReturnType<typeof drizzle>,
    )

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('falha interna')
    // Garante que o stack trace não vaza para o LLM
    expect((result as { error: string }).error).not.toContain('D1 connection error')
  })
})
