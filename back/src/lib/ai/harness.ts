import type { drizzle } from 'drizzle-orm/d1'
import { ZodError } from 'zod'
import {
  SearchProductsArgsSchema,
  GetProductArgsSchema,
  SelectProductArgsSchema,
} from './tools/schemas'
import type { SelectProductArgs } from './tools/schemas'
import { searchProducts, getProduct } from './tools/handlers'

/**
 * Contexto de usuário injetado pelo middleware de autenticação do Hono.
 * NUNCA deve ser preenchido com dados vindos do output do LLM —
 * isso fecha a vulnerabilidade de escalada de privilégios.
 */
export interface UserContext {
  userId: string
  email?: string
}

/**
 * executeToolHarness — a ÚNICA porta de entrada para executar ferramentas.
 *
 * Responsabilidades:
 * 1. Validar `rawArgs` contra o schema Zod correspondente ao `toolName`.
 *    Um ZodError resulta em erro descritivo retornado ao LLM (sem crash).
 * 2. Injetar `userContext.userId` onde necessário — nunca aceitar userId do LLM.
 * 3. Chamar o handler correto com argumentos tipados e seguros.
 * 4. Capturar erros de execução do handler com try/catch e retornar mensagem
 *    estruturada em vez de propagar exceção para o orchestrator.
 *
 * Para `select_product_for_purchase`: esta tool não acessa o DB. O harness
 * valida os argumentos e os retorna para que o orchestrator monte a resposta
 * de checkout. O `userContext.userId` é retornado junto para auditoria.
 */
export async function executeToolHarness(
  toolName: string,
  rawArgs: unknown,
  userContext: UserContext,
  db: ReturnType<typeof drizzle>,
): Promise<unknown> {
  try {
    switch (toolName) {
      case 'search_products': {
        const args = SearchProductsArgsSchema.parse(rawArgs)
        return await searchProducts(db, args)
      }

      case 'get_product': {
        const args = GetProductArgsSchema.parse(rawArgs)
        return await getProduct(db, args)
      }

      case 'select_product_for_purchase': {
        // Valida os argumentos mas não acessa o DB.
        // O orchestrator usa o resultado validado para montar a ChatResponse de checkout.
        // userId é incluído no retorno para rastreabilidade/auditoria.
        const args = SelectProductArgsSchema.parse(rawArgs)
        return { ...args, userId: userContext.userId }
      }

      default:
        return { error: `tool desconhecida: ${toolName}` }
    }
  } catch (err) {
    if (err instanceof ZodError) {
      // Retorna erros de validação como mensagem estruturada para o LLM,
      // forçando-o a corrigir os argumentos na próxima tentativa.
      const issues = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      return { error: `argumento inválido — ${issues}` }
    }
    // Erros inesperados de DB ou runtime são logados e retornam mensagem genérica.
    console.error(`[harness] erro ao executar tool "${toolName}":`, err)
    return { error: `falha interna ao executar ${toolName}` }
  }
}

// Re-exporta SelectProductArgs para o orchestrator extrair os dados de checkout
// sem precisar reimportar do schema diretamente.
export type { SelectProductArgs }
