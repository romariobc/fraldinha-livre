import { and, eq, like, or } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/d1'
import { products } from '../schema/products'

const SEARCH_COLUMNS = {
  id: products.id,
  name: products.name,
  brand: products.brand,
  size: products.size,
  priceCents: products.priceCents,
  categoria: products.categoria,
  descricao: products.descricao,
  quantity: products.quantity,
}

export async function searchProducts(db: ReturnType<typeof drizzle>, query: string) {
  const term = `%${query}%`
  return db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(
      and(
        eq(products.active, true),
        or(like(products.name, term), like(products.brand, term), like(products.categoria, term)),
      ),
    )
    .all()
}

export async function getProduct(db: ReturnType<typeof drizzle>, productId: string) {
  const rows = await db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(and(eq(products.id, productId), eq(products.active, true)))
    .all()
  return rows[0] ?? null
}
