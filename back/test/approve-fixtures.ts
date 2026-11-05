import type { Env } from '../src/env'

// Explicit test setup, never imported by application code or migrations.
export async function approveFixtures(db: Env['DB'], ...uids: string[]) {
  for (const uid of uids) {
    await db.prepare(`INSERT INTO supplier_applications (uid, status, created_at, updated_at)
      VALUES (?, 'aprovado', '2026-10-29T00:00:00Z', '2026-10-29T00:00:00Z') ON CONFLICT(uid) DO NOTHING`).bind(uid).run()
  }
}
export const seedSuppliers = ['sup-001', 'sup-002', 'sup-003', 'sup-004']
