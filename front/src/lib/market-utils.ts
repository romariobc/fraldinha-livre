import type { MarketOrder, MockSupplier, GeoScope, DeliveryType, SupplierOffer } from './supplier-mock'

export function parsePriceToCents(raw: string): number | null {
  const value = parseFloat(raw.trim().replace(',', '.'))
  if (isNaN(value) || value <= 0) return null
  return Math.round(value * 100)
}

export function geoMatch(order: MarketOrder, supplier: MockSupplier, scope: GeoScope): boolean {
  switch (scope.type) {
    case 'neighborhood':
      return order.buyerNeighborhood === supplier.neighborhood
    case 'radius':
      return (
        order.buyerZip.slice(0, scope.km === 5 ? 3 : 2) ===
        supplier.zip.slice(0, scope.km === 5 ? 3 : 2)
      )
    case 'city':
      return order.buyerCity === scope.city && order.buyerState === scope.state
    case 'national':
      return true
  }
}

export function formatDeliveryType(dt: DeliveryType): string {
  if (dt.kind === 'delivery') return `⚡ Delivery local (até ${dt.maxHours}h)`
  if (dt.kind === 'days') return dt.count === 1 ? `1 dia útil` : `${dt.count} dias úteis`
  return 'A combinar'
}

export function buildOfferSnapshot(
  order: MarketOrder,
  price: number,
  deliveryType: DeliveryType,
  note?: string
): SupplierOffer {
  return {
    id: `sof-${Date.now()}`,
    orderId: order.id,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    buyerName: order.buyerName,
    buyerCity: order.buyerCity,
    buyerState: order.buyerState,
    price,
    deliveryType,
    note,
    status: 'enviada',
    createdAt: new Date().toISOString(),
  }
}
