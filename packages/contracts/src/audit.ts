import { z } from 'zod'

export const AuditTargetTypeSchema = z.enum(['product', 'order', 'user', 'system'])
export type AuditTargetType = z.infer<typeof AuditTargetTypeSchema>

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.literal('admin'),
  targetType: AuditTargetTypeSchema,
  targetId: z.string().min(1),
  action: z.string().min(1).max(100),
  reason: z.string().trim().min(5).max(500),
  metadata: z.record(z.unknown()).optional(),
  requestId: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  targetType: AuditTargetTypeSchema.optional(),
  targetId: z.string().min(1).optional(),
  action: z.string().min(1).max(100).optional(),
})
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>

export const AdminModerateProductSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(5).max(500),
})
export type AdminModerateProduct = z.infer<typeof AdminModerateProductSchema>

export const AdminAuditLogsResponseSchema = z.object({
  logs: z.array(AuditEventSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
})
export type AdminAuditLogsResponse = z.infer<typeof AdminAuditLogsResponseSchema>
