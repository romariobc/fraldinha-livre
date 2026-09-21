/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminAuditTab from '../AdminAuditTab'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/frontend-diagnostics', () => ({
  copySupportCode: vi.fn().mockResolvedValue(true),
  showErrorToast: vi.fn(),
}))
import { apiFetch } from '@/lib/api-client'

describe('AdminAuditTab', () => {
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
