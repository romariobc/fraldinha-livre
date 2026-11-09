import { CheckoutAddressSchema, CreateOrderRequestSchema, OrderSchema, type Address, type CreateOrderRequest, type Order } from '@contracts'
import type { CartItem } from '@/lib/domain/cart'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { validCartItems } from '@/lib/cart-storage'
import { groupBySupplier } from '@/lib/domain/cart'
import { supplierLabel } from '@/lib/supplier-label'
import { isApiError } from '@/lib/api-client'

export type GroupStatus = 'ready' | 'unknown' | 'confirmed' | 'failed' | 'declined'
export interface CheckoutGroup {
  supplierId: string
  key: string
  request: CreateOrderRequest
  status: GroupStatus
  order?: Order
  error?: string
  requestId?: string
  uncertain?: boolean
}
export interface CheckoutAttempt { version: 1; id: string; userId: string; groups: CheckoutGroup[] }
export interface CheckoutInput {
  userId: string; items: CartItem[]; address: Address
  method: 'pix' | 'card'; outcome: 'approved' | 'declined'
}
export const attemptKey = (uid: string) => 'fl.checkout.v1:' + encodeURIComponent(uid)
const groupKey = (id: string, supplier: string) => id + ':' + encodeURIComponent(supplier)
const storageFailure = () => new Error('Não foi possível salvar a tentativa. Habilite o armazenamento do navegador e recupere esta mesma compra.')

export function loadAttempt(storage: Storage, uid: string): CheckoutAttempt | null {
  let raw: string | null
  try { raw = storage.getItem(attemptKey(uid)) } catch { throw storageFailure() }
  if (!raw) return null
  let value: CheckoutAttempt
  try { value = JSON.parse(raw) as CheckoutAttempt } catch { throw storageFailure() }
  if (!value || value.version !== 1 || value.userId !== uid || typeof value.id !== 'string' || !value.id ||
      !Array.isArray(value.groups) || !value.groups.length) throw storageFailure()
  const seen = new Set<string>()
  for (const group of value.groups) {
    const request = CreateOrderRequestSchema.safeParse(group.request)
    if (!request.success || !group.supplierId || group.supplierId !== request.data.supplierId ||
        group.key !== groupKey(value.id, group.supplierId) || seen.has(group.supplierId) ||
        !['ready', 'unknown', 'confirmed', 'failed', 'declined'].includes(group.status)) throw storageFailure()
    if (group.status === 'confirmed' && (!group.order || !OrderSchema.safeParse(group.order).success || group.order.uid !== uid)) throw storageFailure()
    seen.add(group.supplierId)
  }
  return value
}
export function saveAttempt(storage: Storage, attempt: CheckoutAttempt) {
  const raw = JSON.stringify(attempt)
  try {
    storage.setItem(attemptKey(attempt.userId), raw)
    if (storage.getItem(attemptKey(attempt.userId)) !== raw) throw storageFailure()
  } catch { throw storageFailure() }
}
export function canRestart(attempt: CheckoutAttempt) {
  return attempt.groups.every(group => ['confirmed', 'failed', 'declined'].includes(group.status))
}
export function discardAttempt(storage: Storage, uid: string) {
  const attempt = loadAttempt(storage, uid)
  if (attempt && !canRestart(attempt)) throw new Error('Há resultados ainda desconhecidos. Recupere a tentativa antes de iniciar outra.')
  storage.removeItem(attemptKey(uid))
}
export function buildAttempt(input: CheckoutInput, id = 'mp05-' + crypto.randomUUID()): CheckoutAttempt {
  if (!input.userId || !input.items.length || !validCartItems(input.items) || !CheckoutAddressSchema.safeParse(input.address).success) {
    throw new Error('Confira os itens da sacola e informe um endereço completo, com bairro, UF e CEP.')
  }
  const groups = [...groupBySupplier(input.items)].map(([supplierId, items]) => {
    const request = CreateOrderRequestSchema.parse({
      product: items.length === 1 ? items[0].productName : items.length + ' itens',
      quantity: items.reduce((sum, item) => sum + item.quantity, 0), unit: 'un',
      price: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      supplierId, supplierName: supplierLabel(supplierId), deliveryAddress: input.address,
      items: items.map(({ productId, productName, unitPrice, quantity, unit }) => ({ productId, productName, unitPrice, quantity, unit })),
      paymentMethod: input.method, simulationOutcome: input.outcome,
    })
    return { supplierId, key: groupKey(id, supplierId), request, status: 'ready' as const }
  })
  // Freeze the input, including address, before any network operation.
  return JSON.parse(JSON.stringify({ version: 1, id, userId: input.userId, groups })) as CheckoutAttempt
}

export type CheckoutLock = <T>(uid: string, action: () => Promise<T>) => Promise<T>
export const browserCheckoutLock: CheckoutLock = async (uid, action) => {
  if (!navigator.locks?.request) throw new Error('Não foi possível proteger a recuperação neste navegador. Use um navegador com armazenamento e proteção de compras disponíveis.')
  return navigator.locks.request(attemptKey(uid), action)
}
function serverFailure(error: unknown) {
  let cause = error
  for (let depth = 0; depth < 6 && cause; depth++) {
    if (isApiError(cause)) {
      const status: GroupStatus = cause.code === 'PAYMENT_DECLINED' ? 'declined' :
        cause.status >= 500 || [401, 403, 404, 408, 429].includes(cause.status) || cause.code === 'IDEMPOTENCY_CONFLICT' ? 'unknown' : 'failed'
      return { status, error: cause.message, requestId: cause.requestId }
    }
    cause = cause instanceof Error ? cause.cause : undefined
  }
  return { status: 'unknown' as const, error: 'O resultado ainda é desconhecido. Recupere esta tentativa para conferir o pedido, sem criar uma compra duplicada.' }
}
async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tempo de resposta excedido.')), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}
function verifyReceipt(raw: Order, group: CheckoutGroup, uid: string) {
  const order = OrderSchema.parse(raw)
  if (order.uid !== uid || order.supplierId !== group.supplierId || order.paymentMode !== 'simulated' ||
      order.paymentStatus !== 'approved' || !order.paymentTransactionId?.startsWith('sim-') ||
      order.price !== group.request.price || order.items.length !== group.request.items.length ||
      !group.request.items.every(item => order.items.some(saved => saved.productId === item.productId &&
        saved.quantity === item.quantity && saved.unitPrice === item.unitPrice))) throw new Error('Resposta não confirmada pelo servidor.')
  return order
}
interface Dependencies {
  storage: Storage; repo: Pick<OrderRepository, 'create'>; lock: CheckoutLock; timeoutMs?: number
  onUpdate(attempt: CheckoutAttempt): void
  onConfirmed(group: CheckoutGroup): void
}
export async function submitCheckout(input: CheckoutInput, deps: Dependencies): Promise<CheckoutAttempt> {
  return deps.lock(input.userId, async () => {
    const attempt = loadAttempt(deps.storage, input.userId) ?? buildAttempt(input)
    saveAttempt(deps.storage, attempt)
    deps.onUpdate(structuredClone(attempt))
    for (const group of attempt.groups) {
      if (group.status === 'confirmed') { deps.onConfirmed(group); continue }
      const previouslyUnknown = group.uncertain || group.status === 'unknown'
      group.status = 'unknown'
      group.error = undefined
      saveAttempt(deps.storage, attempt) // durable key before request, even if the tab closes
      deps.onUpdate(structuredClone(attempt))
      let order: Order
      try { order = verifyReceipt(await bounded(deps.repo.create(group.request, group.key), deps.timeoutMs ?? 15000), group, input.userId) }
      catch (error) {
        const failure = serverFailure(error)
        // An earlier timed-out request may still be in flight. A later catalog
        // rejection must not authorize a new key while that request is unresolved.
        if (failure.status === 'unknown' || (previouslyUnknown && group.request.simulationOutcome !== 'declined')) {
          group.uncertain = true
          failure.status = 'unknown'
        }
        Object.assign(group, failure)
        saveAttempt(deps.storage, attempt)
        deps.onUpdate(structuredClone(attempt))
        continue
      }
      group.order = order
      group.status = 'confirmed'
      group.uncertain = false
      group.error = undefined
      group.requestId = undefined
      saveAttempt(deps.storage, attempt)
      deps.onUpdate(structuredClone(attempt))
      // A local acknowledgement failure never turns an existing order into a new purchase.
      deps.onConfirmed(group)
    }
    return attempt
  })
}
