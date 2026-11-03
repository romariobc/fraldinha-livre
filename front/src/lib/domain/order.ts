import type { OrderItem as ContractOrderItem } from '@contracts'
import type { Address } from '@/lib/domain/account'
import { Money } from './money'
import { CartItem, cartSubtotal, groupBySupplier } from './cart'

/**
 * OrderItem represents a single product line in a materialized order.
 * D-018: The building block of a DomainOrder.
 */
export type OrderItem = ContractOrderItem

/**
 * DomainOrder represents a purchase order for a single supplier (D-017).
 * This cart materialization is converted to account/supplier projections by order-adapters.ts.
 *
 * Persisted HTTP order and line fields are defined in @contracts.
 */
export interface DomainOrder {
  id: string
  supplierId: string
  supplierName: string
  items: OrderItem[]
  total: Money // in centavos, sum of all line totals
  deliveryAddress: Address
  createdAt: string // ISO 8601
}

/**
 * Builds an array of DomainOrder from cart items, grouped by supplier.
 *
 * D-017: Each supplier gets exactly one DomainOrder.
 * Injection of idFactory and now allows pure, deterministic testing.
 *
 * @param items - CartItems to convert to orders
 * @param address - Delivery address for all orders
 * @param idFactory - Function that returns a unique order ID on each call
 * @param now - ISO 8601 timestamp string for createdAt
 * @returns Array of DomainOrder, one per supplier; empty array if items is empty
 */
export function buildOrdersFromCart(
  items: CartItem[],
  address: Address,
  idFactory: () => string,
  now: string
): DomainOrder[] {
  // Empty cart → no orders
  if (items.length === 0) {
    return []
  }

  const groupedBySupplier = groupBySupplier(items)
  const orders: DomainOrder[] = []

  for (const [supplierId, supplierItems] of groupedBySupplier) {
    // All items in this group have the same supplier info
    const firstItem = supplierItems[0]

    // Convert CartItem[] to OrderItem[]
    const orderItems: OrderItem[] = supplierItems.map((cartItem) => ({
      productId: cartItem.productId,
      productName: cartItem.productName,
      unitPrice: cartItem.unitPrice,
      quantity: cartItem.quantity,
      unit: cartItem.unit,
    }))

    // Calculate total for this supplier's order
    const total = cartSubtotal(supplierItems)

    const order: DomainOrder = {
      id: idFactory(),
      supplierId,
      supplierName: firstItem.supplierName,
      items: orderItems,
      total,
      deliveryAddress: address,
      createdAt: now,
    }

    orders.push(order)
  }

  return orders
}
