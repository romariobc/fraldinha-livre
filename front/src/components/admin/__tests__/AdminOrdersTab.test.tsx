/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminOrdersTab from '../AdminOrdersTab'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('AdminOrdersTab', () => {
  it('renderiza os pedidos retornados de GET /orders?scope=admin', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse([
        { id: 'order-1', uid: 'uid-x', status: 'aguardando', product: 'Fralda A', price: 5000 },
      ]),
    )
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())
    expect(apiFetch).toHaveBeenCalledWith('/orders?scope=admin')
  })

  it('mostra erro se a resposta nao for ok (ex.: 403)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar pedidos/i)).toBeInTheDocument())
  })
})
