import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import app from '../src/index'

describe('Worker Hono + D1', () => {
  beforeAll(async () => {
    // Migrations reais lidas de back/migrations/*.sql via readD1Migrations
    // (vitest.config.ts) — nenhuma copia manual de SQL neste arquivo.
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('GET /health returns 200 with { ok: true }', async () => {
    const request = new Request('http://localhost/health')
    const response = await app.fetch(request, env)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
  })

  it('orders table exists after migration', async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
    ).first()

    expect(result).not.toBeNull()
  })

  it('order_items table exists after migration', async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='order_items'"
    ).first()

    expect(result).not.toBeNull()
  })

  it('idx_orders_uid index exists', async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_orders_uid'"
    ).first()

    expect(result).not.toBeNull()
  })
})
