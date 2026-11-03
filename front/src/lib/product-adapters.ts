import type { Product as ContractProduct } from '@contracts'
import type { Product as CatalogProduct } from '@/lib/products'

// HTTP uses priceCents. Existing catalog screens use priceInCents at this single boundary.
export function contractProductToCatalogProduct(p: ContractProduct): CatalogProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    size: p.size,
    quantity: p.quantity,
    priceInCents: p.priceCents,
    oldPriceCents: p.oldPriceCents ?? undefined,
    supplierId: p.supplierId,
    slug: p.slug,
    categoria: p.categoria,
    descricao: p.descricao,
    atributos: p.atributos,
    badge: p.badge,
    imageUrl: p.imageUrl,
  }
}
