// Entry point exclusivo da homologação; wrangler.jsonc de produção segue usando index.ts.
import app from './index'
import { createAuthMiddleware, verifyFirebaseIdToken } from './middleware/auth'
import { createChatHandler } from './routes/chat'
import { createWorkersAiChatCompletion } from './lib/chat-completion'

app.use('/qa/*', (c, next) => createAuthMiddleware((token) =>
  verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
)(c, next))

app.post('/qa/chat/recovery', async (c) => {
  const providerResponses: unknown[] = []
  const realCompletion = createWorkersAiChatCompletion(c.env.AI, (response) => {
    providerResponses.push({ response: response.response, tool_calls: response.tool_calls })
  })
  let providerCalls = 0
  let faultInjected = false
  let providerSawHarnessError = false
  const toolNames: string[][] = []
  const harnessErrors: string[] = []
  try {
  const response = await createChatHandler(async (messages, tools) => {
    providerSawHarnessError ||= messages.some((message) =>
      message.role === 'tool' && message.content.includes('qa-id-inexistente'),
    )
    for (const message of messages.filter((m) => m.role === 'tool')) {
      try {
        const parsed = JSON.parse(message.content) as { error?: string }
        if (parsed.error && !harnessErrors.includes(parsed.error)) harnessErrors.push(parsed.error)
      } catch { /* A tool may return a non-object result. */ }
    }
    const result = await realCompletion(messages, tools)
    providerCalls++
    toolNames.push(result.toolCalls.map((call) => call.name))
    const selected = result.toolCalls.find((call) => call.name === 'select_product_for_purchase')
    if (selected && !faultInjected) {
      // Injeção de falha declarada: a seleção vem do modelo real; somente o ID é corrompido.
      // Todas as inferências, inclusive a tentativa de recuperação, continuam sendo reais.
      selected.arguments = { ...selected.arguments, productId: 'qa-id-inexistente' }
      faultInjected = true
    }
    return result
  })(c)
  const body: unknown = await response.json()
  return c.json({
    response: body,
    trace: { providerCalls, faultInjected, providerSawHarnessError, toolNames, harnessErrors, providerResponses },
    method: 'real-provider-with-one-corrupted-selection-id',
  }, response.status as 200 | 400 | 502)
  } catch (error) {
    return c.json({
      error: 'QA_PROVIDER_EXCEPTION',
      detail: error instanceof Error ? error.message : String(error),
      trace: { providerCalls, faultInjected, providerSawHarnessError, toolNames, harnessErrors, providerResponses },
    }, 502)
  }
})

export default app
