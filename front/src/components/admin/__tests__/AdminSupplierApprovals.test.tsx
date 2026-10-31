import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminSupplierApprovals from '../AdminSupplierApprovals'
import { apiFetch } from '@/lib/api-client'
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
const row = { uid: 'supplier-qa', status: 'pendente', version: 0, reason: null, createdAt: '2026-10-29', updatedAt: '2026-10-29' }
const response = (applications = [row], nextCursor: string | null = null) => new Response(JSON.stringify({ applications, nextCursor }))
describe('análise administrativa de fornecedor', () => {
  beforeEach(() => vi.resetAllMocks())
  it('exige motivo e envia a versão apresentada; confirma persistência e atualiza lista', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(response([]))
    render(<AdminSupplierApprovals />)
    fireEvent.click(await screen.findByRole('button', { name: 'Analisar supplier-qa' }))
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Motivo da decisão/), { target: { value: 'Cadastro verificado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Decisão registrada.')
    expect(apiFetch).toHaveBeenCalledWith('/admin/suppliers/supplier-qa', { method: 'PATCH', body: JSON.stringify({ status: 'aprovado', reason: 'Cadastro verificado', expectedVersion: 0 }) })
  })
  it('pagina e preserva os registros anteriores', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(response([row], 'supplier-qa')).mockResolvedValueOnce(response([{ ...row, uid: 'supplier-z' }]))
    render(<AdminSupplierApprovals />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mais solicitações' }))
    await screen.findByRole('button', { name: 'Analisar supplier-z' })
    expect(screen.getByRole('button', { name: 'Analisar supplier-qa' })).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/admin/suppliers?cursor=supplier-qa')
  })
  it('mostra erro de decisão e não anuncia sucesso', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error('Estado alterado. Atualize a lista.'))
    render(<AdminSupplierApprovals />)
    fireEvent.click(await screen.findByRole('button', { name: 'Analisar supplier-qa' }))
    fireEvent.change(screen.getByLabelText(/Motivo da decisão/), { target: { value: 'Cadastro verificado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Estado alterado'))
    expect(screen.queryByText('Decisão registrada.')).not.toBeInTheDocument()
  })
})
