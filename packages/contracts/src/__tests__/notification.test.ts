import { describe, expect, it } from 'vitest'
import { NotificationIdSchema, NotificationDestinationSchema, NotificationsPageSchema, NotificationReadSchema } from '../notification'

describe('MP-09 notifications contract', () => {
  it('accepts persisted read/unread pages and continuation cursors', () => {
    expect(NotificationsPageSchema.parse({ items: [{ id: '12', kind: 'new_order', message: 'Novo pedido', createdAt: '2026-11-05T12:00:00.000Z', readAt: null }], nextCursor: '12', unreadCount: 2 }).items).toHaveLength(1)
    expect(NotificationReadSchema.parse({ id: '12', readAt: '2026-11-05T13:00:00.000Z' }).id).toBe('12')
  })
  it.each(['0', '-1', '1.5', '1 OR 1=1', '9007199254740992', '01'])('rejects unsafe identifiers: %s', value => {
    expect(NotificationIdSchema.safeParse(value).success).toBe(false)
  })
  it('only allows typed destinations, including the fixed supplier route', () => {
    expect(NotificationDestinationSchema.safeParse({ type: 'order', orderId: 'order', scope: 'fornecedor' }).success).toBe(true)
    expect(NotificationDestinationSchema.safeParse({ type: 'occurrence', orderId: 'order', reportId: 'report' }).success).toBe(true)
    expect(NotificationDestinationSchema.safeParse({ type: 'supplier', href: 'https://example.org' }).success).toBe(false)
    expect(NotificationDestinationSchema.safeParse({ type: 'order', orderId: 'order', scope: 'root' }).success).toBe(false)
  })
})
