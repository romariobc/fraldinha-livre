import { z } from 'zod'

export const NotificationIdSchema = z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value)), 'Identificador inválido')
export const NotificationSchema = z.object({
  id: NotificationIdSchema,
  kind: z.enum(['new_order', 'order_status', 'order_cancelled', 'supplier_decision', 'occurrence_reply']),
  message: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})
export const NotificationsPageSchema = z.object({
  items: z.array(NotificationSchema).max(50),
  nextCursor: NotificationIdSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
})
export const NotificationReadSchema = z.object({ id: NotificationIdSchema, readAt: z.string().datetime() })
export const NotificationDestinationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('order'), orderId: z.string().min(1), scope: z.enum(['comprador', 'fornecedor', 'admin']) }),
  z.object({ type: z.literal('occurrence'), orderId: z.string().min(1), reportId: z.string().min(1) }),
  z.object({ type: z.literal('supplier'), href: z.literal('/painel-fornecedor') }),
])
export type InternalNotification = z.infer<typeof NotificationSchema>
export type NotificationsPage = z.infer<typeof NotificationsPageSchema>
export type NotificationDestination = z.infer<typeof NotificationDestinationSchema>
