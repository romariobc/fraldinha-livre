import { it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'

it('0014 preserva última decisão administrativa sem bloquear despublicação própria', async () => {
  const before = env.TEST_MIGRATIONS.filter(m => !m.name.includes('0014'))
  const migration = env.TEST_MIGRATIONS.filter(m => m.name.includes('0014'))
  expect(migration).toHaveLength(1)
  await applyD1Migrations(env.DB, before)
  for (const id of ['legacy-blocked', 'legacy-released', 'own-inactive']) {
    await env.DB.prepare('INSERT INTO products (id, price_cents, supplier_id, quantity, active) VALUES (?, 100, ?, 10, ?)')
      .bind(id, 'supplier-migration', id === 'own-inactive' ? 0 : 1).run()
  }
  for (const [id, action] of [['legacy-blocked', 'product.deactivated'],
    ['legacy-released', 'product.deactivated'], ['legacy-released', 'product.activated']]) {
    await env.DB.prepare(`INSERT INTO audit_logs (id, actor_id, actor_role, target_type, target_id, action, reason, metadata, request_id, created_at)
      VALUES (?, 'admin', 'admin', 'product', ?, ?, 'QA migration', '{}', 'QA migration', '2026-10-31T00:00:00Z')`)
      .bind(crypto.randomUUID(), id, action).run()
  }
  await applyD1Migrations(env.DB, migration)
  expect(await env.DB.prepare('SELECT moderation_blocked FROM products WHERE id = ?').bind('legacy-blocked').first()).toMatchObject({ moderation_blocked: 1 })
  for (const id of ['legacy-released', 'own-inactive']) {
    expect(await env.DB.prepare('SELECT moderation_blocked FROM products WHERE id = ?').bind(id).first()).toMatchObject({ moderation_blocked: 0 })
  }
})
