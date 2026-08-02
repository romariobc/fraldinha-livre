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

const SYSTEM_PROMPT =
  'Voce e o assistente de compras da Fraldinha Livre. Ajude o comprador a achar o produto certo ' +
  'no catalogo (fraldas e itens relacionados), perguntando marca/tamanho quando precisar. Use ' +
  'search_products e get_product para consultar o catalogo real - nunca invente produto, preco ou ' +
  'id. So chame select_product_for_purchase quando tiver certeza do productId e da quantidade.'

const TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description: 'Busca produtos do catalogo por nome, marca ou categoria',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Detalhe de um produto pelo id',
    parameters: {
      type: 'object',
      properties: { productId: { type: 'string' } },
      required: ['productId'],
    },
  },
  {
    name: 'select_product_for_purchase',
    description:
      'Chame quando tiver certeza de qual produto (productId real do catalogo) e quantidade o ' +
      'comprador quer comprar',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: ['productId', 'quantity'],
    },
  },
]

const MAX_TOOL_ITERATIONS = 4

export function createChatHandler(runChatCompletion: RunChatCompletion) {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'payload invalido' }, 400)
    }

    const db = drizzle(c.env.DB)
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
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
        const response: ChatResponse = { type: 'text', content: result.text ?? '' }
        return c.json(response, 200)
      }

      for (const call of result.toolCalls) {
        messages.push({ role: 'assistant', content: JSON.stringify(call) })
        const toolResult = await runDataTool(db, call)
        messages.push({ role: 'tool', content: JSON.stringify(toolResult), toolCallId: call.id })
      }
    }

    return c.json({ error: 'assistente indisponivel, tente novamente' }, 502)
  }
}

async function runDataTool(db: ReturnType<typeof drizzle>, call: ChatCompletionToolCall) {
  if (call.name === 'search_products') {
    return searchProducts(db, String(call.arguments.query ?? ''))
  }
  if (call.name === 'get_product') {
    return getProduct(db, String(call.arguments.productId ?? ''))
  }
  return { error: `tool desconhecida: ${call.name}` }
}
