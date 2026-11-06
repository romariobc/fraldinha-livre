import type { Env } from '../env'

export function adminOrderAuditStatement(db: Env['DB'], mutationId: string) {
  return db.prepare(`INSERT INTO audit_logs (id,actor_id,actor_role,target_type,target_id,action,reason,metadata,request_id,created_at)
    SELECT 'order:' || id,actor_id,'admin','order',order_id,'order.cancelled',reason,
      json_object('fromStatus',from_status,'toStatus',to_status,'eventId',id),COALESCE(request_id,mutation_id),created_at
    FROM order_events WHERE mutation_id = ?`).bind(mutationId)
}
export function adminOccurrenceAuditStatement(db: Env['DB'], messageId: string, excerpt: string, requestId: string) {
  return db.prepare(`INSERT INTO audit_logs (id,actor_id,actor_role,target_type,target_id,action,reason,metadata,request_id,created_at)
    SELECT 'occurrence:' || m.id,m.actor_id,'admin','order',r.order_id,
      CASE WHEN m.resolution = 1 THEN 'occurrence.resolved' ELSE 'occurrence.replied' END,?,
      json_object('reportId',r.id,'messageId',m.id,'resolution',m.resolution),?,m.created_at
    FROM report_messages m JOIN reports r ON r.id=m.report_id WHERE m.id=? AND m.actor_role='admin'`).bind(excerpt, requestId, messageId)
}
