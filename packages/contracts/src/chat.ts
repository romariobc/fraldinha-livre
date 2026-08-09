import { z } from 'zod'

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

// Fonte unica dos formatos de foto aceitos. O front deriva daqui o `accept` do
// input e a checagem de `file.type`; o schema deriva o regex do data URI. Manter
// as duas pontas derivadas da MESMA lista torna a divergencia impossivel por
// construcao — se divergissem, a foto voltaria a falhar em silencio.
export const SUPPORTED_CHAT_IMAGE_TYPES = ['jpeg', 'jpg', 'png', 'webp'] as const

// So data URI de imagem: o modelo nao aceita URL http, e aceitar uma aqui
// significaria descartar a foto em silencio no meio do caminho.
export const ChatImageDataUrlSchema = z
  .string()
  .regex(
    new RegExp(`^data:image/(${SUPPORTED_CHAT_IMAGE_TYPES.join('|')});base64,[A-Za-z0-9+/=]+$`),
  )

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  image: ChatImageDataUrlSchema.optional(),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const ChatTextResponseSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
})
export type ChatTextResponse = z.infer<typeof ChatTextResponseSchema>

export const ChatActionResponseSchema = z.object({
  type: z.literal('action'),
  action: z.literal('select_product'),
  productId: z.string(),
  quantity: z.number().int().positive(),
})
export type ChatActionResponse = z.infer<typeof ChatActionResponseSchema>

export const ChatResponseSchema = z.union([ChatTextResponseSchema, ChatActionResponseSchema])
export type ChatResponse = z.infer<typeof ChatResponseSchema>
