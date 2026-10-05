import type { ChatCompletionTool } from '../../chat-completion'

/**
 * Definições das ferramentas disponíveis para o LLM.
 *
 * Estas definições descrevem a interface de cada tool para o modelo — elas não
 * contêm lógica de execução. A execução real é feita pelo harness (harness.ts),
 * que valida os argumentos via Zod antes de chamar os handlers (handlers.ts).
 */
export const AI_TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description:
      'Busca produtos do catálogo. Preencha brand/size/categoria quando souber (mais preciso que ' +
      'só texto livre) — por exemplo, se o comprador disse a marca numa mensagem e o tamanho em ' +
      'outra, preencha os dois campos juntos nesta mesma chamada.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto livre p/ nome/descrição/categoria (opcional)' },
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
      properties: {
        productId: {
          type: 'string',
          description: 'O id exato do produto retornado no campo "id" por search_products',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'select_product_for_purchase',
    description: 'Chame quando tiver certeza de qual produto e quantidade o comprador quer comprar',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'O id exato do produto retornado no campo "id" por search_products',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description:
            'A quantidade de PACOTES a comprar (ex: 1, 2, 3). NUNCA envie a quantidade de tiras/unidades individuais do pacote (ex: se quer 1 pacote de 40 tiras, envie 1, e não 40). Máximo: 50.',
        },
        paymentMethod: {
          type: 'string',
          enum: ['pix', 'cartao'],
          description: 'A forma de pagamento preferida pelo comprador ("pix" ou "cartao"). Opcional.',
        },
        address: {
          type: 'object',
          description: 'Objeto JSON com os campos do endereço. Nunca envie uma string com o endereço completo. Todos os valores, inclusive numero e cep, são strings. Opcional.',
          properties: {
            logradouro: { type: 'string' },
            numero: { type: 'string', description: 'Número do imóvel como string, por exemplo "123"' },
            complemento: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            estado: { type: 'string' },
            cep: { type: 'string', description: 'CEP como string de 8 dígitos' },
          },
          required: ['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'],
        },
      },
      required: ['productId', 'quantity'],
    },
  },
]
