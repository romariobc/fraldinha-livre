import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider } from '@/contexts/cart-context'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'
import { useAuth } from '@/contexts/auth-context'
import { ApiError } from '@/lib/api-client'
import { attemptKey, buildAttempt, saveAttempt } from '@/lib/checkout-attempt'
import { readCart } from '@/lib/cart-storage'
import type { CreateOrderRequest } from '@contracts'
import CheckoutPage from '../page'

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), updateProfile: vi.fn() }))
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/contexts/orders-context', () => ({ useOrders: () => ({ refreshOrders: mocks.refresh }) }))
vi.mock('@/contexts/products-context', () => ({ useProducts: () => ({ products: [], loading: false }) }))
vi.mock('@/lib/adapters/http-order-repository', () => ({ HttpOrderRepository: class { create = mocks.create } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), useSearchParams: () => new URLSearchParams() }))
const address = { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }
const a = { productId: 'a', productName: 'Oferta A', supplierId: 'supplier-a', supplierName: 'Fornecedor A', quantity: 2, unitPrice: 100, unit: 'un' as const }
const b = { ...a, productId: 'b', supplierId: 'supplier-b', productName: 'Oferta B' }
const receipt = (req: CreateOrderRequest, key: string) => ({ ...req, uid: 'buyer-a', id: 'order-' + key, type: 'compra-direta',
  status: 'aguardando', createdAt: '2026-11-01T00:00:00Z', paymentMode: 'simulated', paymentStatus: 'approved', paymentTransactionId: 'sim-' + key })
function renderCheckout(items = [a, b]) {
  if (!localStorage.getItem('fl.cart.v2')) localStorage.setItem('fl.cart.v1', JSON.stringify(items))
  return render(<CartProvider><RoleProtectedRoute allowedRoles={['comprador']}><CheckoutPage /></RoleProtectedRoute></CartProvider>)
}
async function paymentStep() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Continuar' }))
  expect(screen.getByText(/Oferta A/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  return user
}
describe('Checkout integrado com tentativa durável', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks()
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, work: () => Promise<unknown>) => work() } })
    vi.mocked(useAuth).mockReturnValue({ user: { uid: 'buyer-a' }, profile: { address }, role: 'comprador', loading: false,
      updateProfile: mocks.updateProfile } as unknown as ReturnType<typeof useAuth>)
    mocks.create.mockImplementation(async (req: CreateOrderRequest, key: string) => {
      if (req.simulationOutcome === 'declined') throw new ApiError({ code: 'PAYMENT_DECLINED', status: 400, message: 'Recusado pelo simulador.', requestId: 'qa' })
      return receipt(req, key)
    })
  })
  it('mantém a guarda de login e não envia sem comprador', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, role: null, loading: false } as ReturnType<typeof useAuth>)
    renderCheckout()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/login'))
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('endereço incompleto bloqueia revisão; nenhum endereço fictício é usado', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { uid: 'buyer-a' }, profile: null, role: 'comprador', loading: false } as ReturnType<typeof useAuth>)
    renderCheckout()
    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('endereço alternativo exige bairro e CEP válido', async () => {
    renderCheckout(); const user = userEvent.setup()
    await user.click(await screen.findByText('Outro endereço'))
    for (const [placeholder, value] of [['Logradouro *', 'Rua Nova'], ['Número *', '2'], ['Cidade *', 'Fortaleza'], ['UF (ex: SP) *', 'CE'], ['CEP *', '60000-000']]) {
      await user.type(screen.getByPlaceholderText(placeholder), value)
    }
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Bairro *'), 'Centro')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })
  it('aprova em servidor, confirma por fornecedor e concilia sem gravar perfil remoto', async () => {
    renderCheckout(); const user = await paymentStep()
    expect(screen.queryByLabelText(/número.*cartão/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pending|pendente/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }))
    await screen.findByText('Pedidos registrados')
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(readCart(localStorage).items).toEqual([])
    expect(readCart(localStorage).receipts).toHaveLength(2)
    expect(mocks.updateProfile).not.toHaveBeenCalled()
    expect(screen.getAllByText('Nenhum valor foi cobrado.')).toHaveLength(2)
  })
  it('clique duplo no mesmo evento não duplica os envios', async () => {
    renderCheckout(); await paymentStep()
    const button = screen.getByRole('button', { name: 'Confirmar compra simulada' })
    fireEvent.click(button); fireEvent.click(button)
    await screen.findByText('Pedidos registrados')
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })
  it('recusa preserva sacola e permite nova tentativa explícita', async () => {
    renderCheckout(); const user = await paymentStep()
    await user.click(screen.getByText('Recusar simulação'))
    await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }))
    await waitFor(() => expect(screen.getAllByText('Simulação recusada')).toHaveLength(2))
    expect(readCart(localStorage).items).toEqual([a, b])
    await user.click(screen.getByRole('button', { name: 'Revisar sacola para nova tentativa' }))
    expect(localStorage.getItem(attemptKey('buyer-a'))).toBeNull()
    expect(mocks.push).toHaveBeenCalledWith('/sacola')
  })
  it('mostra sucesso parcial, preserva pendência e recupera com as mesmas chaves após remontar', async () => {
    let fail = true
    mocks.create.mockImplementation(async (req: CreateOrderRequest, key: string) => {
      if (req.supplierId === 'supplier-b' && fail) { fail = false; throw new Error('timeout') }
      return receipt(req, key)
    })
    const view = renderCheckout(); const user = await paymentStep()
    await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }))
    await screen.findByText('Resultado desconhecido')
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith({ refreshSession: false }))
    expect(within(screen.getByRole('region', { name: 'Fornecedor supplier-a' })).getByText('Pedido registrado')).toBeInTheDocument()
    expect(readCart(localStorage).items).toEqual([b])
    const key = mocks.create.mock.calls[1][1]
    view.unmount(); renderCheckout([])
    await user.click(await screen.findByRole('button', { name: 'Recuperar tentativa' }))
    await screen.findByText('Pedidos registrados')
    expect(mocks.create.mock.calls[2][1]).toBe(key)
    expect(mocks.create).toHaveBeenCalledTimes(3)
    expect(readCart(localStorage).items).toEqual([])
  })
  it('recuperação aparece mesmo com sacola vazia', async () => {
    const attempt = buildAttempt({ userId: 'buyer-a', items: [a], address, method: 'pix', outcome: 'approved' })
    attempt.groups[0].status = 'unknown'; saveAttempt(localStorage, attempt)
    renderCheckout([])
    expect(await screen.findByRole('button', { name: 'Recuperar tentativa' })).toBeEnabled()
    expect(screen.queryByText('Sua sacola está vazia')).not.toBeInTheDocument()
  })
  it('sem proteção de concorrência não envia compra nova', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    renderCheckout(); const user = await paymentStep()
    await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }))
    await screen.findByRole('alert')
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('troca de conta com armazenamento corrompido não exibe a tentativa da conta anterior', async () => {
    const attempt = buildAttempt({ userId: 'buyer-a', items: [a], address, method: 'pix', outcome: 'approved' })
    saveAttempt(localStorage, attempt)
    const view = renderCheckout()
    await screen.findByRole('button', { name: 'Recuperar tentativa' })
    localStorage.setItem(attemptKey('buyer-b'), 'invalid-json')
    vi.mocked(useAuth).mockReturnValue({ user: { uid: 'buyer-b' }, profile: { address }, role: 'comprador', loading: false } as unknown as ReturnType<typeof useAuth>)
    view.rerender(<CartProvider><RoleProtectedRoute allowedRoles={['comprador']}><CheckoutPage /></RoleProtectedRoute></CartProvider>)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Recuperar tentativa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Fornecedor supplier-a' })).not.toBeInTheDocument()
  })
})
