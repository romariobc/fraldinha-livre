import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env } from '../env'

// GET /products — catalogo minimo (id/preco/fornecedor), publico. Usado hoje so
// internamente pela validacao de POST /orders; nao tem consumidor no front ainda.
// Serve tambem como superficie de smoke-test operacional (thread P).
export const productsGetHandler = async (c: Context<{ Bindings: Env }>) => {
  const db = drizzle(c.env.DB)
  const rows = await db.select().from(products).all()
  return c.json(rows)
}
