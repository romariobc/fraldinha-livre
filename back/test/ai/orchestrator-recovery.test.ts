import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../../src/middleware/auth'
import { createChatHandler } from '../../src/routes/chat'
import type { Env, AppContext } from '../../src/env'
import type { RunChatCompletion, ChatCompletionMessage } from '../../src/lib/chat-completion'

const createTestApp = (runChatCompletion: RunChatCompletion) => {
  const fakeVerify = async (token: string) => {
    if (token === 'token-uid-comprador-teste') return { uid: 'uid-comprador-teste', email: 'comprador@teste.com' }
    return null
  }

  const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  testApp.use('*', async (c, next) => {
    c.set('requestId', 'req-test-orchestrator-recovery')
    await next()
  })
  testApp.use('/chat/*', (c, next) => createAuthMiddleware(fakeVerify)(c, next))
  testApp.post('/chat/message', (c) => createChatHandler(runChatCompletion)(c))
  return testApp
}

const AUTH_HEADER = { Authorization: 'Bearer token-uid-comprador-teste' }

describe('Ciclo completo de autocorreção no Orchestrator', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('ID inexistente -> erro retornado pela tool -> modelo tenta novamente com ID válido -> checkout action bem-sucedido', async () => {
    // Simula o comportamento do LLM:
    // Rodada 1: O modelo tenta chamar select_product_for_purchase com um ID fictício ("id-fantasma-999")
    // Rodada 2: O modelo recebe a mensagem de erro da tool e chama select_product_for_purchase com o ID real ("p1")
    let capturedToolMessageContent: string | null = null

    const run = vi.fn()
      .mockImplementationOnce(async (messages: ChatCompletionMessage[]) => {
        return {
          text: null,
          toolCalls: [
            {
              id: 'call_invalid_id',
              name: 'select_product_for_purchase',
              arguments: { productId: 'id-fantasma-999', quantity: 2 },
            },
          ],
        }
      })
      .mockImplementationOnce(async (messages: ChatCompletionMessage[]) => {
        // Inspeciona as mensagens recebidas na segunda rodada do loop
        const lastToolMessage = messages.find((m) => m.role === 'tool' && m.toolCallId === 'call_invalid_id')
        if (lastToolMessage) {
          capturedToolMessageContent = lastToolMessage.content
        }

        return {
          text: null,
          toolCalls: [
            {
              id: 'call_valid_id',
              name: 'select_product_for_purchase',
              arguments: { productId: 'p1', quantity: 2 },
            },
          ],
        }
      })

    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Quero comprar 2 pacotes do Supersec Pants P' }],
      }),
    })

    const response = await testApp.fetch(request, env)
    const body = (await response.json()) as {
      type: string
      action: string
      productId: string
      quantity: number
    }

    // 1. O endpoint deve responder 200 OK com a ação de checkout
    expect(response.status).toBe(200)
    expect(body).toEqual({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 2,
    })

    // 2. O LLM deve ter sido invocado duas vezes dentro do mesmo request
    expect(run).toHaveBeenCalledTimes(2)

    // 3. A mensagem da tool na rodada 2 deve conter a advertência de produto inexistente
    expect(capturedToolMessageContent).not.toBeNull()
    expect(capturedToolMessageContent).toContain('não existe no catálogo')
    expect(capturedToolMessageContent).toContain('id-fantasma-999')
  })

  it('busca inicial -> tentativa de ID inexistente -> autocorreção com ID retornado pela busca -> checkout action', async () => {
    // Fluxo completo com 3 iterações internas:
    // 1. Modelo executa search_products
    // 2. Modelo se confunde e tenta chamar select_product_for_purchase com 'p-errado'
    // 3. Recebe erro do harness e re-chama com 'p1' retornado pela busca
    const run = vi.fn()
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [
          {
            id: 'call_search',
            name: 'search_products',
            arguments: { query: 'Supersec Pants' },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [
          {
            id: 'call_select_errado',
            name: 'select_product_for_purchase',
            arguments: { productId: 'p-errado', quantity: 1 },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [
          {
            id: 'call_select_correto',
            name: 'select_product_for_purchase',
            arguments: { productId: 'p1', quantity: 1 },
          },
        ],
      })

    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Pode fechar a compra do Supersec Pants' }],
      }),
    })

    const response = await testApp.fetch(request, env)
    const body = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(body.type).toBe('action')
    expect(body.action).toBe('select_product')
    expect(body.productId).toBe('p1')
    expect(body.quantity).toBe(1)
    expect(run).toHaveBeenCalledTimes(3)
  })
})
