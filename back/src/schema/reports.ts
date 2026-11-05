import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { orders } from './orders'

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  supplierId: text('supplier_id').notNull(),
  clientId: text('client_id').notNull(),
  message: text('message').notNull(),
  status: text('status', { enum: ['aberta', 'em_atendimento', 'resolvida'] }).notNull().default('aberta'),
  version: integer('version').notNull().default(0),
  openedBy: text('opened_by'),
  openedRole: text('opened_role', { enum: ['comprador', 'fornecedor'] }),
  resolvedBy: text('resolved_by'),
  resolvedAt: text('resolved_at'),
  mutationId: text('mutation_id'),
  read: integer('read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  orderIdIdx: index('idx_reports_order_id').on(table.orderId),
  clientIdIdx: index('idx_reports_client_id').on(table.clientId),
}))

export const reportMessages = sqliteTable('report_messages', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role', { enum: ['comprador', 'fornecedor', 'admin'] }).notNull(),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
  resolution: integer('resolution', { mode: 'boolean' }).notNull().default(false),
}, table => ({ reportIdx: index('idx_report_messages_report').on(table.reportId, table.createdAt) }))
