import { z } from 'zod'

export const ApiErrorCodeSchema = z.enum([
  // Erros de cliente e validação (400)
  'INVALID_REQUEST',
  'IDEMPOTENCY_KEY_REQUIRED',
  'PRICE_MISMATCH',
  'SUPPLIER_MISMATCH',
  'TOTAL_MISMATCH',

  // Autenticação e Autorização (401 / 403 / 409)
  'UNAUTHORIZED',
  'FORBIDDEN',
  'AUTHORIZATION_STATE_CONFLICT',
  'ROLE_CHANGE_NOT_ALLOWED',

  // Entidades e Recursos (404 em recursos diretos por ID, ou 400 em divergência de validação de itens no POST /orders)
  'RESOURCE_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
  'ORDER_NOT_FOUND',

  // Regras de Negócio e Conflito (409)
  'INSUFFICIENT_STOCK',
  'ORDER_NOT_AWAITING',
  'IDEMPOTENCY_CONFLICT',

  // Provedores Externos e Servidor (500 / 502)
  'AUTH_PROVIDER_NOT_CONFIGURED',
  'AUTH_PROVIDER_LOOKUP_FAILED',
  'AUTH_PROVIDER_UPDATE_FAILED',
  'AI_PROVIDER_ERROR',
  'INTERNAL_ERROR',
])

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorDetailItemSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])).optional(),
  code: z.string().optional(),
  message: z.string().optional(),
}).passthrough()

export const ApiErrorDetailsSchema = z.union([
  z.array(z.record(z.unknown())),
  z.record(z.unknown()),
  z.string(),
])

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  requestId: z.string(),
  details: ApiErrorDetailsSchema.optional(),
})

export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorSchema,
})

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>
