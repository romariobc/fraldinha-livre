import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { Product } from '@contracts'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { EditPriceDialog } from '../EditPriceDialog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const product: Product = { id: 'offer', supplierId: 'supplier-a', name: 'Oferta', brand: 'Marca', size: 'M',
  quantity: 5, priceCents: 1000, active: true, slug: 'oferta', categoria: 'fraldas', descricao: '',
  atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } }
function setup() {
  const update = vi.fn().mockImplementation(async (_id, changes) => ({ ...product, ...changes }))
  const repo: ProductRepository = { list: vi.fn(), listForSupplier: vi.fn(), create: vi.fn(), update, remove: vi.fn() }
  const onSuccess = vi.fn()
  const view = render(<EditPriceDialog open onOpenChange={vi.fn()} product={product} repo={repo} onSuccess={onSuccess} />)
  return { ...view, update, onSuccess }
}
describe('manutenção de preço e estoque', () => {
  it('envia preço em centavos e aceita estoque zero para indisponibilizar a oferta', async () => {
    const { update, onSuccess, container } = setup()
    fireEvent.change(screen.getByLabelText('Estoque disponível'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Novo Preço (R$)'), { target: { value: '12.50' } })
    fireEvent.submit(document.querySelector('form') ?? container)
    await waitFor(() => expect(update).toHaveBeenCalledWith('offer', { priceCents: 1250, quantity: 0 }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0, priceCents: 1250 })))
  })
  it('não envia estoque fracionado', async () => {
    const { update } = setup()
    fireEvent.change(screen.getByLabelText('Estoque disponível'), { target: { value: '1.5' } })
    fireEvent.submit(document.querySelector('form')!)
    expect(update).not.toHaveBeenCalled()
  })
  it('mantém o diálogo aberto quando a API recusa a alteração', async () => {
    const { update, onSuccess } = setup()
    update.mockRejectedValueOnce(new Error('not approved'))
    fireEvent.change(screen.getByLabelText('Estoque disponível'), { target: { value: '8' } })
    await userEvent.setup().click(screen.getByRole('button', { name: /Salvar/i }))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
