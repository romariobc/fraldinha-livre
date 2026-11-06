import type { Env } from '../env'

const insert = `INSERT INTO notifications
  (source_type, source_id, recipient_uid, kind, order_id, report_id, detail, created_at)`
const deduplicate = ' ON CONFLICT(source_type, source_id, recipient_uid) DO NOTHING'

/** Append after the recorded event, inside its existing D1.batch. Never infer legacy ownership. */
export function orderNotificationStatement(db: Env['DB'], mutationId: string) {
  return db.prepare(`${insert}
    SELECT 'order', id, recipient, kind, order_id, NULL, to_status, created_at FROM (
      SELECT e.*, o.uid AS recipient, 'order_status' AS kind FROM order_events e JOIN orders o ON o.id = e.order_id
        WHERE e.mutation_id = ? AND e.from_status IS NOT NULL AND e.to_status != 'cancelado'
      UNION ALL
      SELECT e.*, o.uid AS recipient, 'order_cancelled' AS kind FROM order_events e JOIN orders o ON o.id = e.order_id
        WHERE e.mutation_id = ? AND e.to_status = 'cancelado'
      UNION ALL
      SELECT e.*, o.supplier_id AS recipient, CASE WHEN e.from_status IS NULL THEN 'new_order' ELSE 'order_cancelled' END AS kind
        FROM order_events e JOIN orders o ON o.id = e.order_id
        WHERE e.mutation_id = ? AND (e.from_status IS NULL OR e.to_status = 'cancelado')
    ) WHERE recipient IS NOT NULL AND recipient != '' AND recipient != actor_id ${deduplicate}`)
    .bind(mutationId, mutationId, mutationId)
}

export function supplierNotificationStatement(db: Env['DB'], auditId: string) {
  return db.prepare(`${insert}
    SELECT 'supplier', id, target_id, 'supplier_decision', NULL, NULL, action, created_at FROM audit_logs
    WHERE id = ? AND target_type = 'user' AND actor_role = 'admin' AND target_id != actor_id
      AND action IN ('supplier.aprovado','supplier.rejeitado','supplier.suspenso') ${deduplicate}`).bind(auditId)
}

export function occurrenceNotificationStatement(db: Env['DB'], messageId: string) {
  return db.prepare(`${insert}
    SELECT 'occurrence', id, recipient, 'occurrence_reply', order_id, report_id, detail, created_at FROM (
      SELECT m.*, r.order_id, r.client_id AS recipient, CASE WHEN m.resolution = 1 THEN 'resolved' ELSE 'reply' END AS detail
        FROM report_messages m JOIN reports r ON r.id = m.report_id WHERE m.id = ?
      UNION ALL
      SELECT m.*, r.order_id, r.supplier_id AS recipient, CASE WHEN m.resolution = 1 THEN 'resolved' ELSE 'reply' END AS detail
        FROM report_messages m JOIN reports r ON r.id = m.report_id WHERE m.id = ?
    ) WHERE recipient IS NOT NULL AND recipient != '' AND recipient != actor_id ${deduplicate}`).bind(messageId, messageId)
}
