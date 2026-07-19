import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { migrations } from '../src/migrations-config'
import app from '../src/index'

describe('Worker Hono + D1', () => {
  beforeEach(async () => {
    // Reset the test environment to clear any previous data
    try {
      const { reset } = await import('cloudflare:test')
      await reset()
    } catch {
      // If reset is not available, manually clear tables
      await env.DB.exec('DROP TABLE IF EXISTS `order_items`')
      await env.DB.exec('DROP TABLE IF EXISTS `orders`')
    }

    // Apply migrations from the real migration file
    for (const migration of migrations) {
      for (const query of migration.queries) {
        await env.DB.exec(query)
      }
    }
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
