import { and, eq, like, or } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/d1'
import { products } from '../../../schema/products'
import type { SearchProductsArgs, GetProductArgs } from './schemas'

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

/**
 * Busca produtos no catálogo aplicando os filtros fornecidos.
 *
 * Nota: quando nenhum filtro além de active=true é fornecido, retorna array
 * vazio — o agente DEVE sempre informar ao menos um campo de busca (brand,
 * size, categoria ou query). Isso impede devolver o catálogo inteiro por engano.
 */
export async function searchProducts(db: ReturnType<typeof drizzle>, args: SearchProductsArgs) {
  const conditions = [eq(products.active, true)]

  if (args.brand) {
    conditions.push(like(products.brand, `%${args.brand}%`))
  }
  if (args.size) {
    // size é EXATO (não substring) — "G" não pode casar com "GG"/"XXG"
    conditions.push(eq(products.size, args.size))
  }
  if (args.categoria) {
    conditions.push(like(products.categoria, `%${args.categoria}%`))
  }
  if (args.query) {
    const term = `%${args.query}%`
    conditions.push(
      or(
        like(products.name, term),
        like(products.brand, term),
        like(products.categoria, term),
        like(products.descricao, term),
      )!,
    )
  }

  // Nenhum filtro além de active=true: não devolve o catálogo inteiro.
  if (conditions.length === 1) {
    return []
  }

  return db.select(SEARCH_COLUMNS).from(products).where(and(...conditions)).all()
}

/**
 * Busca um produto específico pelo ID (apenas ativos).
 * Retorna null se o produto não existe ou está inativo.
 */
export async function getProduct(db: ReturnType<typeof drizzle>, args: GetProductArgs) {
  const rows = await db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(and(eq(products.id, args.productId), eq(products.active, true)))
    .all()
  return rows[0] ?? null
}
