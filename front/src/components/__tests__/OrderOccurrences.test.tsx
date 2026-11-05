import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderOccurrences from '../OrderOccurrences'
const identity = vi.hoisted(() => ({ user: { uid: 'buyer' } as { uid: string } | null, role: 'comprador' }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => identity }))
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn(), isApiError: (e: { code?: string }) => Boolean(e?.code) }))
import { apiFetch } from '@/lib/api-client'
const response = (value: unknown) => ({ json: async () => value }) as Response
const record = { id: 'report', orderId: 'order', status: 'aberta', version: 0, legacy: false, createdAt: '2026-11-04T12:00:00Z', resolvedBy: null, resolvedAt: null,
  messages: [{ id: 'opening', actorId: 'buyer', actorRole: 'comprador', message: 'Problema original', createdAt: '2026-11-04T12:00:00Z', resolution: false }] }
beforeEach(() => { identity.user = { uid: 'buyer' }; identity.role = 'comprador'; vi.mocked(apiFetch).mockReset().mockResolvedValue(response([record])) })
const select = async () => fireEvent.click(await screen.findByRole('button', { name: 'Ocorrência 1 · Aberta' }))
describe('MP-08: conversa compartilhada', () => {
  it('abre com UID esperado, valida recibo e protege clique repetido', async () => {
    let finish!: (value: Response) => void
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => init?.method === 'POST' ? new Promise(resolve => { finish = resolve }) : response([record]))
    render(<OrderOccurrences orderId="order" />)
    await screen.findByText('Nova ocorrência')
    fireEvent.change(screen.getByLabelText('Descreva o problema'), { target: { value: 'Problema documentado' } })
    const button = screen.getByRole('button', { name: 'Abrir ocorrência' }); fireEvent.click(button); fireEvent.click(button)
    expect(vi.mocked(apiFetch).mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(1)
    const call = vi.mocked(apiFetch).mock.calls.find(c => c[1]?.method === 'POST')!
    expect(call[0]).toBe('/orders/order/occurrences'); expect(call[2]).toBe('buyer')
    finish(response({ success: true, reportId: 'report' }))
    await screen.findByText(/Envio registrado/)
    expect(screen.getByText('Problema original')).toBeInTheDocument()
  })
  it('resolução exige texto e envia versão; conversa terminal não oferece resposta ou reabertura', async () => {
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') return response({ success: true, messageId: 'reply' })
      return response([record])
    })
    render(<OrderOccurrences orderId="order" />); await select()
    const resolve = screen.getByRole('button', { name: 'Resolver com esta resposta' })
    expect(resolve).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Solução acordada entre as partes' } }); fireEvent.click(resolve)
    await screen.findByText(/Envio registrado/)
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls.find(c => c[1]?.method === 'POST')![1]!.body as string)
    expect(body).toMatchObject({ expectedVersion: 0, status: 'resolvida', message: 'Solução acordada entre as partes' })
    vi.mocked(apiFetch).mockResolvedValue(response([{ ...record, status: 'resolvida', resolvedBy: 'admin', resolvedAt: record.createdAt }]))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar ocorrências' }))
    await screen.findByText(/conversa disponível para consulta/)
    expect(screen.queryByLabelText('Sua resposta')).not.toBeInTheDocument()
  })
  it('falha incerta congela conteúdo e repete a mesma solicitação; HTTP 200 inválido não é sucesso', async () => {
    let writes = 0
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') { writes++; if (writes === 1) return response({ ok: true }); return response({ success: true, reportId: 'report' }) }
      return response([record])
    })
    render(<OrderOccurrences orderId="order" />)
    fireEvent.change(screen.getByLabelText('Descreva o problema'), { target: { value: 'Envio recuperável' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ocorrência' }))
    await screen.findByText(/Não foi possível confirmar o envio/)
    expect(screen.getByLabelText('Descreva o problema')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Repetir envio' }))
    await screen.findByText(/Envio registrado/)
    const calls = vi.mocked(apiFetch).mock.calls.filter(c => c[1]?.method === 'POST')
    expect(calls[0][1]!.body).toBe(calls[1][1]!.body)
  })
  it('conflito reconcilia conversa e preserva rascunho para revisão', async () => {
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') throw { code: 'OCCURRENCE_CONFLICT', status: 409, requestId: 'support' }
      return response([record])
    })
    render(<OrderOccurrences orderId="order" />); await select()
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Resposta obsoleta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }))
    await screen.findByText(/Confira a conversa atualizada/)
    expect(screen.getByLabelText('Sua resposta')).toHaveValue('Resposta obsoleta')
    expect(vi.mocked(apiFetch).mock.calls.filter(c => !c[1])).toHaveLength(2)
  })
  it('troca de conta apaga dados/rascunho; resposta tardia não aparece na nova conta', async () => {
    let finish!: (value: Response) => void
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => init?.method === 'POST' ? new Promise(resolve => { finish = resolve }) : response([record]))
    const view = render(<OrderOccurrences orderId="order" />); await select()
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Rascunho privado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }))
    identity.user = null; view.rerender(<OrderOccurrences orderId="order" />)
    finish(response({ success: true, messageId: 'late' }))
    await waitFor(() => expect(screen.queryByText(/Envio registrado/)).not.toBeInTheDocument())
    expect(screen.queryByText('Problema original')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Entre na sua conta')
  })
  it('admin consulta e responde, sem abrir; erro de leitura preserva o histórico', async () => {
    identity.role = 'admin'; render(<OrderOccurrences orderId="order" />); await select()
    expect(screen.queryByRole('button', { name: 'Nova ocorrência' })).not.toBeInTheDocument()
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar ocorrências' }))
    await screen.findByText(/últimos dados foram preservados/)
    expect(screen.getByText('Problema original')).toBeInTheDocument()
    expect(screen.getByLabelText('Sua resposta')).toBeInTheDocument()
  })
  it('abertura confirmada com falha de leitura não é apresentada como resolvida nem reenviada', async () => {
    let reads = 0
    vi.mocked(apiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') return response({ success: true, reportId: 'created' })
      if (++reads > 1) throw new Error('offline')
      return response([])
    })
    render(<OrderOccurrences orderId="order" />)
    await screen.findByText('Nenhuma ocorrência registrada para este pedido.')
    fireEvent.change(screen.getByLabelText('Descreva o problema'), { target: { value: 'Problema documentado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ocorrência' }))
    await screen.findByText(/Atualize as ocorrências para carregar/)
    expect(screen.getByText(/Envio registrado/)).toBeInTheDocument()
    expect(screen.queryByText(/Ocorrência resolvida:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Repetir envio' })).not.toBeInTheDocument()
  })
})
