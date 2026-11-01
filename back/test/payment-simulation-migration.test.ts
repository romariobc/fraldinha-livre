import { it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'

it('0015 preserva metadados legados sem atribuir origem de servidor retroativamente', async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter(m => parseInt(m.name, 10) < 15))
  await env.DB.prepare(`INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at,
    payment_method, payment_transaction_id, payment_status) VALUES ('legacy-mode', 'buyer-a', 'compra-direta', 'aguardando', 'Legado', 1, 'un', '{}', '2026-10-01', 'pix', 'client-generated', 'approved')`).run()
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter(m => m.name.includes('0015')))
  expect(await env.DB.prepare('SELECT payment_mode, payment_status, payment_transaction_id FROM orders WHERE id = ?').bind('legacy-mode').first())
    .toMatchObject({ payment_mode: null, payment_status: 'approved', payment_transaction_id: 'client-generated' })
})
