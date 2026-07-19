import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  product: text('product').notNull(),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
  price: integer('price'),
  supplierId: text('supplier_id'),
  supplierName: text('supplier_name'),
  deliveryAddress: text('delivery_address').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  uidIdx: index('idx_orders_uid').on(table.uid),
}))

export const orderItems = sqliteTable('order_items', {
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
})
