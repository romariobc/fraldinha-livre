import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
    if (token === 'conflict') return { uid: 'admin-1', claims: { admin: true, comprador: true } }
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
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM audit_logs').run()
    await env.DB.prepare('UPDATE products SET active = 1 WHERE id = ?').bind(productId).run()
  })

  const moderate = (token = 'admin', id = productId) => createTestApp().fetch(new Request(`http://localhost/admin/products/${id}/status`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false, reason: 'Moderação de teste' }),
  }), env)

  it.each(['buyer', 'supplier', 'conflict'])('nega moderação a %s sem efeitos persistidos', async (role) => {
    expect((await moderate(role)).status).toBe(403)
    expect(await env.DB.prepare('SELECT active FROM products WHERE id = ?').bind(productId).first('active')).toBe(1)
    expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM audit_logs').first('total')).toBe(0)
  })

  it('nega moderação anônima', async () => {
    const response = await createTestApp().fetch(new Request(`http://localhost/admin/products/${productId}/status`, {
      method: 'PATCH', body: JSON.stringify({ active: false, reason: 'Moderação de teste' }),
    }), env)
    expect(response.status).toBe(401)
  })

  it('não cria auditoria para produto inexistente', async () => {
    expect((await moderate('admin', 'inexistente')).status).toBe(404)
    expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM audit_logs').first('total')).toBe(0)
  })

  it('falha da auditoria não altera o produto', async () => {
    await env.DB.prepare("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END").run()
    try {
      expect((await moderate()).status).toBe(500)
      expect(await env.DB.prepare('SELECT active FROM products WHERE id = ?').bind(productId).first('active')).toBe(1)
      expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM audit_logs').first('total')).toBe(0)
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_audit').run()
    }
  })

  it('falha da atualização reverte a auditoria do mesmo lote', async () => {
    await env.DB.prepare("CREATE TRIGGER fail_moderation BEFORE UPDATE OF active ON products BEGIN SELECT RAISE(ABORT, 'forced product failure'); END").run()
    try {
      expect((await moderate()).status).toBe(500)
      expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM audit_logs').first('total')).toBe(0)
      expect(await env.DB.prepare('SELECT active FROM products WHERE id = ?').bind(productId).first('active')).toBe(1)
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_moderation').run()
    }
  })

  it('pagina e filtra na consulta com total filtrado e ordem estável', async () => {
    for (let i = 0; i < 23; i++) {
      await env.DB.prepare('INSERT INTO audit_logs (id, actor_id, actor_role, target_type, target_id, action, reason, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 'admin-1', 'admin', i === 22 ? 'user' : 'product', productId, 'product.deactivated', 'Motivo de teste', 'req-test', '2026-09-21T12:00:00.000Z').run()
    }
    const getPage = async (page: number) => {
      const response = await createTestApp().fetch(new Request(`http://localhost/admin/audit-logs?targetType=product&targetId=${productId}&action=product.deactivated&page=${page}&limit=20`, { headers: { Authorization: 'Bearer admin' } }), env)
      expect(response.status).toBe(200)
      return response.json() as Promise<{ total: number; logs: Array<{ id: string }> }>
    }
    const first = await getPage(1)
    const second = await getPage(2)
    expect(first.total).toBe(22)
    expect(second.total).toBe(22)
    expect(first.logs).toHaveLength(20)
    expect(second.logs).toHaveLength(2)
    expect(new Set([...first.logs, ...second.logs].map(log => log.id)).size).toBe(22)
    expect((await getPage(3)).logs).toHaveLength(0)
  })

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
    const logs = await logsResponse.json() as { logs: Array<{ targetId: string; requestId: string; reason: string; metadata: { oldActive: boolean; newActive: boolean } }> }
    const log = logs.logs.find((entry) => entry.targetId === productId)
    expect(log?.requestId).toBe(requestId)
    expect(log?.reason).toBe('Produto fora da política')
    expect(log?.metadata).toEqual({ oldActive: true, newActive: false })
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
    expect(row?.active).toBe(1)
  })
})
