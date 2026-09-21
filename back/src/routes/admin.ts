import { drizzle } from 'drizzle-orm/d1'
import { desc, eq } from 'drizzle-orm'
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
import { recordAuditEvent } from '../lib/audit-trail'
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
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).all()
    const filtered = rows.filter((row) =>
      (query.targetType === undefined || row.targetType === query.targetType) &&
      (query.targetId === undefined || row.targetId === query.targetId) &&
      (query.action === undefined || row.action === query.action),
    )
    const start = (query.page - 1) * query.limit
    const logs = filtered.slice(start, start + query.limit).map((row) =>
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
      total: filtered.length,
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
    const current = await db.select().from(products).where(eq(products.id, id)).get()
    if (!current) return respondError(c, 'PRODUCT_NOT_FOUND', 404, 'Produto não encontrado.')

    await db.update(products).set({ active: request.active }).where(eq(products.id, id))
    const event = await recordAuditEvent(c, db, {
      targetType: 'product',
      targetId: id,
      action: request.active ? 'product.activated' : 'product.deactivated',
      reason: request.reason,
      metadata: { oldActive: current.active, newActive: request.active },
    })
    const updated = await db.select().from(products).where(eq(products.id, id)).get()
    if (!updated) throw new Error('Produto não encontrado após moderação')
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
