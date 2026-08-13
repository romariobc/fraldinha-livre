import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { ChatRequestSchema } from '../../../packages/contracts/src/chat'
import type { RunChatCompletion, ChatCompletionMessage } from '../lib/chat-completion'
import type { Env, AppContext } from '../env'
import { buildSystemPrompt } from '../lib/ai/prompts'
import { AI_TOOLS } from '../lib/ai/tools/index'
import { runAgenticLoop } from '../lib/ai/orchestrator'

// Re-exportado para retrocompatibilidade com testes existentes (chat.test.ts).
export { EMPTY_RESPONSE_FALLBACK } from '../lib/ai/orchestrator'

/**
 * createChatHandler — handler HTTP fino para POST /chat/message.
 *
 * Responsabilidades:
 * 1. Validar o payload da requisição via ChatRequestSchema (Zod).
 * 2. Extrair uid do contexto de auth (injetado pelo middleware de autenticação).
 * 3. Compor o system prompt dinâmico com dados de perfil/última compra.
 * 4. Delegar a execução para o orchestrator, passando o UserContext de auth.
 * 5. Retornar a ChatResponse com o status HTTP correto.
 *
 * Tudo relacionado à IA (prompt, tools, loop, harness) vive em lib/ai/.
 */
export function createChatHandler(runChatCompletion: RunChatCompletion) {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'payload invalido' }, 400)
    }

    const db = drizzle(c.env.DB)

    // uid vem do middleware de auth — nunca do payload do LLM ou do body da requisição.
    const userContext = {
      userId: c.get('uid'),
      email: c.get('email'),
    }

    // Monta o histórico de mensagens com suporte a imagem multimodal.
    const history: ChatCompletionMessage[] = parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const lastIndex = history.length - 1
    if (parsed.data.image && history[lastIndex].role === 'user') {
      history[lastIndex] = { ...history[lastIndex], imageUrl: parsed.data.image }
    }

    // Compõe o system prompt dinâmico (perfil + última compra).
    const systemPrompt = buildSystemPrompt(parsed.data.userProfile, parsed.data.lastPurchase)

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ]

    const { response, status } = await runAgenticLoop(
      messages,
      AI_TOOLS,
      runChatCompletion,
      userContext,
      db,
    )

    if (status === 502 || response === null) {
      return c.json({ error: 'assistente indisponivel, tente novamente' }, 502)
    }

    return c.json(response, status)
  }
}
