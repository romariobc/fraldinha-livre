import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { createChatHandler } from '../src/routes/chat'
import { createWorkersAiChatCompletion } from '../src/lib/chat-completion'
import { executeToolHarness } from '../src/lib/ai/harness'
import type { Env, AppContext } from '../src/env'
import type { RunChatCompletion } from '../src/lib/chat-completion'

const createTestApp = (runChatCompletion: RunChatCompletion) => {
  const fakeVerify = async (token: string) => {
    if (token === 'token-uid-comprador-teste') return { uid: 'uid-comprador-teste' }
    return null
  }

  const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  testApp.use('/chat/*', (c, next) => createAuthMiddleware(fakeVerify)(c, next))
  testApp.post('/chat/message', (c) => createChatHandler(runChatCompletion)(c))
  return testApp
}

const AUTH_HEADER = { Authorization: 'Bearer token-uid-comprador-teste' }

describe('CHALLENGER STRESS SUITE: Edge cases & Security Harness Verification', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  // ── 1. Malicious Argument Payloads ──────────────────────────────────────────

  it('Discount Injection: extra discount/price params in select_product_for_purchase are stripped by Zod schema', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      {
        productId: 'p1',
        quantity: 2,
        discountPercent: 90,
        unitPriceCents: 1,
        totalCents: 2,
        isAdminOverride: true,
      },
      { userId: 'uid-comprador-teste' },
      db,
    ) as Record<string, unknown>

    expect(result).not.toHaveProperty('error')
    expect(result.productId).toBe('p1')
    expect(result.quantity).toBe(2)
    expect(result).not.toHaveProperty('discountPercent')
    expect(result).not.toHaveProperty('unitPriceCents')
    expect(result).not.toHaveProperty('totalCents')
    expect(result).not.toHaveProperty('isAdminOverride')
    expect(result.userId).toBe('uid-comprador-teste')
  })

  it('Out-of-Range Quantity: negative quantity (-10) returns Zod validation error without app crash', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: -10 },
      { userId: 'uid-comprador-teste' },
      db,
    )
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('Out-of-Range Quantity: zero quantity (0) returns Zod validation error', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 0 },
      { userId: 'uid-comprador-teste' },
      db,
    )
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('Out-of-Range Quantity: float quantity (2.5) returns Zod validation error', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 2.5 },
      { userId: 'uid-comprador-teste' },
      db,
    )
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('Out-of-Range Quantity: excessive quantity (99999) returns Zod validation error', async () => {
    const db = drizzle(env.DB)
    const result = await executeToolHarness(
      'select_product_for_purchase',
      { productId: 'p1', quantity: 99999 },
      { userId: 'uid-comprador-teste' },
      db,
    )
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('argumento inválido')
  })

  it('SQL Injection: malicious string in get_product returns Zod validation error without app crash', async () => {
    const db = drizzle(env.DB)
    const injectionPayloads = [
      "p1'; DROP TABLE products;--",
      "p1' OR '1'='1",
      "p1' UNION SELECT * FROM users--",
      "../../etc/passwd",
      "<script>alert('xss')</script>",
    ]

    for (const payload of injectionPayloads) {
      const result = await executeToolHarness(
        'get_product',
        { productId: payload },
        { userId: 'uid-comprador-teste' },
        db,
      )
      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toContain('argumento inválido')
    }
  })

  // ── 2. Malformed JSON and Leaked Calls Parsing ─────────────────────────────

  it('Malformed Leaked JSON: invalid JSON in LLM text output does not throw/crash and cleans text safely', async () => {
    const aiRun = vi.fn().mockResolvedValueOnce({
      response: 'Aqui esta a resposta: {"search_products": {query: "fralda" unclosed syntax... e mais texto',
      tool_calls: [],
    })

    const runChatCompletion = createWorkersAiChatCompletion({ run: aiRun } as unknown as Ai)
    const testApp = createTestApp(runChatCompletion)

    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'busca fralda' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    // The malformed JSON is ignored, text returned cleanly without app crash
    expect(body.type).toBe('text')
    expect(body.content).toBeDefined()
  })

  // ── 3. Regex Function Syntax vs JSON Syntax Tool Calls ─────────────────────

  it('Dual Syntax Extraction: handles both Regex function syntax and JSON syntax in the same text stream', async () => {
    const aiRun = vi
      .fn()
      .mockResolvedValueOnce({
        response: 'Vou pesquisar: [search_products(brand="Pampers", size="M")] e tambem {"get_product": {"productId": "p1"}}',
        tool_calls: [],
      })
      .mockResolvedValueOnce({
        response: 'Aqui estao os detalhes dos dois produtos.',
        tool_calls: [],
      })

    const runChatCompletion = createWorkersAiChatCompletion({ run: aiRun } as unknown as Ai)
    const testApp = createTestApp(runChatCompletion)

    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'comparar produtos' }] }),
    })
    const response = await testApp.fetch(request, env)
    expect(response.status).toBe(200)

    expect(aiRun).toHaveBeenCalledTimes(2)
    const secondCallMessages = aiRun.mock.calls[1][1].messages
    const toolMessages = secondCallMessages.filter((m: { role: string }) => m.role === 'tool')
    // Both extracted tool calls must have been executed via executeToolHarness and returned to LLM
    expect(toolMessages.length).toBe(2)
  })

  it('Native Model Calls + Leaked Text Calls: merges native and extracted calls into unified harness loop', async () => {
    const aiRun = vi
      .fn()
      .mockResolvedValueOnce({
        response: 'Tambem extraido: [get_product(productId="p2")]',
        tool_calls: [
          { name: 'get_product', arguments: { productId: 'p1' }, id: 'native-call-1' }
        ],
      })
      .mockResolvedValueOnce({
        response: 'Resultados combinados com sucesso.',
        tool_calls: [],
      })

    const runChatCompletion = createWorkersAiChatCompletion({ run: aiRun } as unknown as Ai)
    const testApp = createTestApp(runChatCompletion)

    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ver p1 e p2' }] }),
    })
    const response = await testApp.fetch(request, env)
    expect(response.status).toBe(200)

    const secondCallMessages = aiRun.mock.calls[1][1].messages
    const toolMessages = secondCallMessages.filter((m: { role: string }) => m.role === 'tool')
    expect(toolMessages.length).toBe(2)
  })

  // ── 4. Harness Routing & Error Return ──────────────────────────────────────

  it('100% Call Harness Routing: leaked tool call with invalid argument returns Zod error to LLM without crashing app', async () => {
    const aiRun = vi
      .fn()
      .mockResolvedValueOnce({
        response: 'Executando: {"select_product_for_purchase": {"productId": "p1", "quantity": 999}}',
        tool_calls: [],
      })
      .mockResolvedValueOnce({
        response: 'A quantidade solicitada de 999 pacotes excede o limite maximo de 50.',
        tool_calls: [],
      })

    const runChatCompletion = createWorkersAiChatCompletion({ run: aiRun } as unknown as Ai)
    const testApp = createTestApp(runChatCompletion)

    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'comprar 999 pacotes' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      type: 'text',
      content: 'A quantidade solicitada de 999 pacotes excede o limite maximo de 50.',
    })

    // Verify Zod error message payload sent back to LLM in second turn
    const secondCallMessages = aiRun.mock.calls[1][1].messages
    const toolMessage = secondCallMessages.find((m: { role: string }) => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage.content).toContain('argumento inválido')
    expect(toolMessage.content).toContain('exceder 50')
  })
})
