import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderTracking from '../OrderTracking'
const identity = vi.hoisted(() => ({ user: { uid: 'buyer-a' } as { uid: string } | null }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => identity }))
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'
const snapshot = { id: 'order-a', uid: 'buyer-a', type: 'compra-direta', status: 'confirmado', product: 'Snapshot original', quantity: 2, unit: 'un', price: 200, supplierId: 'supplier-a', items: [{ productId: 'p-a', productName: 'Snapshot original', unitPrice: 100, quantity: 2, unit: 'un' }], deliveryAddress: { logradouro: 'Rua original', numero: '7', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }, createdAt: '2026-11-02T12:00:00.000Z', paymentMode: 'simulated' }
const recorded = { order: snapshot, historySource: 'complete', events: [{ id: 'e-a', fromStatus: null, toStatus: 'aguardando', actorId: 'buyer-a', reason: null, createdAt: '2026-11-02T12:00:00.000Z' }, { id: 'e-b', fromStatus: 'aguardando', toStatus: 'confirmado', actorId: 'supplier-a', reason: 'Confirmação registrada', createdAt: '2026-11-02T12:01:00.000Z' }] }
const response = (value: unknown) => ({ json: async () => value }) as Response
beforeEach(() => { identity.user = { uid: 'buyer-a' }; vi.mocked(apiFetch).mockReset().mockResolvedValue(response(recorded)) })
describe('shared order tracking', () => {
  it.each(['comprador', 'fornecedor', 'admin'] as const)('renders the same snapshot and persisted events for %s', async scope => {
    render(<OrderTracking orderId="order-a" scope={scope} />)
    await screen.findByText('Estado registrado:')
    expect(apiFetch).toHaveBeenCalledWith('/orders/order-a?scope=' + scope, undefined, 'buyer-a')
    expect(screen.getByText(/Snapshot original × 2/)).toBeInTheDocument()
    expect(screen.getByText(/Ator registrado: supplier-a/)).toBeInTheDocument()
    expect(screen.getByText('Motivo: Confirmação registrada')).toBeInTheDocument()
    expect(screen.getByText(/sem cobrança real/)).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
  })
  it('keeps snapshot/events visible on error and recovers with manual refresh', async () => {
    render(<OrderTracking orderId="order-a" scope="comprador" />)
    await screen.findByText('Estado registrado:')
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acompanhamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('preservados')
    expect(screen.getByText(/Snapshot original × 2/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acompanhamento' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
  it('explicitly describes legacy/partial history without inventing events', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(response({ ...recorded, historySource: 'legacy', events: [], order: { ...snapshot, items: [] } }))
    render(<OrderTracking orderId="order-a" scope="comprador" />)
    await screen.findByText(/Registro legado: não há eventos/)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/resumo legado, sem linhas de itens/)).toBeInTheDocument()
    vi.mocked(apiFetch).mockResolvedValueOnce(response({ ...recorded, historySource: 'partial', events: [recorded.events[1]] }))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acompanhamento' }))
    await screen.findByText(/Histórico parcial/)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
  it('hides the previous account data on logout', async () => {
    const view = render(<OrderTracking orderId="order-a" scope="comprador" />)
    await screen.findByText('Estado registrado:')
    identity.user = null; view.rerender(<OrderTracking orderId="order-a" scope="comprador" />)
    expect(screen.queryByText(/Snapshot original × 2/)).not.toBeInTheDocument()
  })
})
