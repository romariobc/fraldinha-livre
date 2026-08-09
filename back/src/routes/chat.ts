import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { ChatRequestSchema } from '../../../packages/contracts/src/chat'
import type { ChatResponse } from '../../../packages/contracts/src/chat'
import type {
  RunChatCompletion,
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionToolCall,
} from '../lib/chat-completion'
import { searchProducts, getProduct } from '../lib/chat-tools'
import type { Env, AppContext } from '../env'

// Achado real de producao (2026-08-03, log [chat-diag] via wrangler tail): o
// modelo, ao tentar perguntar uma coisa E indicar que vai buscar na mesma
// resposta, as vezes escreve a chamada da tool como texto (ex.:
// "[search_products(brand=\"Pampers\")]") em vez de chamar de verdade -
// rawToolCallsCount fica 0 nesses casos, nao e bug de parsing nosso. As regras
// abaixo (uma acao por resposta, nunca narrar a tool, preferir chamar com o
// que ja sabe) miram direto nesse padrao. Precisa de validacao humana - prompt
// nao e testavel por unit test.
const SYSTEM_PROMPT =
  'Voce e o assistente de compras da Fraldinha Livre. Ajude o comprador a achar o produto certo ' +
  'no catalogo (fraldas e itens relacionados). Regras obrigatorias: ' +
  '(1) Cada resposta sua faz UMA coisa: OU voce pergunta uma unica informacao que falta (texto ' +
  'curto, uma pergunta so) OU voce chama uma tool de verdade - nunca as duas coisas juntas. ' +
  '(2) NUNCA escreva a sintaxe de uma chamada de funcao como texto (nada como ' +
  '"[search_products(...)]" ou "vou chamar a funcao..."). Se decidiu buscar, CHAME a tool - nao ' +
  'descreva que vai chamar. ' +
  '(3) Se ja sabe o suficiente pra buscar (ex: marca foi mencionada), CHAME search_products ' +
  'imediatamente com o que sabe, mesmo sem o tamanho ainda - nao pergunte antes de tentar buscar. ' +
  '(4) Ao chamar search_products, preencha brand/size/categoria como campos SEPARADOS quando ' +
  'souber esses dados (nao junte tudo numa frase so em query). ' +
  '(5) Respostas de texto sao curtas - uma ou duas frases, nunca paragrafos longos nem multiplas ' +
  'perguntas na mesma mensagem. ' +
  '(6) Nunca invente produto, preco ou id - use search_products/get_product pra confirmar. ' +
  '(7) So chame select_product_for_purchase usando o ID exato retornado no campo "id" pela tool search_products (ex: "p1", "p2", "t3", etc.). Nunca invente ou use strings descritivas como ID.'

const TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description:
      'Busca produtos do catalogo. Preencha brand/size/categoria quando souber (mais preciso que ' +
      'so texto livre) - por exemplo, se o comprador disse a marca numa mensagem e o tamanho em ' +
      'outra, preencha os dois campos juntos nesta mesma chamada.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto livre p/ nome/descricao/categoria (opcional)' },
        brand: { type: 'string', description: 'Marca exata, ex: Pampers, Huggies, MamyPoko (opcional)' },
        size: { type: 'string', description: 'Tamanho exato, ex: P, M, G, GG, RN, XXG (opcional)' },
        categoria: { type: 'string', description: 'Categoria do produto (opcional)' },
      },
      required: [],
    },
  },
  {
    name: 'get_product',
    description: 'Detalhe de um produto pelo id',
    parameters: {
      type: 'object',
      properties: { productId: { type: 'string', description: 'O id exato do produto retornado no campo "id" por search_products (ex: "p1", "p2", "t3")' } },
      required: ['productId'],
    },
  },
  {
    name: 'select_product_for_purchase',
    description:
      'Chame quando tiver certeza de qual produto e quantidade o comprador quer comprar',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'O id exato do produto retornado no campo "id" por search_products (ex: "p1", "p2", "t3")',
        },
        quantity: { type: 'number' },
      },
      required: ['productId', 'quantity'],
    },
  },
]

const MAX_TOOL_ITERATIONS = 4

// O modelo pode terminar uma rodada de tool-use sem gerar texto (achado em
// producao, 2026-08-03). Devolver content vazio quebraria duas coisas: a UI
// mostraria uma bolha em branco, e o proximo turno reenviaria essa mensagem no
// historico, que ChatMessageSchema (min(1)) rejeitaria com 400 — o servidor
// travando a propria conversa. Nunca deixar um content vazio sair da rota.
export const EMPTY_RESPONSE_FALLBACK = 'Desculpe, não entendi. Pode reformular?'

export function createChatHandler(runChatCompletion: RunChatCompletion) {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'payload invalido' }, 400)
    }

    const db = drizzle(c.env.DB)
    const history: ChatCompletionMessage[] = parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const lastIndex = history.length - 1
    if (parsed.data.image && history[lastIndex].role === 'user') {
      history[lastIndex] = { ...history[lastIndex], imageUrl: parsed.data.image }
    }
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await runChatCompletion(messages, TOOLS)

      const selectCall = result.toolCalls.find((call) => call.name === 'select_product_for_purchase')
      if (selectCall) {
        const response: ChatResponse = {
          type: 'action',
          action: 'select_product',
          productId: String(selectCall.arguments.productId),
          quantity: Number(selectCall.arguments.quantity),
        }
        return c.json(response, 200)
      }

      if (result.toolCalls.length === 0) {
        const content = result.text?.trim() ? result.text : EMPTY_RESPONSE_FALLBACK
        const response: ChatResponse = { type: 'text', content }
        return c.json(response, 200)
      }

      for (const call of result.toolCalls) {
        messages.push({ role: 'assistant', content: JSON.stringify(call) })
        const rawToolResult = await runDataTool(db, call)
        
        const toolResult = (call.name === 'search_products' && Array.isArray(rawToolResult) && rawToolResult.length === 0)
          ? [{ type: 'fallback', message: 'No products found. Please inform the user in a natural way.' }]
          : rawToolResult
        
        messages.push({ role: 'tool', content: JSON.stringify(toolResult), toolCallId: call.id })
      }
    }

    return c.json({ error: 'assistente indisponivel, tente novamente' }, 502)
  }
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

async function runDataTool(db: ReturnType<typeof drizzle>, call: ChatCompletionToolCall) {
  if (call.name === 'search_products') {
    return searchProducts(db, {
      query: toOptionalString(call.arguments.query),
      brand: toOptionalString(call.arguments.brand),
      size: toOptionalString(call.arguments.size),
      categoria: toOptionalString(call.arguments.categoria),
    })
  }
  if (call.name === 'get_product') {
    return getProduct(db, String(call.arguments.productId ?? ''))
  }
  return { error: `tool desconhecida: ${call.name}` }
}
