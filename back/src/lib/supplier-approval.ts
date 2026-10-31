import type { Env } from '../env'

export async function isSupplierApproved(db: Env['DB'], uid: string): Promise<boolean> {
  const row = await db.prepare("SELECT uid FROM supplier_applications WHERE uid = ? AND status = 'aprovado'").bind(uid).first()
  return row !== null
}
