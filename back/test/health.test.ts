import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import app from '../src/index'

const migrations = [
  `CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY NOT NULL, uid text NOT NULL, type text NOT NULL, status text NOT NULL, product text NOT NULL, quantity integer NOT NULL, unit text NOT NULL, price integer, supplier_id text, supplier_name text, delivery_address text NOT NULL, created_at text NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS order_items (order_id text NOT NULL, product_id text NOT NULL, product_name text NOT NULL, unit_price integer NOT NULL, quantity integer NOT NULL, unit text NOT NULL, FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE no action ON DELETE no action);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders (uid);`,
]

describe('Worker Hono + D1', () => {
  beforeEach(async () => {
    // Apply migrations before each test
    for (const query of migrations) {
      await env.DB.exec(query)
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
