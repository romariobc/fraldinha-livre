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
  slug: 'pampers-supersec-pants-p',
  categoria: 'fraldas-descartaveis',
  descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas.',
  atributos: {
    faixaPeso: '3–6 kg',
    genero: 'unissex',
    absorcao: 'ate 12 horas',
    tecnologia: 'camada seca antivazamento',
  },
  badge: 'Mais vendido',
}

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

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

  it('should link product name and image to product page', () => {
    render(
      <ProductCard
        product={TEST_PRODUCT}
        onBuy={vi.fn()}
        onRequestOffer={vi.fn()}
        isLoggedIn={true}
      />
    )

    const productLink = screen.getByRole('link')
    expect(productLink).toHaveAttribute('href', `/produto/${TEST_PRODUCT.slug}`)
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

    it('should redirect to login when not logged in', async () => {
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

      // Should redirect to login and NOT add to cart
      expect(mockAddItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/catalogo')
    })
  })

  describe('Comprar agora', () => {
    it('should call onBuy with product and quantity when logged in', async () => {
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
      expect(mockOnBuy).toHaveBeenCalledWith(TEST_PRODUCT, 1)
    })

    it('should call onBuy with correct quantity when stepper is set to 3', async () => {
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

      // Increase quantity to 3 by clicking + twice
      const increaseButtons = screen.getAllByLabelText(/Aumentar quantidade/i)
      await user.click(increaseButtons[0])
      await user.click(increaseButtons[0])

      // Verify quantity is 3
      expect(screen.getByLabelText(/Quantidade: 3/i)).toBeInTheDocument()

      // Click "Comprar agora"
      const buyButton = screen.getByRole('button', { name: /Comprar agora/i })
      await user.click(buyButton)

      expect(mockOnBuy).toHaveBeenCalledOnce()
      expect(mockOnBuy).toHaveBeenCalledWith(TEST_PRODUCT, 3)
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

  describe('Stepper de quantidade', () => {
    it('should display quantity stepper with default value 1', () => {
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      // Should display the quantity stepper with default value 1
      const quantityDisplay = screen.getByLabelText(/Quantidade: 1/i)
      expect(quantityDisplay).toBeInTheDocument()
      expect(quantityDisplay).toHaveTextContent('1')
    })

    it('should increase quantity when clicking + button', async () => {
      const user = userEvent.setup()
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const increaseButtons = screen.getAllByLabelText(/Aumentar quantidade/i)
      await user.click(increaseButtons[0])

      // Quantity should be 2 now
      expect(screen.getByLabelText(/Quantidade: 2/i)).toBeInTheDocument()
    })

    it('should increase quantity to 3 when clicking + twice and addItem should receive quantity: 3', async () => {
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

      const increaseButtons = screen.getAllByLabelText(/Aumentar quantidade/i)
      // Click + twice
      await user.click(increaseButtons[0])
      await user.click(increaseButtons[0])

      // Quantity should be 3 now
      expect(screen.getByLabelText(/Quantidade: 3/i)).toBeInTheDocument()

      // Now click "Adicionar à sacola"
      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      // Verify addItem was called with quantity: 3
      expect(mockAddItem).toHaveBeenCalledOnce()
      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: expect.any(String),
        unitPrice: 1800,
        quantity: 3,
        unit: 'un',
      })
    })

    it('should disable - button when quantity is 1', () => {
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const decreaseButtons = screen.getAllByLabelText(/Diminuir quantidade/i)
      expect(decreaseButtons[0]).toBeDisabled()
    })

    it('should not go below 1 when clicking - button', async () => {
      const user = userEvent.setup()
      render(
        <ProductCard
          product={TEST_PRODUCT}
          onBuy={vi.fn()}
          onRequestOffer={vi.fn()}
          isLoggedIn={true}
        />
      )

      const decreaseButtons = screen.getAllByLabelText(/Diminuir quantidade/i)
      // Try clicking - when at 1
      await user.click(decreaseButtons[0])

      // Should still be 1
      expect(screen.getByLabelText(/Quantidade: 1/i)).toBeInTheDocument()
    })

    it('should reset stepper to 1 after adding to cart', async () => {
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

      const increaseButtons = screen.getAllByLabelText(/Aumentar quantidade/i)
      // Click + twice to get to 3
      await user.click(increaseButtons[0])
      await user.click(increaseButtons[0])

      expect(screen.getByLabelText(/Quantidade: 3/i)).toBeInTheDocument()

      // Add to cart
      const addButton = screen.getByRole('button', { name: /à sacola/i })
      await user.click(addButton)

      // Stepper should reset to 1
      expect(screen.getByLabelText(/Quantidade: 1/i)).toBeInTheDocument()
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
