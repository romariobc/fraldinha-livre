import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order, CreateOrderRequest } from '@contracts'
import { ApiError } from '@/lib/api-client'
import { acknowledgeCart, readCart, writeCart } from '@/lib/cart-storage'
import { attemptKey, buildAttempt, loadAttempt, saveAttempt, submitCheckout, discardAttempt, type CheckoutInput, type CheckoutLock } from '@/lib/checkout-attempt'

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }))
const a = { productId: 'a', productName: 'Oferta A', supplierId: 'supplier-a', supplierName: 'Fornecedor A', quantity: 2, unitPrice: 100, unit: 'un' as const }
const b = { ...a, productId: 'b', supplierId: 'supplier-b', productName: 'Oferta B' }
const address = { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }
const input = (): CheckoutInput => ({ userId: 'buyer-a', items: [a, b], address, method: 'pix', outcome: 'approved' })
const lock: CheckoutLock = async (_uid, action) => action()
function backend() {
  const orders = new Map<string, Order>()
  const create = vi.fn(async (req: CreateOrderRequest, key = '') => {
    if (!orders.has(key)) orders.set(key, { ...req, id: 'order-' + orders.size, uid: 'buyer-a', status: 'aguardando',
      type: 'compra-direta', createdAt: '2026-11-01T00:00:00Z', paymentMode: 'simulated', paymentStatus: 'approved',
      paymentTransactionId: 'sim-' + key })
    return orders.get(key)!
  })
  return { orders, create }
}
function dependencies(repo = backend()) {
  writeCart(localStorage, { version: 2, items: [a, b], receipts: [] })
  const onConfirmed = vi.fn(group => writeCart(localStorage, acknowledgeCart(readCart(localStorage),
    'buyer-a:' + group.order.id, group.request.items.map((item: typeof a) => ({ ...item, supplierId: group.supplierId })))))
  return { storage: localStorage, repo, lock, onUpdate: vi.fn(), onConfirmed }
}
const failure = (code: 'INSUFFICIENT_STOCK' | 'PAYMENT_DECLINED' | 'UNAUTHORIZED', status = 409) => new ApiError({ code, status, message: code, requestId: 'qa-ref' })

describe('tentativa durável de checkout', () => {
  beforeEach(() => localStorage.clear())
  it('fixa chaves por fornecedor e congela dados antes da rede', () => {
    const source = input(), attempt = buildAttempt(source, 'fixed')
    source.address = { ...address, numero: '99' }
    expect(attempt.groups.map(group => group.key)).toEqual(['fixed:supplier-a', 'fixed:supplier-b'])
    expect(attempt.groups[0].request.deliveryAddress.numero).toBe('1')
    expect(buildAttempt({ ...input(), items: [b] }, 'fixed').groups[0].key).toBe('fixed:supplier-b')
  })
  it('confirma grupos independentes e retira somente as quantidades compradas, uma vez', async () => {
    const repo = backend(), deps = dependencies(repo)
    writeCart(localStorage, { version: 2, items: [{ ...a, quantity: 5 }, b], receipts: [] })
    const result = await submitCheckout(input(), deps)
    expect(result.groups.map(group => group.status)).toEqual(['confirmed', 'confirmed'])
    expect(readCart(localStorage).items).toEqual([{ ...a, quantity: 3 }])
    await submitCheckout(input(), deps)
    expect(repo.create).toHaveBeenCalledTimes(2)
    expect(readCart(localStorage).items[0].quantity).toBe(3)
  })
  it('preserva falha parcial e continua os outros fornecedores', async () => {
    const repo = backend(), original = repo.create.getMockImplementation()!
    repo.create.mockImplementation(async (req, key) => { if (req.supplierId === 'supplier-a') throw failure('INSUFFICIENT_STOCK'); return original(req, key) })
    const result = await submitCheckout(input(), dependencies(repo))
    expect(result.groups.map(group => group.status)).toEqual(['failed', 'confirmed'])
    expect(readCart(localStorage).items).toEqual([a])
    expect(repo.orders.size).toBe(1)
  })
  it('recusa não remove itens nem informa pedidos confirmados', async () => {
    const repo = backend(); repo.create.mockRejectedValue(failure('PAYMENT_DECLINED', 400))
    const result = await submitCheckout({ ...input(), outcome: 'declined' }, dependencies(repo))
    expect(result.groups.every(group => group.status === 'declined')).toBe(true)
    expect(readCart(localStorage).items).toEqual([a, b])
    expect(repo.orders.size).toBe(0)
    expect(() => discardAttempt(localStorage, 'buyer-a')).not.toThrow()
  })
  it('perda da resposta após commit sobrevive à recarga sem duplicar o pedido', async () => {
    const repo = backend(), original = repo.create.getMockImplementation()!
    let lose = true
    repo.create.mockImplementation(async (req, key) => {
      const order = await original(req, key)
      if (req.supplierId === 'supplier-a' && lose) { lose = false; throw new Error('response lost') }
      return order
    })
    const deps = dependencies(repo)
    const first = await submitCheckout(input(), deps)
    expect(first.groups.map(group => group.status)).toEqual(['unknown', 'confirmed'])
    expect(repo.orders.size).toBe(2)
    const restored = loadAttempt(localStorage, 'buyer-a')!
    const retryInput = { ...input(), items: [a], address: { ...address, numero: '99' }, method: 'card' as const }
    const result = await submitCheckout(retryInput, deps)
    expect(result.groups.every(group => group.status === 'confirmed')).toBe(true)
    expect(repo.create.mock.calls[2][1]).toBe(restored.groups[0].key)
    expect(repo.create.mock.calls[2][0]).toEqual(restored.groups[0].request)
    expect(repo.orders.size).toBe(2)
    expect(readCart(localStorage).items).toEqual([])
  })
  it('timeout antes de commit mantém a chave e permite recuperação', async () => {
    const repo = backend(); repo.create.mockImplementationOnce(() => new Promise(() => {}))
    const deps = dependencies(repo)
    const first = await submitCheckout(input(), { ...deps, timeoutMs: 5 })
    expect(first.groups[0].status).toBe('unknown')
    expect(() => discardAttempt(localStorage, 'buyer-a')).toThrow(/desconhecidos/)
    await submitCheckout(input(), deps)
    expect(repo.create.mock.calls[2][1]).toBe(first.groups[0].key)
    expect(repo.orders.size).toBe(2)
  })
  it('persiste o estado desconhecido antes de cada chamada', async () => {
    const repo = backend(), original = repo.create.getMockImplementation()!
    repo.create.mockImplementation(async (req, key) => {
      expect(loadAttempt(localStorage, 'buyer-a')!.groups.find(group => group.key === key)!.status).toBe('unknown')
      return original(req, key)
    })
    await submitCheckout(input(), dependencies(repo))
  })
  it('armazenamento indisponível impede envio de compra nova', async () => {
    const deps = dependencies()
    const storage = { ...localStorage, getItem: () => null, setItem: () => { throw new Error('quota') } } as unknown as Storage
    await expect(submitCheckout(input(), { ...deps, storage })).rejects.toThrow()
    expect(deps.repo.create).not.toHaveBeenCalled()
  })
  it('falha ao salvar resposta já confirmada recupera a mesma chave', async () => {
    const deps = dependencies(), write = localStorage.setItem.bind(localStorage)
    let count = 0
    const storage = { getItem: localStorage.getItem.bind(localStorage), setItem: (key: string, value: string) => {
      if (++count === 3) throw new Error('quota after server commit')
      write(key, value)
    } } as Storage
    await expect(submitCheckout(input(), { ...deps, storage })).rejects.toThrow()
    expect(loadAttempt(localStorage, 'buyer-a')!.groups[0].status).toBe('unknown')
    await submitCheckout(input(), deps)
    expect(deps.repo.orders.size).toBe(2)
  })
  it('falha na conciliação da sacola recupera sem repetir desconto de quantidade', async () => {
    const deps = dependencies()
    deps.onConfirmed.mockImplementationOnce(() => { throw new Error('cart unavailable') })
    await expect(submitCheckout(input(), deps)).rejects.toThrow('cart unavailable')
    expect(loadAttempt(localStorage, 'buyer-a')!.groups[0].status).toBe('confirmed')
    await submitCheckout(input(), deps)
    expect(deps.repo.orders.size).toBe(2)
    expect(readCart(localStorage).items).toEqual([])
  })
  it('duas submissões coordenadas usam uma única tentativa e um pedido por grupo', async () => {
    const deps = dependencies()
    let pending = Promise.resolve()
    const exclusive: CheckoutLock = (_uid, action) => {
      const next = pending.then(action)
      pending = next.then(() => {}, () => {})
      return next
    }
    await Promise.all([submitCheckout(input(), { ...deps, lock: exclusive }), submitCheckout(input(), { ...deps, lock: exclusive })])
    expect(deps.repo.create).toHaveBeenCalledTimes(2)
    expect(deps.repo.orders.size).toBe(2)
  })
  it('troca de conta não usa nem remove a tentativa de outro usuário', () => {
    saveAttempt(localStorage, buildAttempt(input()))
    expect(loadAttempt(localStorage, 'buyer-b')).toBeNull()
    discardAttempt(localStorage, 'buyer-b')
    expect(loadAttempt(localStorage, 'buyer-a')).not.toBeNull()
  })
  it('corrupção não é substituída por tentativa nova', async () => {
    const deps = dependencies()
    localStorage.setItem(attemptKey('buyer-a'), 'invalid-json')
    await expect(submitCheckout(input(), deps)).rejects.toThrow()
    expect(deps.repo.create).not.toHaveBeenCalled()
  })
  it('não aceita como confirmação uma resposta de outra conta ou sem modo simulado', async () => {
    const repo = backend(), original = repo.create.getMockImplementation()!
    repo.create.mockImplementation(async (req, key) => ({ ...await original(req, key), uid: 'buyer-b' }))
    const deps = dependencies(repo), result = await submitCheckout(input(), deps)
    expect(result.groups.every(group => group.status === 'unknown')).toBe(true)
    expect(deps.onConfirmed).not.toHaveBeenCalled()
  })
  it('erro de sessão mantém resultado desconhecido para recuperação', async () => {
    const repo = backend(); repo.create.mockRejectedValue(failure('UNAUTHORIZED', 401))
    const result = await submitCheckout(input(), dependencies(repo))
    expect(result.groups.every(group => group.status === 'unknown')).toBe(true)
  })
  it('rejeição posterior não libera nova chave enquanto uma resposta anterior continua desconhecida', async () => {
    const repo = backend(); repo.create.mockRejectedValueOnce(new Error('lost response'))
    const deps = dependencies(repo)
    await submitCheckout({ ...input(), items: [a] }, deps)
    repo.create.mockRejectedValueOnce(failure('INSUFFICIENT_STOCK'))
    const retry = await submitCheckout(input(), deps)
    expect(retry.groups[0].status).toBe('unknown')
    expect(() => discardAttempt(localStorage, 'buyer-a')).toThrow()
  })
  it.each([{ ...input(), address: { ...address, bairro: ' ' } }, { ...input(), items: [{ ...a, quantity: 1.5 }] },
    { ...input(), items: [{ ...a, unitPrice: 0 }] }])('rejeita entrada inválida antes da rede', data => {
    expect(() => buildAttempt(data)).toThrow()
  })
})
