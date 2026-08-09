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

export interface SearchProductsParams {
  // Texto livre — casa contra name/brand/categoria/descricao (achado real,
  // 2026-08-03: uma frase composta como "Pampers tamanho G" nao bate em
  // nenhum campo unico, mesmo o produto existindo — por isso brand/size sao
  // campos SEPARADOS abaixo, nao depende mais de tudo estar na mesma frase).
  query?: string
  brand?: string // substring, ex: "Pampers" bate em "Pampers"
  size?: string // EXATO (nao substring) — "G" nao pode casar com "GG"/"XXG"
  categoria?: string
}

export async function searchProducts(db: ReturnType<typeof drizzle>, params: SearchProductsParams) {
  const conditions = [eq(products.active, true)]

  if (params.brand) {
    conditions.push(like(products.brand, `%${params.brand}%`))
  }
  if (params.size) {
    conditions.push(eq(products.size, params.size))
  }
  if (params.categoria) {
    conditions.push(like(products.categoria, `%${params.categoria}%`))
  }
  if (params.query) {
    const term = `%${params.query}%`
    conditions.push(
      or(
        like(products.name, term),
        like(products.brand, term),
        like(products.categoria, term),
        like(products.descricao, term),
      )!,
    )
  }

  // Nenhum filtro alem de active=true: nao devolve o catalogo inteiro por
  // engano, devolve vazio — o agente deve sempre informar pelo menos um campo.
  if (conditions.length === 1) {
    return []
  }

  return db.select(SEARCH_COLUMNS).from(products).where(and(...conditions)).all()
}

export async function getProduct(db: ReturnType<typeof drizzle>, productId: string) {
  const rows = await db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(and(eq(products.id, productId), eq(products.active, true)))
    .all()
  return rows[0] ?? null
}
