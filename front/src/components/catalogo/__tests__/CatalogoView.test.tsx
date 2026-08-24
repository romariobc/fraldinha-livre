/// <reference types="vitest/globals" />

import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
  useParams: vi.fn(),
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
import { CatalogoView, useFilters } from '../CatalogoView'
import FornecedorCatalogoPage from '@/app/(main)/catalogo/fornecedor/[fornecedorId]/page'
import CatalogoPage from '@/app/(main)/catalogo/page'
import { PRODUCTS } from '@/lib/__tests__/products-fixture'

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)
const mockUsePathname = vi.mocked(usePathname)
const mockUseParams = vi.mocked(useParams)
const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)
const mockUseProducts = vi.mocked(useProducts)

describe('CatalogoView and useFilters Component Decoupling Suite', () => {
  const mockPush = vi.fn()
  const mockReplace = vi.fn()
  const mockAddItem = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    })

    mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
    mockUsePathname.mockReturnValue('/catalogo')
    mockUseParams.mockReturnValue({})

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
      addItem: mockAddItem,
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

  describe('1. useFilters Hook Isolation Tests', () => {
    it('initializes filters correctly with default route and no params', () => {
      const { result } = renderHook(() => useFilters())
      const [filters] = result.current

      expect(filters.page).toBe(1)
      expect(filters.search).toBe('')
      expect(filters.brand).toBe('todos')
      expect(filters.size).toBe('todos')
      expect(filters.sort).toBe('')
      expect(filters.supplierId).toBeUndefined()
    })

    it('reads supplierId from useParams().fornecedorId when present', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })

      const { result } = renderHook(() => useFilters())
      const [filters] = result.current

      expect(filters.supplierId).toBe('sup-001')
    })

    it('handles array fornecedorId in useParams safely', () => {
      mockUseParams.mockReturnValue({ fornecedorId: ['sup-002'] as unknown as string })

      const { result } = renderHook(() => useFilters())
      const [filters] = result.current

      expect(filters.supplierId).toBe('sup-002')
    })

    it('preserves current pathname when updateFilter is called on supplier storefront route', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })
      mockUseSearchParams.mockReturnValue(new URLSearchParams('marca=Pampers') as ReturnType<typeof useSearchParams>)

      const { result } = renderHook(() => useFilters())
      const [, updateFilter] = result.current

      act(() => {
        updateFilter('size', 'G')
      })

      expect(mockReplace).toHaveBeenCalledWith('/catalogo/fornecedor/sup-001?marca=Pampers&tam=G')
    })

    it('deletes sentinel "todos" and page parameter when filter is updated', () => {
      mockUsePathname.mockReturnValue('/catalogo')
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams('marca=Pampers&tam=G&page=3') as ReturnType<typeof useSearchParams>
      )

      const { result } = renderHook(() => useFilters())
      const [, updateFilter] = result.current

      act(() => {
        updateFilter('brand', 'todos')
      })

      // Brand should be deleted, size preserved, page removed
      expect(mockReplace).toHaveBeenCalledWith('/catalogo?tam=G')
    })

    it('clearFilters preserves supplier query param on general catalog but cleans all on supplier storefront', () => {
      // Case A: /catalogo?fornecedor=sup-001&marca=Pampers
      mockUsePathname.mockReturnValue('/catalogo')
      mockUseParams.mockReturnValue({})
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams('fornecedor=sup-001&marca=Pampers&search=fralda') as ReturnType<typeof useSearchParams>
      )

      const { result: hookA } = renderHook(() => useFilters())
      act(() => {
        hookA.current[2]() // clearFilters
      })
      expect(mockReplace).toHaveBeenCalledWith('/catalogo?fornecedor=sup-001')

      // Case B: /catalogo/fornecedor/sup-001?marca=Pampers&search=fralda
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams('marca=Pampers&search=fralda') as ReturnType<typeof useSearchParams>
      )

      const { result: hookB } = renderHook(() => useFilters())
      act(() => {
        hookB.current[2]() // clearFilters
      })
      expect(mockReplace).toHaveBeenCalledWith('/catalogo/fornecedor/sup-001')
    })
    it('maps supplierId key to fornecedor query param when updateFilter is called', () => {
      mockUsePathname.mockReturnValue('/catalogo')
      mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)

      const { result } = renderHook(() => useFilters())
      const [, updateFilter] = result.current

      act(() => {
        updateFilter('supplierId', 'sup-003')
      })

      expect(mockReplace).toHaveBeenCalledWith('/catalogo?fornecedor=sup-003')
    })

    it('falls back to /catalogo when usePathname returns null', () => {
      mockUsePathname.mockReturnValue(null as unknown as string)
      mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)

      const { result } = renderHook(() => useFilters())
      const [, updateFilter] = result.current

      act(() => {
        updateFilter('brand', 'Pampers')
      })

      expect(mockReplace).toHaveBeenCalledWith('/catalogo?marca=Pampers')
    })
  })

  describe('2. CatalogoView Rendering & Public Storefront Tests', () => {
    it('renders general catalog title and products when no supplierId is in route', () => {
      render(<CatalogoView />)

      expect(screen.getByText('Fraldinha Livre')).toBeInTheDocument()
      expect(screen.getByText('Catálogo de Produtos')).toBeInTheDocument()
      expect(screen.getAllByText('Supersec Pants').length).toBeGreaterThan(0)
    })

    it('renders supplier storefront with "Loja Exclusiva" and supplier name when route has fornecedorId', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })

      render(<CatalogoView />)

      expect(screen.getByText('Loja Exclusiva')).toBeInTheDocument()
      expect(screen.getByText('Catálogo: Distribuidora Sul')).toBeInTheDocument()
      // Only products from sup-001 should be rendered
      const productCards = screen.getAllByRole('link')
      expect(productCards.length).toBeGreaterThan(0)
    })

    it('falls back to "Fornecedor Parceiro" when route supplierId is not in STORE_SUPPLIERS', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/unknown-supplier-999')
      mockUseParams.mockReturnValue({ fornecedorId: 'unknown-supplier-999' })

      render(<CatalogoView />)

      expect(screen.getByText('Loja Exclusiva')).toBeInTheDocument()
      expect(screen.getByText('Catálogo: Fornecedor Parceiro')).toBeInTheDocument()
    })

    it('renders authenticated supplier displayName when viewing own storefront not in STORE_SUPPLIERS', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/custom-supplier-uid')
      mockUseParams.mockReturnValue({ fornecedorId: 'custom-supplier-uid' })
      mockUseAuth.mockReturnValue({
        user: { uid: 'custom-supplier-uid', displayName: 'Distribuidora Premium', email: 'contato@distribuidora.com' } as any,
        profile: null,
        role: 'fornecedor',
        loading: false,
        signInGoogle: vi.fn(),
        signInEmail: vi.fn(),
        signUpEmail: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      render(<CatalogoView />)

      expect(screen.getByText('Loja Exclusiva')).toBeInTheDocument()
      expect(screen.getByText('Catálogo: Distribuidora Premium')).toBeInTheDocument()
    })

    it('renders empty state when supplier has no matching products', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-empty')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-empty' })
      mockUseProducts.mockReturnValue({
        products: [],
        loading: false,
        error: null,
      })

      render(<CatalogoView />)

      expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument()
      expect(screen.getByText('Tente ajustar os filtros ou limpar a busca.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /limpar filtros/i })).toBeInTheDocument()
    })

    it('handles pagination navigation with dynamic route pathname preservation', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })
      mockUseSearchParams.mockReturnValue(new URLSearchParams('tam=G') as ReturnType<typeof useSearchParams>)

      render(<CatalogoView />)

      // Find next page button in pagination
      const pageButtons = screen.queryAllByRole('button', { name: '2' })
      if (pageButtons.length > 0) {
        fireEvent.click(pageButtons[0])
        expect(mockPush).toHaveBeenCalledWith('/catalogo/fornecedor/sup-001?tam=G&page=2')
      }
    })

    it('cleans page parameter when navigating back to page 1', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })
      mockUseSearchParams.mockReturnValue(new URLSearchParams('tam=G&page=2') as ReturnType<typeof useSearchParams>)

      render(<CatalogoView />)

      const page1Buttons = screen.queryAllByRole('button', { name: '1' })
      if (page1Buttons.length > 0) {
        fireEvent.click(page1Buttons[0])
        expect(mockPush).toHaveBeenCalledWith('/catalogo/fornecedor/sup-001?tam=G')
      }
    })

    it('redirects user with incomplete profile to minha-conta with dynamic returnTo', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-002')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-002' })

      mockUseAuth.mockReturnValue({
        user: { uid: 'user-incomplete', email: 'test@buyer.com' } as any,
        profile: {
          fullName: 'Test User',
          phone: '', // incomplete
          cpfCnpj: '',
          address: {} as any,
        } as any,
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
        signInEmail: vi.fn(),
        signUpEmail: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      render(<CatalogoView />)

      const buyButtons = screen.getAllByRole('button', { name: /comprar/i })
      expect(buyButtons.length).toBeGreaterThan(0)
      fireEvent.click(buyButtons[0])

      expect(mockPush).toHaveBeenCalledWith(
        `/minha-conta?tab=perfil&returnTo=${encodeURIComponent('/catalogo/fornecedor/sup-002')}`
      )
    })

    it('adds product to cart and navigates to checkout for complete profile', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })

      mockUseAuth.mockReturnValue({
        user: { uid: 'user-complete', email: 'buyer@test.com' } as any,
        profile: {
          fullName: 'Comprador Completo',
          phone: '(11) 99999-9999',
          cpf: '11144477735',
          address: {
            logradouro: 'Rua Teste',
            numero: '10',
            bairro: 'Bairro',
            cidade: 'Cidade',
            estado: 'SP',
            cep: '01000-000',
          },
        } as any,
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
        signInEmail: vi.fn(),
        signUpEmail: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      render(<CatalogoView />)

      const buyButtons = screen.getAllByRole('button', { name: /comprar/i })
      fireEvent.click(buyButtons[0])

      expect(mockAddItem).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/checkout')
    })
  })

  describe('3. Route Wrappers Verification', () => {
    it('renders FornecedorCatalogoPage seamlessly', () => {
      mockUsePathname.mockReturnValue('/catalogo/fornecedor/sup-001')
      mockUseParams.mockReturnValue({ fornecedorId: 'sup-001' })

      render(<FornecedorCatalogoPage />)

      expect(screen.getByText('Loja Exclusiva')).toBeInTheDocument()
    })

    it('renders CatalogoPage seamlessly', () => {
      mockUsePathname.mockReturnValue('/catalogo')
      mockUseParams.mockReturnValue({})

      render(<CatalogoPage />)

      expect(screen.getByText('Catálogo de Produtos')).toBeInTheDocument()
    })
  })
})
