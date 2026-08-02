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
}

export type RunChatCompletion = (
  messages: ChatCompletionMessage[],
  tools: ChatCompletionTool[],
) => Promise<ChatCompletionResult>

interface WorkersAiChatCompletionResponse {
  response?: string
  tool_calls?: { id?: string; function?: { name?: string; arguments?: Record<string, unknown> } }[]
}

export function createWorkersAiChatCompletion(ai: Ai): RunChatCompletion {
  return async (messages, tools) => {
    const response = (await ai.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: messages.map((m) => ({ role: m.role, content: m.content, tool_call_id: m.toolCallId })),
        tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      } as AiModels['@cf/meta/llama-4-scout-17b-16e-instruct']['inputs'],
    )) as unknown as WorkersAiChatCompletionResponse

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
