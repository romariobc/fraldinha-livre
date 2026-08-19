import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env, AppContext } from '../env'
import {
  ProductSchema,
  CreateProductRequestSchema,
  UpdateProductRequestSchema,
} from '../../../packages/contracts/src/product'
import { ZodError } from 'zod'

function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`
}

// GET /products — publico, so active=true (RN-007-04).
// GET /products?scope=fornecedor — autenticado (uid do middleware condicional em index.ts),
// retorna TODOS os produtos do uid (ativos + inativos), sem filtro de active.
// Drizzle/D1 retorna `null` para a coluna nullable `badge`; o contrato (ProductSchema)
// usa `z.string().optional()`, que aceita `undefined` mas rejeita `null` explicito.
// Mesma normalizacao ja aplicada em POST/PUT (C4) — aqui faltava, e so aparece com
// dados reais que tem produtos sem badge (a maioria do seed backfillado, D-031).
function normalizeProduct<T extends { badge: string | null; imageUrl?: string | null }>(
  row: T
): Omit<T, 'badge' | 'imageUrl'> & { badge?: string; imageUrl?: string } {
  return {
    ...row,
    badge: row.badge ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
  }
}

export const productsGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope')

  if (scope === 'admin') {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    if (uid !== c.env.ADMIN_UID) {
      return c.json({ error: 'forbidden' }, 403)
    }
    const rows = await db.select().from(products).all()
    return c.json(rows.map(normalizeProduct))
  }

  if (scope === 'fornecedor') {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const rows = await db.select().from(products).where(eq(products.supplierId, uid)).all()
    return c.json(rows.map(normalizeProduct))
  }

  const rows = await db.select().from(products).where(eq(products.active, true)).all()
  return c.json(rows.map(normalizeProduct))
}

// POST /products — cria produto do fornecedor autenticado. supplierId/active/id sempre
// definidos pelo servidor (RN-007-01/08) — nunca vem do body (CreateProductRequestSchema
// ja os omite via .omit(), Zod descarta silenciosamente se vierem no body).
export const productsPostHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const supplierEmail = c.get('email')

  try {
    const body = await c.req.json()
    const createRequest = CreateProductRequestSchema.parse(body)

    const db = drizzle(c.env.DB)
    const id = generateUUID()

    await db.insert(products).values({
      id,
      supplierId: uid,
      supplierEmail,
      active: true,
      priceCents: createRequest.priceCents,
      name: createRequest.name,
      brand: createRequest.brand,
      size: createRequest.size,
      quantity: createRequest.quantity,
      slug: createRequest.slug,
      categoria: createRequest.categoria,
      descricao: createRequest.descricao,
      atributos: createRequest.atributos,
      badge: createRequest.badge,
      imageUrl: createRequest.imageUrl,
    })

    const savedRows = await db.select().from(products).where(eq(products.id, id)).all()
    const saved = savedRows[0]
    const validated = ProductSchema.parse({
      ...saved,
      badge: saved.badge ?? undefined,
      imageUrl: saved.imageUrl ?? undefined,
    })
    return c.json(validated, 201)
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    throw error
  }
}

// PUT /products/:id — edita produto existente (inclui despublicar/republicar via `active`).
// Autorizacao por dono: 404 se nao existe, 403 se existe mas nao e do uid (nunca o contrario).
export const productsPutHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const id = c.req.param('id') as string
  const db = drizzle(c.env.DB)

  const existingRows = await db.select().from(products).where(eq(products.id, id)).all()
  if (existingRows.length === 0) {
    return c.json({ error: 'product not found' }, 404)
  }
  if (existingRows[0].supplierId !== uid) {
    return c.json({ error: 'forbidden' }, 403)
  }

  try {
    const body = await c.req.json()
    const updateRequest = UpdateProductRequestSchema.parse(body)

    await db.update(products).set(updateRequest).where(eq(products.id, id))

    const updatedRows = await db.select().from(products).where(eq(products.id, id)).all()
    const updated = updatedRows[0]
    const validated = ProductSchema.parse({
      ...updated,
      badge: updated.badge ?? undefined,
      imageUrl: updated.imageUrl ?? undefined,
    })
    return c.json(validated, 200)
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    throw error
  }
}

// DELETE /products/:id — remocao definitiva (nao e o mesmo que despublicar via active=false).
export const productsDeleteHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const id = c.req.param('id') as string
  const db = drizzle(c.env.DB)

  const existingRows = await db.select().from(products).where(eq(products.id, id)).all()
  if (existingRows.length === 0) {
    return c.json({ error: 'product not found' }, 404)
  }
  if (existingRows[0].supplierId !== uid) {
    return c.json({ error: 'forbidden' }, 403)
  }

  await db.delete(products).where(eq(products.id, id))
  return c.body(null, 204)
}
