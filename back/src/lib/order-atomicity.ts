import type { CreateOrderRequest } from '../../../packages/contracts/src/order'
import type { Env } from '../env'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, v]) => [key, canonical(v)]))
  }
  return value
}

export async function requestFingerprint(request: CreateOrderRequest): Promise<string> {
  const items = [...request.items].sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)
  const bytes = new TextEncoder().encode(JSON.stringify(canonical({ ...request, items })))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

interface EventInput {
  orderId: string
  mutationId: string
  fromStatus: string | null
  toStatus: string
  actorId: string
  requestId: string | null
  reason: string | null
  stockEffect: 'decrement' | 'restore' | 'none'
  createdAt: string
}

function eventStatement(db: Env['DB'], event: EventInput) {
  return db.prepare(`INSERT INTO order_events
    (id, order_id, mutation_id, from_status, to_status, actor_id, request_id, reason, stock_effect, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM orders WHERE id = ? AND mutation_id = ?)`)
    .bind(crypto.randomUUID(), event.orderId, event.mutationId, event.fromStatus, event.toStatus,
      event.actorId, event.requestId, event.reason, event.stockEffect, event.createdAt,
      event.orderId, event.mutationId)
}

export async function createOrderAtomically(db: Env['DB'], input: {
  orderId: string
  uid: string
  idempotencyKey: string
  fingerprint: string
  request: CreateOrderRequest
  requestId: string | null
  createdAt: string
}): Promise<boolean> {
  const { request: req, orderId } = input
  const mutationId = crypto.randomUUID()
  const values = [orderId, input.uid, 'compra-direta', 'aguardando', req.product, req.quantity, req.unit,
    req.price ?? null, req.supplierId ?? null, req.supplierName ?? null, JSON.stringify(req.deliveryAddress),
    input.createdAt, input.idempotencyKey, req.paymentMethod ?? null, req.paymentTransactionId ?? null,
    req.paymentStatus ?? null, input.fingerprint, mutationId]
  // Guard every item inside the transaction. External prevalidation is only for useful error messages.
  // JSON table expansion keeps the number of bind parameters constant for larger baskets.
  const guard = `EXISTS (SELECT 1 FROM supplier_applications s WHERE s.uid = ? AND s.status = 'aprovado') AND NOT EXISTS (SELECT 1 FROM json_each(?) item
    LEFT JOIN products p ON p.id = json_extract(item.value, '$.productId')
    WHERE p.id IS NULL OR p.active IS NOT 1 OR p.moderation_blocked IS NOT 0 OR p.supplier_id != ?
      OR p.price_cents != json_extract(item.value, '$.unitPrice')
      OR p.quantity < json_extract(item.value, '$.quantity'))`
  const insert = db.prepare(`INSERT INTO orders
    (id, uid, type, status, product, quantity, unit, price, supplier_id, supplier_name,
     delivery_address, created_at, idempotency_key, payment_method, payment_transaction_id,
     payment_status, request_fingerprint, mutation_id)
    SELECT ${values.map(() => '?').join(', ')} WHERE ${guard}`)
    .bind(...values, req.supplierId!, JSON.stringify(req.items), req.supplierId!)
  const statements = [insert]
  for (const item of req.items) {
    statements.push(db.prepare(`INSERT INTO order_items
      (order_id, product_id, product_name, unit_price, quantity, unit)
      SELECT ?, p.id, trim(p.name || ' ' || p.size), ?, ?, ? FROM products p
      WHERE p.id = ? AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND mutation_id = ?)`)
      .bind(orderId, item.unitPrice, item.quantity, item.unit, item.productId, orderId, mutationId))
    statements.push(db.prepare(`UPDATE products SET quantity = quantity - ? WHERE id = ?
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND mutation_id = ?)`)
      .bind(item.quantity, item.productId, orderId, mutationId))
  }
  statements.push(eventStatement(db, {
    orderId, mutationId, fromStatus: null, toStatus: 'aguardando', actorId: input.uid,
    requestId: input.requestId, reason: null, stockEffect: 'decrement', createdAt: input.createdAt,
  }))
  // D1 batch is one transaction: an item/stock/event failure rolls back all preceding statements.
  const results = await db.batch(statements)
  return results[0].meta.changes === 1
}

export async function transitionOrderAtomically(db: Env['DB'], input: {
  orderId: string
  expectedStatus: string
  expectedMutationId: string | null
  targetStatus: string
  actorId: string
  requestId: string | null
  reason?: string
}): Promise<boolean> {
  const mutationId = crypto.randomUUID()
  const cancelling = input.targetStatus === 'cancelado'
  const update = db.prepare(`UPDATE orders SET status = ?, mutation_id = ?
    WHERE id = ? AND status = ? AND mutation_id IS ?
    AND (? = 0 OR NOT EXISTS (
      SELECT 1 FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      WHERE i.order_id = orders.id AND p.id IS NULL))`)
    .bind(input.targetStatus, mutationId, input.orderId, input.expectedStatus, input.expectedMutationId, cancelling ? 1 : 0)
  const statements = [update]
  if (cancelling) {
    statements.push(db.prepare(`UPDATE products SET quantity = quantity + (
      SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id = ? AND i.product_id = products.id)
      WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND mutation_id = ? AND status = 'cancelado')`)
      .bind(input.orderId, input.orderId, input.orderId, mutationId))
  }
  statements.push(eventStatement(db, {
    orderId: input.orderId, mutationId, fromStatus: input.expectedStatus, toStatus: input.targetStatus,
    actorId: input.actorId, requestId: input.requestId, reason: input.reason ?? null,
    stockEffect: cancelling ? 'restore' : 'none', createdAt: new Date().toISOString(),
  }))
  const results = await db.batch(statements)
  return results[0].meta.changes === 1
}
