import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { orders } from './orders'

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  supplierId: text('supplier_id').notNull(),
  clientId: text('client_id').notNull(),
  message: text('message').notNull(),
  read: integer('read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  orderIdIdx: index('idx_reports_order_id').on(table.orderId),
  clientIdIdx: index('idx_reports_client_id').on(table.clientId),
}))
