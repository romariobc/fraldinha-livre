import { describe, it, expect, vi } from 'vitest'
import { createWorkersAiChatCompletion } from '../src/lib/chat-completion'
import type { ChatCompletionTool } from '../src/lib/chat-completion'

const SAMPLE_TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description: 'Busca produtos do catalogo',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]

describe('createWorkersAiChatCompletion', () => {
  it('chama ai.run com o modelo certo e tools no formato plano (sem wrapper)', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'oi', tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    await runChatCompletion([{ role: 'user', content: 'ola' }], SAMPLE_TOOLS)

    expect(run).toHaveBeenCalledWith(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: [{ role: 'user', content: 'ola' }],
        tools: [
          {
            name: 'search_products',
            description: 'Busca produtos do catalogo',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
          },
        ],
      },
    )
  })

  it('traduz response.response e response.tool_calls para o formato canonico', async () => {
    const run = vi.fn().mockResolvedValue({
      response: 'achei um produto',
      tool_calls: [{ name: 'search_products', arguments: { query: 'fralda M' } }],
    })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'fralda M' }], SAMPLE_TOOLS)

    expect(result.text).toBe('achei um produto')
    expect(result.toolCalls).toEqual([{ name: 'search_products', arguments: { query: 'fralda M' } }])
  })

  it('com tool_calls ausente na resposta, retorna toolCalls vazio (nao quebra)', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'oi' })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.toolCalls).toEqual([])
  })

  it('com response ausente, retorna text null', async () => {
    const run = vi.fn().mockResolvedValue({ tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.text).toBeNull()
  })
})
