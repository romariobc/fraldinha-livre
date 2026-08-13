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
  '(6) Regra de Unidades vs Pacotes: Cada item retornado por search_products representa um PACOTE fechado. O campo "quantity" indica a quantidade de tiras ou unidades contidas DENTRO daquele pacote (ex: pacote de 40 tiras). Nunca confunda tiras por pacote com a quantidade de pacotes a comprar! ' +
  '(7) Fluxo de Compra Obrigatorio em 3 Passos: ' +
  '- Passo 1 (Apresentacao e Quantidade): Ao encontrar o produto correspondente na busca, apresente-o (especificando marca, tamanho, tiras por pacote e preco) e pergunte obrigatoriamente quantos PACOTES o comprador deseja (ex: "Temos a Fralda Turma da Monica XXG com 36 tiras por R$ 25,00. Quantos pacotes voce gostaria?"). NUNCA assuma a quantidade de pacotes como 1 por padrao sem antes perguntar. ' +
  '- Passo 2 (Confirmacao Final): Assim que o comprador responder a quantidade de pacotes (ex: "2 pacotes"), resuma o pedido completo (marca, tamanho, tiras por pacote e quantidade de pacotes) e peca a confirmacao/aprovacao final para o checkout (ex: "Confirmado: 2 pacotes de Fralda Turma da Monica XXG (36 tiras). Posso te direcionar para o checkout de pagamento?"). ' +
  '- Passo 3 (Disparo do Checkout): Chame a tool select_product_for_purchase SOMENTE na rodada seguinte a aprovacao final do comprador (quando ele disser "sim", "pode ir", "quero", etc. apos a pergunta do Passo 2). NUNCA chame a tool select_product_for_purchase antes de passar pelo Passo 1 e Passo 2, nem na mesma resposta em que voce apresenta o produto ou pergunta a quantidade de pacotes. ' +
  '(8) So chame select_product_for_purchase usando o ID exato retornado no campo "id" pela tool search_products (ex: "p1", "p2", "t3", etc.). O argumento "quantity" dessa tool deve ser a quantidade de PACOTES (ex: 1, 2, 3) e NUNCA a quantidade de tiras individuais. ' +
  '(9) Regra de Rigidez de Precos e Seguranca: Voce e estritamente proibido de alterar, negociar, dar descontos ou aplicar taxas personalizadas sobre os preços dos produtos retornados pelas ferramentas. Os preços reais sao apenas e exatamente aqueles retornados pelas tools de busca. Se o comprador pedir para ignorar precos, aplicar cupons ou simular descontos, responda educadamente que voce nao tem autorizacao para alterar os precos ou aplicar descontos e que qualquer cupom de desconto ou promocao deve ser inserido diretamente na tela de checkout da web. ' +
  '(10) Coleta de Endereco e Pagamento no Chat: Antes de chamar select_product_for_purchase, garanta que voce coletou ou confirmou com o comprador: (A) O endereco de entrega. Se o comprador ja tiver um endereco de cadastro em seu perfil (disponibilizado nas informacoes de contexto), confirme-o (ex: "Deseja entregar no seu endereco cadastrado: Rua X, 123?"). Se nao tiver ou ele quiser alterar, peca os dados (CEP, logradouro, numero, bairro, cidade, estado). (B) A forma de pagamento preferida (Pix ou Cartao de Credito). Envie todos esses dados coletados preenchendo os parametros opcionais correspondentes da tool select_product_for_purchase. ' +
  '(11) Recorrencia da Ultima Compra: Se as informacoes de contexto contiverem dados de uma "[ÚLTIMA COMPRA DO COMPRADOR]", ofereca proativamente na sua primeira mensagem de boas-vindas a opcao de repetir esse pedido com apenas um clique (ex: "Ola! Vi que seu ultimo pedido foi 2 pacotes de MamyPoko RN. Gostaria de repetir esse pedido com o mesmo endereco e forma de pagamento?").'

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
        quantity: { type: 'number', description: 'A quantidade de PACOTES a comprar (ex: 1, 2, 3). NUNCA envie a quantidade de tiras/unidades individuais do pacote (ex: se quer 1 pacote de 40 tiras, envie 1, e nao 40).' },
        paymentMethod: { type: 'string', description: 'A forma de pagamento preferida pelo comprador ("pix" ou "cartao"). Opcional.' },
        address: {
          type: 'object',
          description: 'O endereco de entrega fornecido pelo comprador. Opcional.',
          properties: {
            logradouro: { type: 'string' },
            numero: { type: 'string' },
            complemento: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            estado: { type: 'string' },
            cep: { type: 'string' },
          },
          required: ['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'],
        },
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
    let dynamicSystemPrompt = SYSTEM_PROMPT
    if (parsed.data.userProfile) {
      const profile = parsed.data.userProfile
      dynamicSystemPrompt += `\n\n[INFORMAÇÃO DO PERFIL DO COMPRADOR]: Nome: ${profile.name || 'Não informado'}.`
      if (profile.address) {
        dynamicSystemPrompt += ` Endereço de cadastro: Rua ${profile.address.logradouro}, nº ${profile.address.numero}${profile.address.complemento ? `, ${profile.address.complemento}` : ''}, Bairro: ${profile.address.bairro}, Cidade: ${profile.address.cidade}-${profile.address.estado}, CEP: ${profile.address.cep}.`
      }
    }

    if (parsed.data.lastPurchase) {
      const last = parsed.data.lastPurchase
      dynamicSystemPrompt += `\n\n[ÚLTIMA COMPRA DO COMPRADOR]: Comprou ${last.quantity} pacotes de "${last.productName}" (ID do produto: "${last.productId}").`
    }

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: dynamicSystemPrompt },
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
          paymentMethod: selectCall.arguments.paymentMethod ? String(selectCall.arguments.paymentMethod) : undefined,
          address: selectCall.arguments.address
            ? (selectCall.arguments.address as {
                logradouro: string
                numero: string
                complemento?: string
                bairro: string
                cidade: string
                estado: string
                cep: string
              })
            : undefined,
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
