import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from '../NotificationCenter'
const identity = vi.hoisted(() => ({ user: { uid: 'buyer-a' } as { uid: string } | null, role: 'comprador' as 'comprador' | 'fornecedor' | 'admin' }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => identity }))
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('@/components/OrderTracking', () => ({ default: ({ orderId, scope }: { orderId: string; scope: string }) => <p>Pedido autorizado {orderId} · {scope}</p> }))
vi.mock('@/components/OrderOccurrences', () => ({ default: ({ orderId, initialReportId }: { orderId: string; initialReportId: string }) => <p>Conversa autorizada {orderId} · {initialReportId}</p> }))
import { apiFetch } from '@/lib/api-client'
const now = '2026-11-05T12:00:00.000Z'
const item = { id: '3', kind: 'order_status', message: 'Pedido confirmado.', createdAt: now, readAt: null }
const page = { items: [item], nextCursor: null, unreadCount: 1 }
const response = (value: unknown) => ({ json: async () => value }) as Response
beforeEach(() => { identity.user = { uid: 'buyer-a' }; identity.role = 'comprador'; vi.mocked(apiFetch).mockReset().mockResolvedValue(response(page)) })

describe('MP-09 notification center', () => {
  it('loads persisted notices with UID binding, unread state and an internal destination link', async () => {
    render(<NotificationCenter />)
    expect(await screen.findByText('Pedido confirmado.')).toBeInTheDocument()
    expect(screen.getByText('1 aviso(s) não lido(s)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver atualização' })).toHaveAttribute('href', '/avisos?notification=3')
    expect(apiFetch).toHaveBeenCalledWith('/notifications', undefined, 'buyer-a')
  })
  it('preserves received data on refresh failure and recovers manually', async () => {
    render(<NotificationCenter />); await screen.findByText('Pedido confirmado.')
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar avisos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('preservados')
    expect(screen.getByText('Pedido confirmado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar avisos' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
  it('loads older pages by stable cursor and can return to recent notices', async () => {
    vi.mocked(apiFetch).mockImplementation(async path => response(path.includes('cursor=2')
      ? { items: [{ ...item, id: '1', message: 'Aviso antigo.' }], nextCursor: null, unreadCount: 3 }
      : { ...page, nextCursor: '2' }))
    render(<NotificationCenter />); await screen.findByText('Pedido confirmado.')
    fireEvent.click(screen.getByRole('button', { name: 'Mais antigos' }))
    await screen.findByText('Aviso antigo.')
    expect(screen.queryByText('Pedido confirmado.')).not.toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/notifications?cursor=2', undefined, 'buyer-a')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos recentes' }))
    await screen.findByText('Pedido confirmado.')
  })
  it('serializes repeated read clicks and uses the persisted receipt followed by reconciliation', async () => {
    let finish!: (value: Response) => void, read = false
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => init?.method === 'PATCH' ? new Promise(resolve => { finish = resolve }) : response(read ? { ...page, items: [{ ...item, readAt: now }], unreadCount: 0 } : page))
    render(<NotificationCenter />); await screen.findByText('Pedido confirmado.')
    const button = screen.getByRole('button', { name: 'Marcar como lido' })
    fireEvent.click(button); fireEvent.click(button)
    expect(vi.mocked(apiFetch).mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1)
    expect(apiFetch).toHaveBeenCalledWith('/notifications/3/read', { method: 'PATCH' }, 'buyer-a')
    read = true
    await act(async () => { finish(response({ id: '3', readAt: now })) })
    expect(await screen.findByText('Lido')).toBeInTheDocument()
    expect(screen.getByText('0 aviso(s) não lido(s)')).toBeInTheDocument()
  })
  it('lost read response can be reconciled after refresh without assuming rollback', async () => {
    let read = false
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === 'PATCH') { read = true; throw new Error('response lost after commit') }
      return response(read ? { ...page, items: [{ ...item, readAt: now }], unreadCount: 0 } : page)
    })
    render(<NotificationCenter />); await screen.findByText('Pedido confirmado.')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lido' }))
    await screen.findByText(/Não foi possível confirmar a leitura/)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar avisos' }))
    await screen.findByText('Lido'); expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('invalid receipts and malformed page payloads are not displayed as successful reads', async () => {
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => response(init?.method === 'PATCH' ? { id: '999', readAt: now } : page))
    const view = render(<NotificationCenter />); await screen.findByText('Pedido confirmado.')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lido' }))
    await screen.findByText(/Não foi possível confirmar a leitura/)
    expect(screen.queryByText('Lido')).not.toBeInTheDocument()
    view.unmount(); vi.mocked(apiFetch).mockResolvedValue(response({ items: [{ ...item, readAt: 'yesterday' }] }))
    render(<NotificationCenter />); await screen.findByRole('alert')
    expect(screen.queryByText('Pedido confirmado.')).not.toBeInTheDocument()
  })
  it('clears account results/destinations immediately and ignores a late response from the old account', async () => {
    let finish!: (value: Response) => void
    vi.mocked(apiFetch).mockImplementation(async (_path, _init, uid) => uid === 'buyer-a' ? new Promise(resolve => { finish = resolve }) : response({ items: [], nextCursor: null, unreadCount: 0 }))
    const view = render(<NotificationCenter />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    identity.user = { uid: 'buyer-b' }; view.rerender(<NotificationCenter />)
    await screen.findByText('Nenhum aviso nesta página.')
    await act(async () => { finish(response(page)) })
    expect(screen.queryByText('Pedido confirmado.')).not.toBeInTheDocument()
    identity.user = null; view.rerender(<NotificationCenter />)
    expect(screen.queryByText('Meus avisos')).not.toBeInTheDocument()
  })
  it('rechecks destinations on the API and only renders the returned authorized order', async () => {
    vi.mocked(apiFetch).mockImplementation(async path => response(path.includes('/destination') ? { type: 'order', orderId: 'order-a', scope: 'comprador' } : page))
    render(<NotificationCenter selectedId="3" />)
    expect(await screen.findByText('Pedido autorizado order-a · comprador')).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/notifications/3/destination', undefined, 'buyer-a')
  })
  it('ignores a previous account destination that resolves after account switching', async () => {
    let finish!: (value: Response) => void
    vi.mocked(apiFetch).mockImplementation(async (path, _init, uid) => {
      if (!path.includes('/destination')) return response(uid === 'buyer-a' ? page : { items: [], nextCursor: null, unreadCount: 0 })
      if (uid === 'buyer-a') return new Promise(resolve => { finish = resolve })
      throw new Error('403')
    })
    const view = render(<NotificationCenter selectedId="3" />)
    await waitFor(() => expect(finish).toBeDefined())
    identity.user = { uid: 'buyer-b' }; view.rerender(<NotificationCenter selectedId="3" />)
    await screen.findByText(/Não foi possível abrir este destino/)
    await act(async () => { finish(response({ type: 'order', orderId: 'private-old-order', scope: 'comprador' })) })
    expect(screen.queryByText(/private-old-order/)).not.toBeInTheDocument()
  })
  it('opens the exact report from a typed destination and never accepts an arbitrary URL', async () => {
    vi.mocked(apiFetch).mockImplementation(async path => response(path.includes('/destination') ? { type: 'occurrence', orderId: 'order-a', reportId: 'report-b' } : page))
    const view = render(<NotificationCenter selectedId="3" />)
    expect(await screen.findByText('Conversa autorizada order-a · report-b')).toBeInTheDocument()
    view.unmount()
    vi.mocked(apiFetch).mockImplementation(async path => response(path.includes('/destination') ? { type: 'supplier', href: 'https://untrusted.example/' } : page))
    render(<NotificationCenter selectedId="3" />)
    await screen.findByText(/Não foi possível abrir este destino/)
    expect(screen.queryByText('Consultar situação do cadastro')).not.toBeInTheDocument()
  })
  it('denied links can retry without granting access or leaking the previous preview', async () => {
    vi.mocked(apiFetch).mockImplementation(async path => { if (path.includes('/destination')) throw new Error('403'); return response(page) })
    render(<NotificationCenter selectedId="3" />)
    await screen.findByText(/Não foi possível abrir este destino/)
    expect(screen.queryByText(/Pedido autorizado/)).not.toBeInTheDocument()
    vi.mocked(apiFetch).mockImplementation(async path => response(path.includes('/destination') ? { type: 'supplier', href: '/painel-fornecedor' } : page))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar abrir novamente' }))
    expect(await screen.findByRole('link', { name: 'Consultar situação do cadastro' })).toHaveAttribute('href', '/painel-fornecedor')
  })
})
