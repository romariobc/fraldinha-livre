import { z } from 'zod'

export const OccurrenceStatusSchema = z.enum(['aberta', 'em_atendimento', 'resolvida'])
export const OccurrenceTextSchema = z.string().trim().min(5).max(4000)
export const CreateOccurrenceSchema = z.object({ message: OccurrenceTextSchema, requestId: z.string().uuid().optional() }).strict()
export const ReplyOccurrenceSchema = z.object({
  message: OccurrenceTextSchema, requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(),
  status: z.enum(['em_atendimento', 'resolvida']),
}).strict()
export const OccurrenceMessageSchema = z.object({
  id: z.string(), actorId: z.string(), actorRole: z.enum(['comprador', 'fornecedor', 'admin']),
  message: z.string(), createdAt: z.string(), resolution: z.boolean(),
})
export const OccurrenceSchema = z.object({
  id: z.string(), orderId: z.string(), status: OccurrenceStatusSchema, version: z.number().int(),
  createdAt: z.string(), legacy: z.boolean(), resolvedBy: z.string().nullable(), resolvedAt: z.string().nullable(),
  messages: z.array(OccurrenceMessageSchema),
})
export const OccurrencesSchema = z.array(OccurrenceSchema)
export const OccurrenceCreatedSchema = z.object({ success: z.literal(true), reportId: z.string() })
export const OccurrenceRepliedSchema = z.object({ success: z.literal(true), messageId: z.string() })
export type Occurrence = z.infer<typeof OccurrenceSchema>
