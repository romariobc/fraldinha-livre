import { z } from 'zod'
import { ChatAddressSchema } from '../../../../../packages/contracts/src/chat'

// Identificador seguro de produto: apenas chars alfanuméricos, hífen e underscore.
// Previne injeção de SQL ou manipulação de ID via output do LLM.
const ProductIdSchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
  message: 'productId deve conter apenas letras, números, hífens e underscores',
})

// Converte strings vazias ou só-espaços em undefined, reproduzindo o comportamento
// do antigo toOptionalString(). Evita que `eq(products.size, '')` filtre tudo
// fora em silêncio quando o modelo LLM omite um campo mas manda string vazia
// em vez de ausência da chave — achado de produção documentado em 0a4b0dc.
const trimmedOptionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))

// ─────────────────────────────────────────────────────────────
// search_products
// ─────────────────────────────────────────────────────────────
export const SearchProductsArgsSchema = z.object({
  query:     trimmedOptionalString(200),
  brand:     trimmedOptionalString(100),
  size:      trimmedOptionalString(20),
  categoria: trimmedOptionalString(100),
})
export type SearchProductsArgs = z.infer<typeof SearchProductsArgsSchema>

// ─────────────────────────────────────────────────────────────
// get_product
// ─────────────────────────────────────────────────────────────
export const GetProductArgsSchema = z.object({
  productId: ProductIdSchema,
})
export type GetProductArgs = z.infer<typeof GetProductArgsSchema>

// ─────────────────────────────────────────────────────────────
// select_product_for_purchase
//
// quantity: máximo de 50 pacotes por pedido. Limite de negócio que previne
// ataques de exaustão de estoque via output do LLM (aprovado em task-1, 2026-08-13).
// ─────────────────────────────────────────────────────────────
export const SelectProductArgsSchema = z.object({
  productId: ProductIdSchema,
  quantity: z.number().int().min(1).max(50, {
    message: 'quantity não pode exceder 50 pacotes por pedido',
  }),
  paymentMethod: z.enum(['pix', 'cartao']).optional(),
  address: ChatAddressSchema.optional(),
})
export type SelectProductArgs = z.infer<typeof SelectProductArgsSchema>
