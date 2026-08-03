import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { createChatHandler, EMPTY_RESPONSE_FALLBACK } from '../src/routes/chat'
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

describe('POST /chat/message', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('sem Authorization retorna 401', async () => {
    const run = vi.fn()
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('body com messages vazio retorna 400', async () => {
    const run = vi.fn()
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(400)
    expect(run).not.toHaveBeenCalled()
  })

  it('resposta de texto direto (sem tool call): 1 chamada, devolve type text', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'oi! o que voce procura?', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'text', content: 'oi! o que voce procura?' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('modelo termina sem texto (result.text vazio/null): devolve fallback, nunca content vazio', async () => {
    for (const text of [null, '', '   ']) {
      const run = vi.fn().mockResolvedValue({ text, toolCalls: [] })
      const testApp = createTestApp(run)
      const request = new Request('http://localhost/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
      })
      const response = await testApp.fetch(request, env)
      const body = (await response.json()) as { content: string }

      expect(response.status, `text=${JSON.stringify(text)}`).toBe(200)
      expect(body.content.length, `text=${JSON.stringify(text)}`).toBeGreaterThan(0)
    }
  })

  it('achado real de producao: resposta com content vazio no historico nao derruba o proximo turno com 400', async () => {
    // Reproduz o bug exato visto em producao (2026-08-03): um turno anterior
    // que teria devolvido content vazio (aqui ja simulado como fallback, pos-fix)
    // volta no historico do turno seguinte. ChatMessageSchema exige min(1) —
    // sem o fallback na origem, isso quebraria com 400 "payload invalido".
    const run = vi.fn().mockResolvedValue({ text: 'tamanho G da Pampers, confere?', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'fralda pampers' },
          { role: 'assistant', content: EMPTY_RESPONSE_FALLBACK },
          { role: 'user', content: 'tamanho G' },
        ],
      }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)
  })

  it('1 rodada de tool de dados antes da resposta final: 2 chamadas, 2a recebe mensagem role=tool', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'call_1', name: 'search_products', arguments: { query: 'fralda M' } }],
      })
      .mockResolvedValueOnce({ text: 'achei a fralda M, confirma?', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'quero fralda M' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'text', content: 'achei a fralda M, confirma?' })
    expect(run).toHaveBeenCalledTimes(2)

    const secondCallMessages = run.mock.calls[1][0]
    expect(secondCallMessages.some((m: { role: string }) => m.role === 'tool')).toBe(true)
  })

  it('request com image: a foto chega ao modelo anexada na ultima mensagem do usuario', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'vi a foto', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'oi' },
          { role: 'assistant', content: 'ola' },
          { role: 'user', content: 'que fralda e essa?' },
        ],
        image: 'data:image/jpeg;base64,AAAA',
      }),
    })
    const response = await testApp.fetch(request, env)
    expect(response.status).toBe(200)

    const sentMessages = run.mock.calls[0][0]
    const last = sentMessages[sentMessages.length - 1]
    expect(last.role).toBe('user')
    expect(last.content).toBe('que fralda e essa?')
    expect(last.imageUrl).toBe('data:image/jpeg;base64,AAAA')
    // so a mensagem do turno atual carrega a foto
    expect(sentMessages.filter((m: { imageUrl?: string }) => m.imageUrl)).toHaveLength(1)
  })

  it('request sem image: nenhuma mensagem leva imageUrl', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'oi', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    await testApp.fetch(request, env)

    const sentMessages = run.mock.calls[0][0]
    expect(sentMessages.every((m: { imageUrl?: string }) => m.imageUrl === undefined)).toBe(true)
  })

  it('image em formato invalido (URL http) e rejeitada com 400, nao ignorada', async () => {
    const run = vi.fn()
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'essa aqui' }],
        image: 'https://exemplo.com/foto.jpg',
      }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(400)
    expect(run).not.toHaveBeenCalled()
  })

  it('tool select_product_for_purchase: para no primeiro select, devolve type action, 1 chamada', async () => {
    const run = vi.fn().mockResolvedValue({
      text: null,
      toolCalls: [{ id: 'call_1', name: 'select_product_for_purchase', arguments: { productId: 'p1', quantity: 2 } }],
    })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'quero 2 do Supersec Pants P' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('modelo so chama tool de dados, nunca fecha: apos MAX_TOOL_ITERATIONS, retorna 502', async () => {
    const run = vi.fn().mockResolvedValue({
      text: null,
      toolCalls: [{ id: 'call_x', name: 'search_products', arguments: { query: 'fralda' } }],
    })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'fralda' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'assistente indisponivel, tente novamente' })
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('search_products/get_product de verdade contra o D1 real (sem fake nessa parte)', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'call_1', name: 'search_products', arguments: { query: 'Supersec Pants' } }],
      })
      .mockResolvedValueOnce({ text: 'achei', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Supersec Pants' }] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)

    const secondCallMessages = run.mock.calls[1][0]
    const toolMessage = secondCallMessages.find((m: { role: string }) => m.role === 'tool')
    const toolResult = JSON.parse(toolMessage.content)
    expect(Array.isArray(toolResult)).toBe(true)
    expect(toolResult.some((p: { id: string }) => p.id === 'p1')).toBe(true)
  })
})
