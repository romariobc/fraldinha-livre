export interface ChatCompletionTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatCompletionToolCall {
  id: string // correlaciona com ChatCompletionMessage.toolCallId na resposta da tool
  name: string
  arguments: Record<string, unknown>
}

export interface ChatCompletionResult {
  text: string | null
  toolCalls: ChatCompletionToolCall[]
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string // obrigatorio quando role === 'tool' (id do ChatCompletionToolCall correspondente)
  imageUrl?: string // data URI; vira parte image_url no content multimodal
}

export type RunChatCompletion = (
  messages: ChatCompletionMessage[],
  tools: ChatCompletionTool[],
) => Promise<ChatCompletionResult>

interface WorkersAiChatCompletionResponse {
  response?: string
  tool_calls?: { id?: string; function?: { name?: string; arguments?: Record<string, unknown> } }[]
}

function toWorkersAiMessage(message: ChatCompletionMessage) {
  const base = { role: message.role, tool_call_id: message.toolCallId }
  if (!message.imageUrl) {
    return { ...base, content: message.content }
  }
  return {
    ...base,
    content: [
      { type: 'text', text: message.content },
      { type: 'image_url', image_url: { url: message.imageUrl } },
    ],
  }
}

export function createWorkersAiChatCompletion(ai: Ai): RunChatCompletion {
  return async (messages, tools) => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')

    const response = (await ai.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: messages.map(toWorkersAiMessage),
        tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      } as AiModels['@cf/meta/llama-4-scout-17b-16e-instruct']['inputs'],
    )) as unknown as WorkersAiChatCompletionResponse

    // DIAGNOSTICO TEMPORARIO (2026-08-03) — achado de QA: o modelo as vezes nao
    // chama tool nenhuma com entrada curta/ambigua, ou escreve a sintaxe da tool
    // como texto em vez de chamar de verdade. Log da resposta CRUA antes de
    // qualquer parsing nosso, pra distinguir "o modelo nao chamou" de "nos
    // perdemos a chamada no parsing". Ver .claude/docs/infra/ia-chat-agent-estrategia-modelo.md.
    console.log(
      '[chat-diag]',
      JSON.stringify({
        lastUserMessage: lastUserMessage?.content?.slice(0, 200) ?? null,
        rawResponseText: response.response ?? null,
        rawToolCallsCount: response.tool_calls?.length ?? 0,
        rawToolCalls: response.tool_calls ?? [],
      }),
    )

    const toolCalls = (response.tool_calls ?? [])
      .filter((call) => call.function?.name)
      .map((call) => ({
        id: call.id ?? '',
        name: call.function!.name!,
        arguments: (call.function!.arguments ?? {}) as Record<string, unknown>,
      }))

    return { text: response.response ?? null, toolCalls }
  }
}
