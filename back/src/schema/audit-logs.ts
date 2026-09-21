import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  metadata: text('metadata'),
  requestId: text('request_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  targetIdx: index('idx_audit_logs_target').on(table.targetType, table.targetId),
  actorIdx: index('idx_audit_logs_actor').on(table.actorId),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  createdIdx: index('idx_audit_logs_created_at').on(table.createdAt),
}))
