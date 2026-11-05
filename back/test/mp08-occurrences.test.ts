import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { OccurrencesSchema } from '../../packages/contracts/src/occurrence'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware, requireAnyRole } from '../src/middleware/auth'
import { occurrencesGetHandler, occurrencesPostHandler, occurrencesReplyHandler } from '../src/routes/occurrences'
import { AppError, sendAppError } from '../src/lib/errors'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
app.use('*', createAuthMiddleware(async token => { const [role, uid] = token.split(':'); return { uid, role } }))
app.onError((error, c) => { if (error instanceof AppError) return sendAppError(c, error); throw error })
app.get('/orders/:id/occurrences', occurrencesGetHandler)
app.post('/orders/:id/occurrences', occurrencesPostHandler)
app.post('/orders/:id/report', requireAnyRole(['fornecedor']), occurrencesPostHandler)
app.post('/orders/:id/occurrences/:reportId/messages', occurrencesReplyHandler)
const path = (order = 'mp08-order') => '/orders/' + order + '/occurrences'
function send(route: string, token = 'comprador:mp08-buyer', body?: unknown) {
  return app.fetch(new Request('http://localhost' + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env)
}
async function list(token?: string, order?: string) {
  const response = await send(path(order), token)
  expect(response.status).toBe(200)
  return OccurrencesSchema.parse(await response.json())
}
async function open(token = 'comprador:mp08-buyer', order = 'mp08-order') {
  const requestId = crypto.randomUUID()
  const response = await send(path(order), token, { message: 'Problema documentado no pedido', requestId })
  expect(response.status).toBe(201)
  return requestId
}
const reply = (id: string, token: string, version: number, status = 'em_atendimento', requestId = crypto.randomUUID(), message = 'Resposta documentada para atendimento') =>
  send(path() + '/' + id + '/messages', token, { requestId, message, expectedVersion: version, status })

describe('MP-08: ocorrências persistidas e isoladas', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter(m => m.name !== '0016_order_occurrences.sql'))
    for (const [id, supplier] of [['mp08-order', 'mp08-supplier'], ['mp08-legacy-order', null]]) {
      await env.DB.prepare(`INSERT INTO orders (id, uid, type, status, product, quantity, unit, price, supplier_id, delivery_address, created_at) VALUES (?, 'mp08-buyer', 'compra-direta', 'entregue', 'Original', 1, 'un', 100, ?, '{}', '2026-01-01T00:00:00Z')`).bind(id, supplier).run()
    }
    await env.DB.prepare(`INSERT INTO reports (id, order_id, supplier_id, client_id, message, read, created_at) VALUES ('mp08-old', 'mp08-order', 'mp08-supplier', 'mp08-buyer', 'Texto original intacto', 1, '2026-01-02T00:00:00Z')`).run()
    await env.DB.prepare(`INSERT INTO reports (id, order_id, supplier_id, client_id, message, read, created_at) VALUES ('mp08-old-null', 'mp08-legacy-order', 'mp08-supplier', 'mp08-buyer', 'Snapshot antigo', 0, '2026-01-02T00:00:00Z')`).run()
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })
  it('migração conserva ID, texto, autor conhecido, horário e read; não inventa respostas', async () => {
    const original = (await list()).find(r => r.id === 'mp08-old')!
    expect(original).toMatchObject({ legacy: true, status: 'aberta', version: 0, resolvedBy: null, resolvedAt: null })
    expect(original.messages).toEqual([{ id: 'mp08-old', actorId: 'mp08-supplier', actorRole: 'fornecedor', message: 'Texto original intacto', createdAt: '2026-01-02T00:00:00Z', resolution: false }])
    expect(await env.DB.prepare('SELECT read FROM reports WHERE id = ?').bind('mp08-old').first()).toEqual({ read: 1 })
  })
  it('comprador e fornecedor abrem; três papéis leem e respondem; resolução guarda resposta/ator/data sem efeito comercial', async () => {
    const before = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind('mp08-order').first()
    const id = await open()
    await open('fornecedor:mp08-supplier')
    for (const token of ['comprador:mp08-buyer', 'fornecedor:mp08-supplier', 'admin:mp08-admin']) expect((await list(token)).find(r => r.id === id)).toBeDefined()
    expect((await reply(id, 'fornecedor:mp08-supplier', 0)).status).toBe(201)
    expect((await reply(id, 'comprador:mp08-buyer', 1)).status).toBe(201)
    expect((await reply(id, 'admin:mp08-admin', 2, 'resolvida')).status).toBe(201)
    const saved = (await list()).find(r => r.id === id)!
    expect(saved).toMatchObject({ status: 'resolvida', version: 3, resolvedBy: 'mp08-admin' })
    expect(saved.resolvedAt).toBe(saved.messages[3].createdAt)
    expect(saved.messages).toHaveLength(4)
    expect(saved.messages[3]).toMatchObject({ actorId: 'mp08-admin', actorRole: 'admin', resolution: true })
    expect((await reply(id, 'comprador:mp08-buyer', 3)).status).toBe(409)
    expect(await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind('mp08-order').first()).toEqual(before)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM order_events WHERE order_id = ?').bind('mp08-order').first())!.n).toBe(0)
  })
  it('nega terceiros, papéis desconhecidos, admin abrindo e IDs de outro pedido', async () => {
    const id = await open()
    for (const token of ['comprador:other', 'fornecedor:other', 'unknown:mp08-buyer']) {
      expect((await send(path(), token)).status).toBe(403)
      expect((await send(path(), token, { message: 'Tentativa indevida' })).status).toBe(403)
      expect((await reply(id, token, 0)).status).toBe(403)
    }
    expect((await send(path(), 'admin:mp08-admin', { message: 'Tentativa administrativa' })).status).toBe(403)
    expect((await send(path('missing'))).status).toBe(404)
    expect((await send(path('mp08-legacy-order') + '/' + id + '/messages', undefined, { message: 'Resposta indevida', requestId: crypto.randomUUID(), status: 'em_atendimento', expectedVersion: 0 })).status).toBe(404)
  })
  it('rejeita vazios, tamanhos excessivos, resolução sem resposta, reabertura e versão inválida', async () => {
    const id = await open()
    for (const message of ['', '    ', 'x'.repeat(4001)]) expect((await send(path(), undefined, { message })).status).toBe(400)
    for (const body of [{ message: '    ', status: 'resolvida', expectedVersion: 0 }, { message: 'Resposta válida', status: 'aberta', expectedVersion: 0 }, { message: 'Resposta válida', status: 'resolvida', expectedVersion: -1 }]) {
      expect((await send(path() + '/' + id + '/messages', undefined, { ...body, requestId: crypto.randomUUID() })).status).toBe(400)
    }
    expect((await list()).find(r => r.id === id)!.messages).toHaveLength(1)
  })
  it('replays de abertura e resposta não duplicam; conteúdo divergente conflita', async () => {
    const id = crypto.randomUUID(), body = { requestId: id, message: 'Abertura recuperável' }
    expect((await send(path(), undefined, body)).status).toBe(201)
    expect((await send(path(), undefined, body)).status).toBe(200)
    expect((await send(path(), undefined, { ...body, message: 'Texto divergente' })).status).toBe(409)
    const requestId = crypto.randomUUID()
    expect((await reply(id, 'fornecedor:mp08-supplier', 0, 'resolvida', requestId)).status).toBe(201)
    expect((await reply(id, 'fornecedor:mp08-supplier', 0, 'resolvida', requestId)).status).toBe(200)
    expect((await reply(id, 'fornecedor:mp08-supplier', 0, 'resolvida', requestId, 'Outro texto divergente')).status).toBe(409)
    expect((await list()).find(r => r.id === id)!.messages).toHaveLength(2)
  })
  it('duas resoluções concorrentes têm um vencedor, sem mensagem perdedora ou sobrescrita', async () => {
    const id = await open()
    const results = await Promise.all([reply(id, 'fornecedor:mp08-supplier', 0, 'resolvida'), reply(id, 'admin:mp08-admin', 0, 'resolvida')])
    expect(results.map(r => r.status).sort()).toEqual([201, 409])
    const saved = (await list()).find(r => r.id === id)!
    expect(saved.version).toBe(1); expect(saved.messages).toHaveLength(2)
    expect(saved.resolvedBy).toBe(saved.messages[1].actorId)
  })
  it('falha na gravação da mensagem reverte a alteração de estado na mesma transação', async () => {
    const id = await open()
    await env.DB.exec(`CREATE TRIGGER mp08_fail_message BEFORE INSERT ON report_messages BEGIN SELECT RAISE(ABORT, 'forced QA failure'); END;`)
    try { await expect(reply(id, 'admin:mp08-admin', 0, 'resolvida')).rejects.toThrow() }
    finally { await env.DB.exec('DROP TRIGGER mp08_fail_message') }
    const saved = (await list()).find(r => r.id === id)!
    expect(saved).toMatchObject({ status: 'aberta', version: 0, resolvedAt: null, resolvedBy: null })
    expect(saved.messages).toHaveLength(1)
  })
  it('endpoint antigo preserva contrato e converte novos envios em ocorrências consultáveis', async () => {
    const response = await send('/orders/mp08-order/report', 'fornecedor:mp08-supplier', { message: 'Mensagem do consumidor legado' })
    expect(response.status).toBe(201)
    const receipt = await response.json() as { success: boolean; reportId: string }
    expect(receipt.success).toBe(true)
    expect((await list()).find(r => r.id === receipt.reportId)!.messages[0].actorRole).toBe('fornecedor')
  })
  it('snapshot antigo permite atendimento, sem atribuir novo fornecedor pelo catálogo atual', async () => {
    expect((await list('fornecedor:mp08-supplier', 'mp08-legacy-order'))[0].id).toBe('mp08-old-null')
    expect((await send(path('mp08-legacy-order'), 'fornecedor:other')).status).toBe(403)
    expect((await send(path('mp08-legacy-order'), undefined, { message: 'Nova abertura sem vínculo' })).status).toBe(409)
    expect((await send(path('mp08-legacy-order') + '/mp08-old-null/messages', 'fornecedor:mp08-supplier', { message: 'Resposta para registro anterior', expectedVersion: 0, status: 'em_atendimento', requestId: crypto.randomUUID() })).status).toBe(201)
  })
})
