import type { CartItem } from '@/lib/domain/cart'

export const CART_KEY = 'fl.cart.v2'
export interface CartSnapshot { version: 2; items: CartItem[]; receipts: string[] }
export const emptyCart = (): CartSnapshot => ({ version: 2, items: [], receipts: [] })

export function validCartItems(value: unknown): value is CartItem[] {
  return Array.isArray(value) && value.every(item => item &&
    ['productId', 'productName', 'supplierId', 'supplierName'].every(key => typeof item[key] === 'string' && item[key].trim()) &&
    Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
    Number.isSafeInteger(item.unitPrice) && item.unitPrice > 0 &&
    Number.isSafeInteger(item.quantity * item.unitPrice) && ['un', 'cx', 'kg'].includes(item.unit)) &&
    Number.isSafeInteger(value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
}
export function readCart(storage: Storage): CartSnapshot {
  const raw = storage.getItem(CART_KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed.version !== 2 || !validCartItems(parsed.items) || !Array.isArray(parsed.receipts) ||
        !parsed.receipts.every((id: unknown) => typeof id === 'string')) throw new Error('Sacola inválida.')
    return parsed
  }
  const legacy = storage.getItem('fl.cart.v1')
  const items: unknown = legacy ? JSON.parse(legacy) : []
  if (!validCartItems(items)) throw new Error('Sacola inválida.')
  return { version: 2, items, receipts: [] }
}
export function writeCart(storage: Storage, snapshot: CartSnapshot) {
  storage.setItem(CART_KEY, JSON.stringify(snapshot))
  // Items and purchase acknowledgements commit in one envelope; v2 is authoritative.
  try { storage.removeItem('fl.cart.v1') } catch { /* v2 has already committed */ }
}
export function acknowledgeCart(snapshot: CartSnapshot, receipt: string,
  lines: { productId: string; supplierId: string; quantity: number }[]): CartSnapshot {
  if (snapshot.receipts.includes(receipt)) return snapshot
  const items = snapshot.items.map(item => {
    const quantity = lines.filter(line => line.productId === item.productId && line.supplierId === item.supplierId)
      .reduce((sum, line) => sum + line.quantity, 0)
    return { ...item, quantity: Math.max(0, item.quantity - quantity) }
  }).filter(item => item.quantity > 0)
  return { version: 2, items, receipts: [...snapshot.receipts, receipt] }
}
