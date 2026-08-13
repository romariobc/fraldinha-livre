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

interface WorkersAiToolCall {
  id?: string
  // Formato REAL observado em producao pro llama-4-scout (2026-08-03,
  // ia-chat-agent-estrategia-modelo.md): achatado, sem `function`, sem `id`.
  name?: string
  arguments?: Record<string, unknown>
  // Formato aninhado documentado em @cloudflare/workers-types — nao confirmado
  // em producao ainda, mantido por seguranca caso apareca (ex.: outro modelo).
  function?: { name?: string; arguments?: Record<string, unknown> }
}

interface WorkersAiChatCompletionResponse {
  response?: string
  tool_calls?: WorkersAiToolCall[]
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

function extractLeakedToolCalls(text: string): ChatCompletionToolCall[] {
  const calls: ChatCompletionToolCall[] = []
  const regex = /(?:\[)?\b(search_products|get_product|select_product_for_purchase)\(([^)]*)\)(?:\])?/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const argsStr = match[2]
    const args: Record<string, unknown> = {}
    const argRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,\s)]+))/g
    let argMatch
    while ((argMatch = argRegex.exec(argsStr)) !== null) {
      const key = argMatch[1]
      const strVal = argMatch[2] !== undefined ? argMatch[2] : argMatch[3]
      const rawVal = argMatch[4]
      if (strVal !== undefined) {
        args[key] = strVal
      } else if (rawVal !== undefined) {
        const num = Number(rawVal)
        args[key] = isNaN(num) ? rawVal : num
      }
    }
    calls.push({ id: `leaked-${Math.random().toString(36).slice(2)}`, name, arguments: args })
  }
  return calls
}

function extractLeakedJsonToolCalls(text: string): { calls: ChatCompletionToolCall[]; cleanedText: string } {
  let cleanedText = text
  const calls: ChatCompletionToolCall[] = []
  const toolNames = ['search_products', 'get_product', 'select_product_for_purchase']

  for (const name of toolNames) {
    let index = cleanedText.indexOf(name)
    while (index !== -1) {
      const startIdx = cleanedText.lastIndexOf('{', index)
      if (startIdx !== -1) {
        let braceCount = 0
        let endIdx = -1
        for (let i = startIdx; i < cleanedText.length; i++) {
          if (cleanedText[i] === '{') braceCount++
          else if (cleanedText[i] === '}') {
            braceCount--
            if (braceCount === 0) {
              endIdx = i
              break
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = cleanedText.slice(startIdx, endIdx + 1)
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed[name] && typeof parsed[name] === 'object') {
              calls.push({
                id: `leaked-json-${Math.random().toString(36).slice(2)}`,
                name,
                arguments: parsed[name] as Record<string, unknown>
              })
              cleanedText = cleanedText.slice(0, startIdx) + cleanedText.slice(endIdx + 1)
              index = cleanedText.indexOf(name)
              continue
            }
            if (parsed.name === name && parsed.arguments && typeof parsed.arguments === 'object') {
              calls.push({
                id: `leaked-json-${Math.random().toString(36).slice(2)}`,
                name,
                arguments: parsed.arguments as Record<string, unknown>
              })
              cleanedText = cleanedText.slice(0, startIdx) + cleanedText.slice(endIdx + 1)
              index = cleanedText.indexOf(name)
              continue
            }
          } catch (e) {
            // parsing error or invalid format
          }
        }
      }
      index = cleanedText.indexOf(name, index + name.length)
    }
  }

  return { calls, cleanedText: cleanedText.trim() }
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

    let toolCalls = (response.tool_calls ?? [])
      .map((call) => ({
        id: call.id ?? '',
        name: call.function?.name ?? call.name,
        arguments: (call.function?.arguments ?? call.arguments ?? {}) as Record<string, unknown>,
      }))
      .filter((call): call is ChatCompletionToolCall => Boolean(call.name))

    const rawText = response.response ?? ''
    let processedText = rawText

    if (processedText) {
      // 1. Extrai e limpa chamadas vazadas no formato JSON
      const { calls: leakedJsonCalls, cleanedText } = extractLeakedJsonToolCalls(processedText)
      toolCalls = toolCalls.concat(leakedJsonCalls)
      processedText = cleanedText

      // 2. Extrai chamadas no formato tradicional de função [search_products(...)]
      const leakedCalls = extractLeakedToolCalls(processedText)
      toolCalls = toolCalls.concat(leakedCalls)
    }

    const parsedText = processedText
      ? processedText.replace(/(?:\[)?\b(search_products|get_product|select_product_for_purchase)\(([^)]*)\)(?:\])?/g, '').trim()
      : null

    return { text: parsedText || null, toolCalls }
  }
}
