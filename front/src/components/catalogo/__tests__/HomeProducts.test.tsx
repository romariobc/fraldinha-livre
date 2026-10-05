import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { PRODUCTS } from '@/lib/__tests__/products-fixture'
import HomeProducts from '../HomeProducts'

const mocks = vi.hoisted(() => ({ push: vi.fn(), addItem: vi.fn(), refetch: vi.fn(),
  user: null as { uid: string } | null, complete: false, error: null as string | null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: mocks.user, profile: null }) }))
vi.mock('@/contexts/cart-context', () => ({ useCart: () => ({ addItem: mocks.addItem }) }))
vi.mock('@/contexts/products-context', () => ({ useProducts: () => ({ products: PRODUCTS,
  loading: false, error: mocks.error, refetch: mocks.refetch }) }))
vi.mock('@/lib/utils', async importOriginal => ({ ...await importOriginal<object>(),
  isProfileComplete: () => mocks.complete }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

describe('Compra pela vitrine inicial', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user = null; mocks.complete = false; mocks.error = null })
  it('protege a compra de visitante e usa produto real do catálogo', async () => {
    render(<HomeProducts />)
    await userEvent.click(screen.getAllByRole('button', { name: /Comprar agora/ })[0])
    expect(mocks.push).toHaveBeenCalledWith('/login?redirect=/catalogo')
    expect(mocks.addItem).not.toHaveBeenCalled()
  })
  it('exige perfil completo antes da compra expressa', async () => {
    mocks.user = { uid: 'buyer' }
    render(<HomeProducts />)
    await userEvent.click(screen.getAllByRole('button', { name: /Comprar agora/ })[0])
    expect(mocks.push).toHaveBeenCalledWith('/minha-conta?tab=perfil&returnTo=%2F')
    expect(mocks.addItem).not.toHaveBeenCalled()
  })
  it('leva produto e quantidade escolhida para o checkout sem chat', async () => {
    mocks.user = { uid: 'buyer' }; mocks.complete = true
    render(<HomeProducts />)
    await userEvent.click(screen.getAllByRole('button', { name: /Aumentar quantidade/ })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /Comprar agora/ })[0])
    expect(mocks.addItem).toHaveBeenCalledWith(expect.objectContaining({ productId: PRODUCTS[0].id,
      supplierId: PRODUCTS[0].supplierId, unitPrice: PRODUCTS[0].priceInCents, quantity: 2 }))
    expect(mocks.push).toHaveBeenCalledWith('/checkout')
  })
  it('permite repetir a consulta quando o catálogo falha', async () => {
    mocks.error = 'rede indisponível'
    render(<HomeProducts />)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /Comprar agora/ })).not.toBeInTheDocument()
  })
})
