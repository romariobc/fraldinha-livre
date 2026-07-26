import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env, AppContext } from '../env.d'

// GET /products — publico, so active=true (RN-007-04).
// GET /products?scope=fornecedor — autenticado (uid do middleware condicional em index.ts),
// retorna TODOS os produtos do uid (ativos + inativos), sem filtro de active.
export const productsGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope')

  if (scope === 'fornecedor') {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const rows = await db.select().from(products).where(eq(products.supplierId, uid)).all()
    return c.json(rows)
  }

  const rows = await db.select().from(products).where(eq(products.active, true)).all()
  return c.json(rows)
}
