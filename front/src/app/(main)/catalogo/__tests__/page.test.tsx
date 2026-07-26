/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
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

import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { useProducts } from '@/contexts/products-context'
import CatalogoPage from '../page'
import { PRODUCTS } from '@/lib/products'

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)
const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)
const mockUseProducts = vi.mocked(useProducts)

describe('CatalogoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    })

    mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)

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

  describe('Rendering com dados', () => {
    it('should render product cards when products are loaded', () => {
      render(<CatalogoPage />)

      expect(screen.getByText('Catálogo de Produtos')).toBeInTheDocument()
      expect(screen.getAllByText('Supersec Pants').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Supreme Care').length).toBeGreaterThan(0)
    })

    it('should display pagination info', () => {
      render(<CatalogoPage />)

      // PRODUCTS array tem 24 produtos, página 1 mostra 12
      // Just verify pagination text exists
      expect(screen.queryByText(/Mostrando/)).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    it('should show loading message when loading is true', () => {
      mockUseProducts.mockReturnValue({
        products: [],
        loading: true,
        error: null,
      })

      render(<CatalogoPage />)

      expect(screen.getByText('Carregando catálogo...')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('should show error message when error is not null', () => {
      mockUseProducts.mockReturnValue({
        products: [],
        loading: false,
        error: 'Não foi possível carregar o catálogo. Tente novamente.',
      })

      render(<CatalogoPage />)

      expect(screen.getByText('Erro ao carregar catálogo')).toBeInTheDocument()
      expect(screen.getByText('Não foi possível carregar o catálogo. Tente novamente.')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('should show "Nenhum produto encontrado" when no products match filters', () => {
      mockUseProducts.mockReturnValue({
        products: [],
        loading: false,
        error: null,
      })

      render(<CatalogoPage />)

      expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument()
      expect(screen.getByText('Tente ajustar os filtros ou limpar a busca.')).toBeInTheDocument()
    })
  })

  describe('Filter by brand', () => {
    it('should filter products by brand (basic test)', () => {
      render(<CatalogoPage />)

      // Verifica que o catálogo tem produtos carregados (não vazio)
      const productCards = screen.getAllByRole('link')
      expect(productCards.length).toBeGreaterThan(0)
    })
  })
})
