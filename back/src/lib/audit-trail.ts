import type { Context } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { AuditEventSchema, type AuditTargetType } from '../../../packages/contracts/src/audit'
import { auditLogs } from '../schema/audit-logs'
import type { Env, AppContext } from '../env'
import { logger } from './logger'

type AuditContext = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>

export interface RecordAuditEventParams {
  targetType: AuditTargetType
  targetId: string
  action: string
  reason: string
  metadata?: Record<string, unknown>
}

export async function recordAuditEvent(c: AuditContext, db: ReturnType<typeof drizzle>, params: RecordAuditEventParams) {
  const actorId = c.get('uid')
  const requestId = c.get('requestId')
  if (!actorId || !requestId) {
    throw new Error('Contexto de auditoria incompleto')
  }

  const event = AuditEventSchema.parse({
    id: crypto.randomUUID(),
    actorId,
    actorRole: 'admin',
    targetType: params.targetType,
    targetId: params.targetId,
    action: params.action,
    reason: params.reason,
    metadata: params.metadata,
    requestId,
    createdAt: new Date().toISOString(),
  })

  await db.insert(auditLogs).values({
    id: event.id,
    actorId: event.actorId,
    actorRole: event.actorRole,
    targetType: event.targetType,
    targetId: event.targetId,
    action: event.action,
    reason: event.reason,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    requestId: event.requestId,
    createdAt: event.createdAt,
  })

  logger.info(c, 'audit.event.recorded', {
    auditId: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
  })

  return event
}
