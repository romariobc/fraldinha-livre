/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

// Mock next/navigation
let mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
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

import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { toast } from 'sonner'
import ProductPage from '../page'

const mockUseParams = vi.mocked(useParams)
const mockUseRouter = vi.mocked(useRouter)
const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)
const mockToast = vi.mocked(toast)


describe('ProductPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush = vi.fn()

    // Default mocks
    mockUseParams.mockReturnValue({ slug: 'pampers-supersec-pants-p' })
    mockUseRouter.mockReturnValue({
      push: mockPush,
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    })
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      role: null,
      loading: false,
      signInGoogle: vi.fn(),
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
  })

  describe('Render com slug válido', () => {
    it('should render product name, price, and attributes', () => {
      render(<ProductPage />)

      expect(screen.getByRole('heading', { name: 'Supersec Pants' })).toBeInTheDocument()
      expect(screen.getByText(/R\$ 18,00/)).toBeInTheDocument()
      expect(screen.getByText(/Tam. P · 36 un/)).toBeInTheDocument()
      expect(screen.getAllByText('Pampers').length).toBeGreaterThan(0)
    })

    it('should display supplier name and rating', () => {
      render(<ProductPage />)

      // Supplier name
      expect(screen.getByText('Distribuidora Sul')).toBeInTheDocument()
      // Rating: 4 stars
      expect(screen.getByText('★★★★☆')).toBeInTheDocument()
    })

    it('should render all attribute specifications', () => {
      render(<ProductPage />)

      expect(screen.getByText('3–6 kg')).toBeInTheDocument()
      expect(screen.getByText('unissex')).toBeInTheDocument()
      expect(screen.getByText('ate 12 horas')).toBeInTheDocument()
      expect(screen.getByText('camada seca antivazamento')).toBeInTheDocument()
    })

    it('should render stepper with min value 1', () => {
      render(<ProductPage />)

      const minusButton = screen.getByLabelText('Diminuir quantidade')
      expect(minusButton).toHaveAttribute('disabled')
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('should render both CTAs', () => {
      render(<ProductPage />)

      expect(screen.getByRole('button', { name: /à sacola/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Comprar agora/i })).toBeInTheDocument()
    })
  })

  describe('Slug inexistente', () => {
    it('should show "Produto não encontrado" message and link to catalog', () => {
      mockUseParams.mockReturnValue({ slug: 'nonexistent-product' })

      render(<ProductPage />)

      expect(screen.getByText('Produto não encontrado')).toBeInTheDocument()
      expect(screen.getByText('Voltar ao catálogo')).toBeInTheDocument()

      const link = screen.getByRole('link', { name: /Voltar ao catálogo/i })
      expect(link).toHaveAttribute('href', '/catalogo')
    })
  })

  describe('Deslogado + Adicionar à sacola', () => {
    it('should redirect to login when not logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ProductPage />)

      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/produto/pampers-supersec-pants-p')
    })
  })

  describe('Logado + Adicionar à sacola', () => {
    it('should call addItem with quantity 2 when stepper is set to 2', async () => {
      const mockAddItem = vi.fn()
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        profile: { role: 'comprador', name: 'Test User', email: 'test@example.com' },
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
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

      const user = userEvent.setup()
      render(<ProductPage />)

      // Increment to 2
      const plusButton = screen.getByLabelText('Aumentar quantidade')
      await user.click(plusButton)

      // Add to cart
      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: 'Distribuidora Sul',
        unitPrice: 1800,
        quantity: 2,
        unit: 'un',
      })
    })

    it('should show success toast with "Ver sacola" action', async () => {
      const mockAddItem = vi.fn()
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        profile: { role: 'comprador', name: 'Test User', email: 'test@example.com' },
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
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

      const user = userEvent.setup()
      render(<ProductPage />)

      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      expect(mockToast.success).toHaveBeenCalledWith(
        'Adicionado à sacola',
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'Ver sacola',
          }),
        })
      )
    })

    it('should reset stepper to 1 after adding to cart', async () => {
      const mockAddItem = vi.fn()
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        profile: { role: 'comprador', name: 'Test User', email: 'test@example.com' },
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
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

      const user = userEvent.setup()
      const { rerender } = render(<ProductPage />)

      // Increment to 2
      const plusButton = screen.getByLabelText('Aumentar quantidade')
      await user.click(plusButton)

      // Add to cart
      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      // Re-render to check stepper reset
      rerender(<ProductPage />)

      // After re-render, stepper should be 1
      const quantityDisplay = screen.getByText('1')
      expect(quantityDisplay).toBeInTheDocument()
    })
  })

  describe('Comprar agora', () => {
    it('should redirect to login when not logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ProductPage />)

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/produto/pampers-supersec-pants-p')
    })

    it('should redirect to minha-conta when profile is incomplete', async () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        profile: { role: 'comprador', name: 'Test User', email: 'test@example.com', cpf: '' }, // incomplete profile
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
        signOutUser: vi.fn(),
        updateProfile: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ProductPage />)

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockPush).toHaveBeenCalledWith(
        '/minha-conta?tab=perfil&returnTo=/produto/pampers-supersec-pants-p'
      )
    })

    it('should call addItem and push to checkout when profile is complete', async () => {
      const mockAddItem = vi.fn()
      // Valid Brazilian CPF: 11144477735 (test CPF that passes validation)
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        profile: {
          role: 'comprador',
          name: 'Test User',
          email: 'test@example.com',
          cpf: '11144477735',
          phone: '11999999999',
          address: {
            logradouro: 'Rua A',
            numero: '123',
            bairro: 'Bairro',
            cidade: 'São Paulo',
            estado: 'SP',
            cep: '01234-567',
          },
        },
        role: 'comprador',
        loading: false,
        signInGoogle: vi.fn(),
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

      const user = userEvent.setup()
      render(<ProductPage />)

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: 'Distribuidora Sul',
        unitPrice: 1800,
        quantity: 1,
        unit: 'un',
      })

      expect(mockPush).toHaveBeenCalledWith('/checkout')
    })
  })
})
