import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  priceCents: integer('price_cents').notNull(),
  oldPriceCents: integer('old_price_cents'),
  supplierId: text('supplier_id').notNull(),
  name: text('name').notNull().default(''),
  brand: text('brand').notNull().default(''),
  size: text('size').notNull().default(''),
  quantity: integer('quantity').notNull().default(0),
  slug: text('slug').notNull().default(''),
  categoria: text('categoria').notNull().default(''),
  descricao: text('descricao').notNull().default(''),
  atributos: text('atributos', { mode: 'json' }).notNull().default('{}'),
  badge: text('badge'),
  supplierEmail: text('supplier_email'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  imageUrl: text('image_url'),
})
