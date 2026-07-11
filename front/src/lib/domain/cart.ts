import { Money, multiplyMoney, sumMoney } from './money'

/**
 * CartItem represents a single product line in a shopping cart.
 * Tied to compra-direta workflow (direct purchase from a single supplier).
 */
export interface CartItem {
  productId: string
  productName: string
  supplierId: string
  supplierName: string
  unitPrice: Money // in centavos
  quantity: number // integer >= 1
  unit: 'un' | 'cx' | 'kg'
}

/**
 * Calculates the line total: unitPrice × quantity (in centavos).
 * @param item - CartItem to calculate
 * @returns Total for this line in centavos
 */
export function lineTotal(item: CartItem): Money {
  return multiplyMoney(item.unitPrice, item.quantity)
}

/**
 * Calculates the cart subtotal: sum of all line totals (in centavos).
 * @param items - Array of CartItems
 * @returns Sum of all line totals; 0 if array is empty
 */
export function cartSubtotal(items: CartItem[]): Money {
  const lineTotals = items.map(lineTotal)
  return sumMoney(lineTotals)
}

/**
 * Groups CartItems by supplierId (D-017: split per supplier at checkout).
 * @param items - Array of CartItems
 * @returns Map with supplierId as key, array of items as value
 */
export function groupBySupplier(items: CartItem[]): Map<string, CartItem[]> {
  const groups = new Map<string, CartItem[]>()

  for (const item of items) {
    if (!groups.has(item.supplierId)) {
      groups.set(item.supplierId, [])
    }
    const group = groups.get(item.supplierId)!
    group.push(item)
  }

  return groups
}
