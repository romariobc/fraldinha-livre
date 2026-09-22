import { drizzle } from 'drizzle-orm/d1'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { ZodError } from 'zod'
import {
  AdminAuditLogsResponseSchema,
  AdminModerateProductSchema,
  AuditEventSchema,
  AuditLogQuerySchema,
} from '../../../packages/contracts/src/audit'
import { ProductSchema } from '../../../packages/contracts/src/product'
import type { Env, AppContext } from '../env'
import { products } from '../schema/products'
import { auditLogs } from '../schema/audit-logs'
import { createAuditEvent, logAuditEvent } from '../lib/audit-trail'
import { respondError, respondZodError } from '../lib/errors'

type AdminContext = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>

function parseMetadata(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

export const adminAuditLogsGetHandler = async (c: AdminContext) => {
  try {
    const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries())
    const query = AuditLogQuerySchema.parse(rawQuery)
    const db = drizzle(c.env.DB)
    const filters = and(
      query.targetType === undefined ? undefined : eq(auditLogs.targetType, query.targetType),
      query.targetId === undefined ? undefined : eq(auditLogs.targetId, query.targetId),
      query.action === undefined ? undefined : eq(auditLogs.action, query.action),
    )
    const [rows, totals] = await db.batch([
      db.select().from(auditLogs).where(filters)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.limit).offset((query.page - 1) * query.limit),
      db.select({ total: count() }).from(auditLogs).where(filters),
    ])
    const logs = rows.map((row) =>
      AuditEventSchema.parse({
        id: row.id,
        actorId: row.actorId,
        actorRole: row.actorRole,
        targetType: row.targetType,
        targetId: row.targetId,
        action: row.action,
        reason: row.reason,
        metadata: parseMetadata(row.metadata),
        requestId: row.requestId,
        createdAt: row.createdAt,
      }),
    )
    return c.json(AdminAuditLogsResponseSchema.parse({
      logs,
      total: totals[0].total,
      page: query.page,
      limit: query.limit,
    }))
  } catch (error) {
    if (error instanceof ZodError) return respondZodError(c, error)
    throw error
  }
}

export const adminProductStatusPatchHandler = async (c: AdminContext) => {
  const id = c.req.param('id')
  if (!id) return respondError(c, 'INVALID_REQUEST', 400, 'Identificador do produto é obrigatório.')

  try {
    const body = await c.req.json()
    const request = AdminModerateProductSchema.parse(body)
    const db = drizzle(c.env.DB)
    const event = createAuditEvent(c, {
      targetType: 'product',
      targetId: id,
      action: request.active ? 'product.activated' : 'product.deactivated',
      reason: request.reason,
    })
    // D1 batches are transactional. Read oldActive inside the same batch as the
    // update, so concurrent requests cannot produce a stale audit snapshot.
    const [, updatedRows] = await db.batch([
      db.insert(auditLogs).select(db.select({
        id: sql<string>`${event.id}`.as('id'),
        actorId: sql<string>`${event.actorId}`.as('actor_id'),
        actorRole: sql<string>`${event.actorRole}`.as('actor_role'),
        targetType: sql<string>`${event.targetType}`.as('target_type'),
        targetId: products.id,
        action: sql<string>`${event.action}`.as('action'),
        reason: sql<string>`${event.reason}`.as('reason'),
        metadata: sql<string>`json_object('oldActive', json(case when ${products.active} then 'true' else 'false' end), 'newActive', json(${request.active ? 'true' : 'false'}))`.as('metadata'),
        requestId: sql<string>`${event.requestId}`.as('request_id'),
        createdAt: sql<string>`${event.createdAt}`.as('created_at'),
      }).from(products).where(eq(products.id, id))),
      db.update(products).set({ active: request.active }).where(eq(products.id, id)).returning(),
    ])
    const updated = updatedRows[0]
    if (!updated) return respondError(c, 'PRODUCT_NOT_FOUND', 404, 'Produto não encontrado.')
    logAuditEvent(c, event)
    const response = ProductSchema.parse({
      ...updated,
      badge: updated.badge ?? undefined,
      imageUrl: updated.imageUrl ?? undefined,
    })
    return c.json({ product: response, auditId: event.id }, 200)
  } catch (error) {
    if (error instanceof ZodError) return respondZodError(c, error)
    throw error
  }
}
