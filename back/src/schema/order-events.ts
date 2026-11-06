import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { orders } from './orders'

export const orderEvents = sqliteTable('order_events', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  mutationId: text('mutation_id').notNull().unique(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorId: text('actor_id').notNull(),
  requestId: text('request_id'),
  reason: text('reason'),
  stockEffect: text('stock_effect').$type<'decrement' | 'restore' | 'none'>().notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({ orderCreatedIdx: index('idx_order_events_order_created').on(table.orderId, table.createdAt) }))
