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
  response?: string | Record<string, unknown>
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


function closingDelimiter(text: string, start: number, open: string, close: string): number {
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === open) depth++
    else if (char === close && --depth === 0) return i
  }
  return -1
}
function parseLeakedArguments(text: string): Record<string, unknown> {
  const parts: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if ('{[('.includes(char)) depth++
    else if ('}])'.includes(char)) depth--
    else if (char === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1 }
  }
  parts.push(text.slice(start))
  const args: Record<string, unknown> = {}
  for (const part of parts) {
    const match = part.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*([\s\S]+)$/)
    if (!match) continue
    const value = match[2].trim()
    try { args[match[1]] = JSON.parse(value) as unknown }
    catch { args[match[1]] = value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value }
  }
  return args
}
function extractLeakedToolCalls(text: string): { calls: ChatCompletionToolCall[]; cleanedText: string } {
  const calls: ChatCompletionToolCall[] = []
  const regex = /\b(search_products|get_product|select_product_for_purchase)\s*\(/g
  let cleanedText = ''
  let previousEnd = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const open = regex.lastIndex - 1
    const close = closingDelimiter(text, open, '(', ')')
    if (close === -1) continue
    const hasBrackets = text[match.index - 1] === '[' && text[close + 1] === ']'
    const start = hasBrackets ? match.index - 1 : match.index
    const end = close + (hasBrackets ? 2 : 1)
    calls.push({ id: `leaked-${Math.random().toString(36).slice(2)}`, name: match[1], arguments: parseLeakedArguments(text.slice(open + 1, close)) })
    cleanedText += text.slice(previousEnd, start)
    previousEnd = end
    regex.lastIndex = end
  }
  return { calls, cleanedText: (cleanedText + text.slice(previousEnd)).trim() }
}
function extractLeakedJsonToolCalls(text: string): { calls: ChatCompletionToolCall[]; cleanedText: string } {
  const calls: ChatCompletionToolCall[] = []
  const names = ['search_products', 'get_product', 'select_product_for_purchase']
  let cleanedText = ''
  let previousEnd = 0
  let start = text.indexOf('{')
  while (start !== -1) {
    const end = closingDelimiter(text, start, '{', '}')
    if (end === -1) break
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        const name = typeof record.name === 'string' && names.includes(record.name) ? record.name : names.find((candidate) => candidate in record)
        const args = name && (record.name === name ? record.arguments : record[name])
        if (name && args && typeof args === 'object' && !Array.isArray(args)) {
          calls.push({ id: `leaked-json-${Math.random().toString(36).slice(2)}`, name, arguments: args as Record<string, unknown> })
          cleanedText += text.slice(previousEnd, start)
          previousEnd = end + 1
        }
      }
    } catch { /* Leave malformed or unrelated JSON untouched. */ }
    start = text.indexOf('{', end + 1)
  }
  return { calls, cleanedText: (cleanedText + text.slice(previousEnd)).trim() }
}

export function createWorkersAiChatCompletion(
  ai: Ai,
  inspectResponse?: (response: WorkersAiChatCompletionResponse) => void,
): RunChatCompletion {
  return async (messages, tools) => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')

    const response = (await ai.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        max_tokens: 1024,
        messages: messages.map(toWorkersAiMessage),
        tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      } as AiModels['@cf/meta/llama-4-scout-17b-16e-instruct']['inputs'],
    )) as unknown as WorkersAiChatCompletionResponse

    inspectResponse?.(response)

    // DIAGNOSTICO TEMPORARIO (2026-08-03) — achado de QA: o modelo as vezes nao
    // chama tool nenhuma com entrada curta/ambigua, ou escreve a sintaxe da tool
    // como texto em vez de chamar de verdade. Log da resposta CRUA antes de
    // qualquer parsing nosso, pra distinguir "o modelo nao chamou" de "nos
    // perdemos a chamada no parsing". Ver .claude/docs/infra/ia-chat-agent-estrategia-modelo.md.
    console.log(
      '[chat-diag]',
      JSON.stringify({
        hasUserMessage: Boolean(lastUserMessage),
        userMessageLength: lastUserMessage?.content?.length ?? 0,
        messagesCount: messages.length,
        responseLength: typeof response.response === 'string' ? response.response.length : 0,
        toolCallsCount: response.tool_calls?.length ?? 0,
        toolNames: (response.tool_calls ?? []).map((call) => call.function?.name ?? call.name ?? 'unknown'),
      }),
    )

    let toolCalls = (response.tool_calls ?? [])
      .map((call) => ({
        id: call.id ?? '',
        name: call.function?.name ?? call.name,
        arguments: (call.function?.arguments ?? call.arguments ?? {}) as Record<string, unknown>,
      }))
      .filter((call): call is ChatCompletionToolCall => Boolean(call.name))

    // Workers AI may return structured JSON in response instead of a string.
    // Feed known tool wrappers through the same parser; never assume string methods exist.
    const rawText = typeof response.response === 'string'
      ? response.response
      : response.response && typeof response.response === 'object'
        ? JSON.stringify(response.response)
        : ''
    let processedText = rawText

    if (processedText) {
      // 1. Extrai e limpa chamadas vazadas no formato JSON
      const { calls: leakedJsonCalls, cleanedText } = extractLeakedJsonToolCalls(processedText)
      toolCalls = toolCalls.concat(leakedJsonCalls)
      processedText = cleanedText

      // 2. Extrai chamadas no formato tradicional de função [search_products(...)]
      const leaked = extractLeakedToolCalls(processedText)
      toolCalls = toolCalls.concat(leaked.calls)
      processedText = leaked.cleanedText
    }

    const parsedText = typeof response.response === 'string' && processedText
      ? processedText.trim()
      : null

    // Some real tool calls encode the nested address as JSON text. Decode only
    // this transport representation; the harness still validates every field.
    toolCalls = toolCalls.map((call) => {
      if (call.name !== 'select_product_for_purchase' || typeof call.arguments.address !== 'string') return call
      try {
        const address: unknown = JSON.parse(call.arguments.address)
        if (address && typeof address === 'object' && !Array.isArray(address)) {
          return { ...call, arguments: { ...call.arguments, address } }
        }
      } catch { /* Keep invalid values for the harness to reject. */ }
      return call
    })

    return { text: parsedText || null, toolCalls }
  }
}
