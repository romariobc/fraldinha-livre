/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider } from '@/contexts/cart-context'
import type { CartItem } from '@/lib/domain/cart'
import SacolaPage from '../page'

// Helper to render page inside CartProvider with pre-seeded localStorage
function renderWithCart(items: CartItem[]) {
  // Pre-seed localStorage before rendering
  if (items.length > 0) {
    window.localStorage.setItem('fl.cart.v1', JSON.stringify(items))
  }

  return render(
    <CartProvider>
      <SacolaPage />
    </CartProvider>
  )
}

// Mock items for testing
const mockItem1: CartItem = {
  productId: 'prod-1',
  productName: 'Fralda Premium',
  supplierId: 'supplier-1',
  supplierName: 'Fornecedor A',
  unitPrice: 5000, // R$ 50.00 in centavos
  quantity: 2,
  unit: 'cx',
}

const mockItem2: CartItem = {
  productId: 'prod-2',
  productName: 'Fralda Conforto',
  supplierId: 'supplier-1',
  supplierName: 'Fornecedor A',
  unitPrice: 3500, // R$ 35.00 in centavos
  quantity: 1,
  unit: 'cx',
}

const mockItem3: CartItem = {
  productId: 'prod-3',
  productName: 'Lenços Umedecidos',
  supplierId: 'supplier-2',
  supplierName: 'Fornecedor B',
  unitPrice: 2000, // R$ 20.00 in centavos
  quantity: 3,
  unit: 'un',
}

describe('SacolaPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('Empty cart', () => {
    it('should display empty state when cart is empty', () => {
      renderWithCart([])

      expect(screen.getByText('Sua sacola está vazia')).toBeInTheDocument()
      expect(screen.getByText('Comece a comprar para preencher sua sacola')).toBeInTheDocument()
    })

    it('should display link to catalogo in empty state', () => {
      renderWithCart([])

      const link = screen.getByRole('link', { name: /Explorar catálogo/i })
      expect(link).toHaveAttribute('href', '/catalogo')
    })
  })

  describe('Cart with items', () => {
    it('should display page header when cart has items', () => {
      renderWithCart([mockItem1, mockItem2, mockItem3])

      expect(screen.getByText('Sua sacola')).toBeInTheDocument()
      expect(screen.getByText('Seu carrinho')).toBeInTheDocument()
    })

    it('should group items by supplier (2 suppliers)', () => {
      renderWithCart([mockItem1, mockItem2, mockItem3])

      expect(screen.getByText('Fornecedor A')).toBeInTheDocument()
      expect(screen.getByText('Fornecedor B')).toBeInTheDocument()
    })

    it('should display items under correct supplier groups', () => {
      renderWithCart([mockItem1, mockItem2, mockItem3])

      // Verify all items are displayed
      expect(screen.getByText('Fralda Premium')).toBeInTheDocument()
      expect(screen.getByText('Fralda Conforto')).toBeInTheDocument()
      expect(screen.getByText('Lenços Umedecidos')).toBeInTheDocument()
    })

    it('should display product prices formatted', () => {
      renderWithCart([mockItem1])

      expect(screen.getByText('R$ 50,00 / cx')).toBeInTheDocument()
    })

    it('should display total amount correctly', () => {
      // mockItem1: 5000 * 2 = 10000
      // mockItem2: 3500 * 1 = 3500
      // mockItem3: 2000 * 3 = 6000
      // Total: 19500 (R$ 195,00)
      renderWithCart([mockItem1, mockItem2, mockItem3])

      expect(screen.getByText('R$ 195,00')).toBeInTheDocument()
    })

    it('should increase quantity when clicking + button', async () => {
      renderWithCart([mockItem1])
      const user = userEvent.setup()

      // Find the + button for the item
      const increaseButtons = screen.getAllByLabelText('Aumentar quantidade')
      expect(increaseButtons).toHaveLength(1)

      // Click increase button
      await user.click(increaseButtons[0])

      // Quantity should be 3 now
      const quantities = screen.getAllByText('3')
      expect(quantities.length).toBeGreaterThan(0)
    })

    it('should decrease quantity when clicking - button', async () => {
      renderWithCart([mockItem1])
      const user = userEvent.setup()

      // Find and click the - button
      const decreaseButtons = screen.getAllByLabelText('Diminuir quantidade')
      expect(decreaseButtons).toHaveLength(1)

      await user.click(decreaseButtons[0])

      // Quantity should be 1 now
      const quantities = screen.getAllByText('1')
      expect(quantities.length).toBeGreaterThan(0)
    })

    it('should remove item when clicking remove button', async () => {
      renderWithCart([mockItem1, mockItem2])
      const user = userEvent.setup()

      // Both items should be present
      expect(screen.getByText('Fralda Premium')).toBeInTheDocument()
      expect(screen.getByText('Fralda Conforto')).toBeInTheDocument()

      // Click remove button for first item
      const removeButtons = screen.getAllByLabelText(/Remover/)
      await user.click(removeButtons[0])

      // First item should be gone, second should remain
      expect(screen.queryByText('Fralda Premium')).not.toBeInTheDocument()
      expect(screen.getByText('Fralda Conforto')).toBeInTheDocument()
    })

    it('should show item quantity in stepper', () => {
      renderWithCart([mockItem1])

      // mockItem1 has quantity 2
      const quantities = screen.getAllByText('2')
      expect(quantities.length).toBeGreaterThan(0)
    })
  })

  describe('CTA buttons', () => {
    it('should display "Finalizar compra" button as disabled', () => {
      renderWithCart([mockItem1])

      const button = screen.getByRole('button', { name: /Finalizar compra/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled')
    })

    it('should display "Em breve" badge on "Finalizar compra" button', () => {
      renderWithCart([mockItem1])

      const badges = screen.getAllByText('Em breve')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should display "Buscar ofertas personalizadas" button as disabled (when LEILAO_ATIVO=false)', () => {
      renderWithCart([mockItem1])

      const button = screen.getByRole('button', { name: /Buscar ofertas personalizadas/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled')
    })

    it('should display "Em breve" badge on "Buscar ofertas personalizadas" when LEILAO_ATIVO=false', () => {
      renderWithCart([mockItem1])

      const badges = screen.getAllByText('Em breve')
      // Should have at least 2 badges (one for each CTA)
      expect(badges.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Supplier subtotals', () => {
    it('should display subtotal labels for each supplier', () => {
      renderWithCart([mockItem1, mockItem2, mockItem3])

      // Should have 2 subtotal labels (one per supplier)
      const subtotalElements = screen.getAllByText('Subtotal (fornecedor)')
      expect(subtotalElements).toHaveLength(2)
    })
  })
})
