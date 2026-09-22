/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminProductsTab from '../AdminProductsTab'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/frontend-diagnostics', () => ({ showErrorToast: vi.fn() }))
import { showErrorToast } from '@/lib/frontend-diagnostics'
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('AdminProductsTab', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([false, true])('valida justificativa e trata falha=%s na moderação', async (fail) => {
    const product = { id: 'prod-1', name: 'Produto A', brand: 'Marca A', supplierId: 'supplier-1', priceCents: 5000, active: true }
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse([product]))
    if (fail) vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Falha de teste'))
    else vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({ product: { ...product, active: false } }))
    render(<AdminProductsTab />)
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }))
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    const reason = screen.getByPlaceholderText('Justificativa (mínimo de 5 caracteres)')
    fireEvent.change(reason, { target: { value: '    a ' } })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(apiFetch).toHaveBeenCalledTimes(1)
    fireEvent.change(reason, { target: { value: '  Fora da política  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/products/prod-1/status', {
      method: 'PATCH', body: JSON.stringify({ active: false, reason: 'Fora da política' }),
    }))
    if (fail) {
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled())
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled()
    } else {
      await screen.findByRole('button', { name: 'Ativar' })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
  })
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
