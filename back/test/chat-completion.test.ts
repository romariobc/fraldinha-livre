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
        messages: [{ role: 'user', content: 'ola', tool_call_id: undefined }],
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

  it('mensagem com imageUrl vira content multimodal (text + image_url), nao string', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'vi a foto', tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    await runChatCompletion(
      [{ role: 'user', content: 'que fralda e essa?', imageUrl: 'data:image/jpeg;base64,AAAA' }],
      [],
    )

    const [, input] = run.mock.calls[0]
    expect(input.messages[0].content).toEqual([
      { type: 'text', text: 'que fralda e essa?' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ])
  })

  it('mensagem sem imageUrl mantem content como string simples', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'oi', tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    const [, input] = run.mock.calls[0]
    expect(input.messages[0].content).toBe('oi')
  })

  it('traduz response.response e response.tool_calls (aninhado em function) para o formato canonico', async () => {
    const run = vi.fn().mockResolvedValue({
      response: 'achei um produto',
      tool_calls: [{ id: 'call_1', function: { name: 'search_products', arguments: { query: 'fralda M' } } }],
    })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'fralda M' }], SAMPLE_TOOLS)

    expect(result.text).toBe('achei um produto')
    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'search_products', arguments: { query: 'fralda M' } }])
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

  it('com item de tool_calls sem function.name (mal formado), ignora esse item', async () => {
    const run = vi.fn().mockResolvedValue({
      response: null,
      tool_calls: [{ id: 'call_1', function: {} }, { id: 'call_2', function: { name: 'search_products', arguments: {} } }],
    })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.toolCalls).toEqual([{ id: 'call_2', name: 'search_products', arguments: {} }])
  })
})
