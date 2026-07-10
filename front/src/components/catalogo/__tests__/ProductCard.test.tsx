/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ProductCard from '../ProductCard'
import { type Product } from '@/lib/products'

// Mock useRouter with mockPush in closure
let mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock @/contexts/cart-context
vi.mock('@/contexts/cart-context', () => ({
  useCart: vi.fn(),
}))

import { useCart } from '@/contexts/cart-context'
import { toast } from 'sonner'

const mockUseCart = vi.mocked(useCart)
const mockToast = vi.mocked(toast)

// Produto de teste
const TEST_PRODUCT: Product = {
  id: 'p1',
  name: 'Supersec Pants',
  brand: 'Pampers',
  size: 'P',
  quantity: 36,
  priceInCents: 1800,
  supplierId: 'sup-001',
  badge: 'Mais vendido',
}

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush = vi.fn()

    // Mock useCart
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

  it('should render product card with all three CTAs', () => {
    render(
      <ProductCard
        product={TEST_PRODUCT}
        onBuy={vi.fn()}
        onRequestOffer={vi.fn()}
        isLoggedIn={true}
      />
    )

    expect(screen.getByRole('button', { name: /à sacola/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Comprar agora/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pedir oferta/i })).toBeInTheDocument()
  })

  describe('Adicionar à sacola', () => {
    it('should call addItem with correct CartItem when clicking "Adicionar à sacola"', async () => {
      const mockAddItem = vi.fn()
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
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      expect(mockAddItem).toHaveBeenCalledOnce()
      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: expect.any(String),
        unitPrice: 1800,
        quantity: 1,
        unit: 'un',
      })
    })

    it('should show success toast with "Ver sacola" action when item is added', async () => {
      const mockAddItem = vi.fn()
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
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      expect(mockToast.success).toHaveBeenCalledOnce()
      expect(mockToast.success).toHaveBeenCalledWith(
        'Adicionado à sacola',
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'Ver sacola',
          }),
        })
      )
    })

    it('should work without login (no redirect)', async () => {
      const mockAddItem = vi.fn()
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
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={false}
        />
      )

      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      // Should add to cart without redirecting
      expect(mockAddItem).toHaveBeenCalledOnce()
      expect(mockPush).not.toHaveBeenCalledWith('/login?redirect=/catalogo')
    })
  })

  describe('Comprar agora', () => {
    it('should call onBuy with product when logged in', async () => {
      const mockOnBuy = vi.fn()
      const user = userEvent.setup()
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={mockOnBuy}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockOnBuy).toHaveBeenCalledOnce()
      expect(mockOnBuy).toHaveBeenCalledWith(TEST_PRODUCT)
    })

    it('should NOT create order or show old toast when logged in (S5b: flip to checkout)', async () => {
      const mockOnBuy = vi.fn()
      const user = userEvent.setup()
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={mockOnBuy}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      // Verify old toast is NOT shown
      expect(mockToast.success).not.toHaveBeenCalledWith(
        'Pedido criado! O fornecedor foi notificado.'
      )
    })

    it('should redirect to login when not logged in', async () => {
      const user = userEvent.setup()
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={false}
        />
      )

      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/catalogo')
    })
  })

  describe('Pedir oferta', () => {
    it('should be disabled when LEILAO_ATIVO is false', () => {
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const offerButton = screen.getByRole('button', { name: /Pedir oferta/i })
      expect(offerButton).toBeDisabled()
    })

    it('should display "Em breve" badge when LEILAO_ATIVO is false', () => {
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      expect(screen.getByText('Em breve')).toBeInTheDocument()
    })
  })

  describe('aria-labels and accessibility', () => {
    it('should have proper aria-labels for all buttons', () => {
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      expect(screen.getByLabelText(/à sacola/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Comprar agora/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Pedir oferta/i)).toBeInTheDocument()
    })
  })
})
