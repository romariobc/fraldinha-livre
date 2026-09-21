import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env, applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware, requireAnyRole } from '../src/middleware/auth'
import { adminAuditLogsGetHandler, adminProductStatusPatchHandler } from '../src/routes/admin'
import { products } from '../src/schema/products'
import type { AppContext, Env } from '../src/env'

const productId = 'audit-product-1'

function createTestApp() {
  const verify = async (token: string) => {
    if (token === 'admin') return { uid: 'admin-1', role: 'admin' as const }
    if (token === 'buyer') return { uid: 'buyer-1', role: 'comprador' as const }
    if (token === 'supplier') return { uid: 'supplier-1', role: 'fornecedor' as const }
    return null
  }
  const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  app.use('*', (c, next) => {
    c.set('requestId', c.req.header('X-Request-Id') || 'audit-test-request')
    return next()
  })
  app.use('/admin/*', (c, next) => createAuthMiddleware(verify)(c, next))
  app.get('/admin/audit-logs', requireAnyRole(['admin']), adminAuditLogsGetHandler)
  app.patch('/admin/products/:id/status', requireAnyRole(['admin']), adminProductStatusPatchHandler)
  return app
}

describe('AUDIT-001 — trilha administrativa', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    await drizzle(env.DB).insert(products).values({
      id: productId,
      supplierId: 'supplier-1',
      name: 'Produto auditável',
      brand: 'Marca',
      size: 'M',
      quantity: 10,
      slug: 'produto-auditavel',
      categoria: 'teste',
      descricao: 'Produto para teste de auditoria',
      atributos: { faixaPeso: '5-9 kg', genero: 'unissex', absorcao: 'alta', tecnologia: 'teste' },
      priceCents: 1000,
      active: true,
    })
  })

  it('restringe a consulta de auditoria a administradores', async () => {
    const app = createTestApp()
    expect((await app.fetch(new Request('http://localhost/admin/audit-logs'), env)).status).toBe(401)
    expect((await app.fetch(new Request('http://localhost/admin/audit-logs', { headers: { Authorization: 'Bearer buyer' } }), env)).status).toBe(403)
    expect((await app.fetch(new Request('http://localhost/admin/audit-logs', { headers: { Authorization: 'Bearer admin' } }), env)).status).toBe(200)
  })

  it('modera produto com justificativa e grava correlação de request', async () => {
    const app = createTestApp()
    const requestId = 'audit-correlation-1'
    const response = await app.fetch(new Request(`http://localhost/admin/products/${productId}/status`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      body: JSON.stringify({ active: false, reason: 'Produto fora da política' }),
    }), env)
    expect(response.status).toBe(200)
    const body = await response.json() as { product: { active: boolean }; auditId: string }
    expect(body.product.active).toBe(false)
    expect(body.auditId).toBeTruthy()

    const logsResponse = await app.fetch(new Request('http://localhost/admin/audit-logs?action=product.deactivated', {
      headers: { Authorization: 'Bearer admin' },
    }), env)
    const logs = await logsResponse.json() as { logs: Array<{ targetId: string; requestId: string; reason: string }> }
    const log = logs.logs.find((entry) => entry.targetId === productId)
    expect(log?.requestId).toBe(requestId)
    expect(log?.reason).toBe('Produto fora da política')
  })

  it('rejeita justificativa inválida sem alterar produto', async () => {
    const app = createTestApp()
    const response = await app.fetch(new Request(`http://localhost/admin/products/${productId}/status`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, reason: 'não' }),
    }), env)
    expect(response.status).toBe(400)
    const row = await env.DB.prepare('SELECT active FROM products WHERE id = ?').bind(productId).first<{ active: number }>()
    expect(row?.active).toBe(0)
  })
})
