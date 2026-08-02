/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminProductsTab from '../AdminProductsTab'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('AdminProductsTab', () => {
  it('renderiza os produtos retornados de GET /products?scope=admin', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse([
        { id: 'prod-1', name: 'Produto A', brand: 'Marca A', supplierId: 'supplier-1', priceCents: 5000, active: true },
      ]),
    )
    render(<AdminProductsTab />)
    await waitFor(() => expect(screen.getByText('Produto A')).toBeInTheDocument())
    expect(apiFetch).toHaveBeenCalledWith('/products?scope=admin')
  })

  it('mostra erro se a resposta nao for ok (ex.: 403)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    render(<AdminProductsTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar produtos/i)).toBeInTheDocument())
  })
})
