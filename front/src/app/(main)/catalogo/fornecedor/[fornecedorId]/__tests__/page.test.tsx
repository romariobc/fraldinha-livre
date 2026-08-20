/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(() => '/catalogo/fornecedor/sup-001'),
  useParams: vi.fn(() => ({ fornecedorId: 'sup-001' })),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock auth context
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock cart context
vi.mock('@/contexts/cart-context', () => ({
  useCart: vi.fn(),
}))

// Mock products context
vi.mock('@/contexts/products-context', () => ({
  useProducts: vi.fn(),
}))

import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { useProducts } from '@/contexts/products-context'
import FornecedorCatalogoPage from '../page'
import { PRODUCTS } from '@/lib/mock-data/products-mock'

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)
const mockUsePathname = vi.mocked(usePathname)
const mockUseParams = vi.mocked(useParams)
const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)
const mockUseProducts = vi.mocked(useProducts)

describe('FornecedorCatalogoPage Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    })

    mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
    mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
    mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })

    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      role: null,
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    mockUseCart.mockReturnValue({
      items: [],
      itemCount: 0,
      subtotal: 0,
      bySupplier: new Map(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      updateQty: vi.fn(),
      clear: vi.fn(),
    })

    mockUseProducts.mockReturnValue({
      products: PRODUCTS,
      loading: false,
      error: null,
    })
  })

  it('renders supplier storefront header and filtered products for sup-001', () => {
    render(<FornecedorCatalogoPage />)

    expect(screen.getByText('Loja Exclusiva')).toBeInTheDocument()
    expect(screen.getByText('Catálogo: Distribuidora Sul')).toBeInTheDocument()
    expect(screen.getAllByText('Supersec Pants').length).toBeGreaterThan(0)
  })

  it('renders empty state when supplier has no matching products', () => {
    mockUseParams.mockReturnValue({ fornecedorId: 'non-existent-sup' })
    mockUseProducts.mockReturnValue({
      products: PRODUCTS,
      loading: false,
      error: null,
    })

    render(<FornecedorCatalogoPage />)

    expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /limpar filtros/i })).toBeInTheDocument()
  })
})
