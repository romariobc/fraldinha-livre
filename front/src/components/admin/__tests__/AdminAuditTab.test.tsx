/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminAuditTab from '../AdminAuditTab'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/frontend-diagnostics', () => ({
  copySupportCode: vi.fn().mockResolvedValue(true),
  showErrorToast: vi.fn(),
}))
import { apiFetch } from '@/lib/api-client'

describe('AdminAuditTab', () => {
  beforeEach(() => vi.clearAllMocks())
  it('navega entre páginas e reinicia a página ao filtrar', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => ({ json: async () => ({
      logs: [], total: String(url).includes('targetType=') ? 1 : 21,
      page: String(url).includes('page=2') ? 2 : 1, limit: 20,
    }) }) as Response)
    render(<AdminAuditTab />)
    await screen.findByText('Página 1 de 2')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Página 2 de 2')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs?page=2')
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await screen.findByText('Página 1 de 2')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Página 2 de 2')
    fireEvent.change(screen.getByRole('combobox', { name: 'Alvo' }), { target: { value: 'product' } })
    await screen.findByText('Página 1 de 1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs?targetType=product')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })
  it('carrega eventos e aplica filtro de alvo', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: async () => ({
        logs: [{
          id: 'audit-1', actorId: 'admin-1', actorRole: 'admin', targetType: 'product', targetId: 'prod-1',
          action: 'product.deactivated', reason: 'Produto fora da política', requestId: 'req-1',
          createdAt: '2026-09-20T12:00:00.000Z',
        }],
        total: 1, page: 1, limit: 20,
      }),
    } as Response)

    render(<AdminAuditTab />)
    await waitFor(() => expect(screen.getByText('product.deactivated')).toBeInTheDocument())
    expect(screen.getByText(/prod-1/)).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/admin/audit-logs')
  })
})
