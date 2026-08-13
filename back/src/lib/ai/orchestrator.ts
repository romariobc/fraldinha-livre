import type { drizzle } from 'drizzle-orm/d1'
import type {
  RunChatCompletion,
  ChatCompletionMessage,
} from '../chat-completion'
import type { ChatCompletionTool } from '../chat-completion'
import type { ChatResponse } from '../../../../packages/contracts/src/chat'
import { executeToolHarness } from './harness'
import type { UserContext } from './harness'

const MAX_TOOL_ITERATIONS = 4

// O modelo pode terminar uma rodada de tool-use sem gerar texto (achado em
// produção, 2026-08-03). Devolver content vazio quebraria duas coisas: a UI
// mostraria uma bolha em branco, e o próximo turno reenviaria essa mensagem no
// histórico, que ChatMessageSchema (min(1)) rejeitaria com 400 — o servidor
// travando a própria conversa. Nunca deixar um content vazio sair do orchestrator.
export const EMPTY_RESPONSE_FALLBACK = 'Desculpe, não entendi. Pode reformular?'

/**
 * runAgenticLoop — orquestra o loop agêntico de múltiplas iterações.
 *
 * Fluxo por iteração:
 * 1. Chama o LLM com o histórico de mensagens atual.
 * 2. Se o LLM chamou `select_product_for_purchase`, retorna imediatamente a
 *    ChatResponse de checkout (tipo 'action') — o harness já validou os args.
 * 3. Se o LLM não chamou nenhuma tool, retorna o texto como ChatResponse tipo 'text'.
 * 4. Para outras tools (search/get), executa via harness, adiciona o resultado
 *    ao histórico e continua para a próxima iteração.
 * 5. Se MAX_TOOL_ITERATIONS for atingido sem resposta de texto, retorna 502.
 */
export async function runAgenticLoop(
  messages: ChatCompletionMessage[],
  tools: ChatCompletionTool[],
  runChatCompletion: RunChatCompletion,
  userContext: UserContext,
  db: ReturnType<typeof drizzle>,
): Promise<{ response: ChatResponse | null; status: 200 | 502 }> {
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const result = await runChatCompletion(messages, tools)

    // ── select_product_for_purchase: checkout action ──────────────────────────
    const selectCall = result.toolCalls.find((call) => call.name === 'select_product_for_purchase')
    if (selectCall) {
      // O harness valida os args e injeta userId; o resultado tipado é SelectProductArgs + userId.
      const validated = await executeToolHarness(
        'select_product_for_purchase',
        selectCall.arguments,
        userContext,
        db,
      )

      // Se houve erro de validação, informa o modelo e deixa-o tentar corrigir.
      if (validated && typeof validated === 'object' && 'error' in validated) {
        messages.push({ role: 'assistant', content: JSON.stringify(selectCall) })
        messages.push({
          role: 'tool',
          content: JSON.stringify(validated),
          toolCallId: selectCall.id,
        })
        continue
      }

      const args = validated as {
        productId: string
        quantity: number
        paymentMethod?: string
        address?: {
          logradouro: string
          numero: string
          complemento?: string
          bairro: string
          cidade: string
          estado: string
          cep: string
        }
      }

      const response: ChatResponse = {
        type: 'action',
        action: 'select_product',
        productId: args.productId,
        quantity: args.quantity,
        paymentMethod: args.paymentMethod,
        address: args.address,
      }
      return { response, status: 200 }
    }

    // ── Sem tool calls: resposta de texto final ───────────────────────────────
    if (result.toolCalls.length === 0) {
      const content = result.text?.trim() ? result.text : EMPTY_RESPONSE_FALLBACK
      const response: ChatResponse = { type: 'text', content }
      return { response, status: 200 }
    }

    // ── Outras tools (search_products, get_product): executar e continuar ─────
    for (const call of result.toolCalls) {
      messages.push({ role: 'assistant', content: JSON.stringify(call) })

      const rawResult = await executeToolHarness(call.name, call.arguments, userContext, db)

      // Enriquecer resultado vazio de search_products para guiar o modelo.
      const toolResult =
        call.name === 'search_products' && Array.isArray(rawResult) && rawResult.length === 0
          ? [{ type: 'fallback', message: 'No products found. Please inform the user in a natural way.' }]
          : rawResult

      messages.push({
        role: 'tool',
        content: JSON.stringify(toolResult),
        toolCallId: call.id,
      })
    }
  }

  return { response: null, status: 502 }
}
