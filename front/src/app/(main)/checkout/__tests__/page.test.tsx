/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider } from '@/contexts/cart-context'
import { AuthProvider } from '@/contexts/auth-context'
import { OrdersProvider } from '@/contexts/orders-context'
import { MarketProvider } from '@/contexts/market-context'
import type { CartItem } from '@/lib/domain/cart'
import { type ReactNode } from 'react'
import CheckoutPage from '../page'
import { vi } from 'vitest'

// Mock firebase
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null)
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}))

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

// Mock next/navigation (useRouter usado pela guarda de login — D-024)
let mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock do auth-context: por padrao logado (a guarda D-024 exige login para o checkout).
// AuthProvider vira passthrough; useAuth e controlado por teste via vi.mocked.
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import { useAuth } from '@/contexts/auth-context'

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: { uid: 'u1', email: 'ana@example.com', displayName: 'Ana Lima' },
    profile: null,
    role: 'comprador',
    loading: false,
    signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
    signOutUser: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

// Helper to render page inside providers
function renderCheckout(items: CartItem[]) {
  // Pre-seed localStorage before rendering
  if (items.length > 0) {
    window.localStorage.setItem('fl.cart.v1', JSON.stringify(items))
  }

  return render(
    <CartProvider>
      <AuthProvider>
        <OrdersProvider>
          <MarketProvider>
            <CheckoutPage />
          </MarketProvider>
        </OrdersProvider>
      </AuthProvider>
    </CartProvider>
  )
}

// Mock items for testing (2 suppliers)
const mockItem1: CartItem = {
  productId: 'prod-1',
  productName: 'Fralda Premium',
  supplierId: 'supplier-1',
  supplierName: 'Fornecedor A',
  unitPrice: 5000,
  quantity: 2,
  unit: 'cx',
}

const mockItem2: CartItem = {
  productId: 'prod-2',
  productName: 'Fralda Conforto',
  supplierId: 'supplier-2',
  supplierName: 'Fornecedor B',
  unitPrice: 3500,
  quantity: 1,
  unit: 'cx',
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    mockPush = vi.fn()
    vi.mocked(useAuth).mockReturnValue(authValue())
  })

  describe('Guarda de login (D-024)', () => {
    it('redireciona para /login?redirect=/checkout quando deslogado', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ user: null }))
      renderCheckout([mockItem1])

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/checkout')
      // Nao renderiza os passos do checkout
      expect(screen.queryByText('Endereço de entrega')).not.toBeInTheDocument()
    })

    it('mostra "Carregando..." enquanto o auth resolve', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ user: null, loading: true }))
      renderCheckout([mockItem1])

      expect(screen.getByText('Carregando...')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Empty cart', () => {
    it('should display empty state when cart is empty', () => {
      renderCheckout([])

      expect(screen.getByText('Sua sacola está vazia')).toBeInTheDocument()
      expect(screen.getByText('Comece a comprar para preencher sua sacola')).toBeInTheDocument()
    })

    it('should display link to catalogo in empty state', () => {
      renderCheckout([])

      const link = screen.getByRole('link', { name: /Explorar catálogo/i })
      expect(link).toHaveAttribute('href', '/catalogo')
    })
  })

  describe('Passo: Endereco', () => {
    it('should render endereco step with cart items', () => {
      renderCheckout([mockItem1, mockItem2])

      expect(screen.getByText('Endereço de entrega')).toBeInTheDocument()
      expect(screen.getByText('Usar endereço do cadastro')).toBeInTheDocument()
      expect(screen.getByText('Outro endereço')).toBeInTheDocument()
    })

    it('should display default address when using cadastro', () => {
      renderCheckout([mockItem1])

      // Default address from MOCK_USER
      expect(screen.getByText(/Av. Paulista/)).toBeInTheDocument()
      expect(screen.getByText(/São Paulo/)).toBeInTheDocument()
    })

    it('should keep continue button disabled while custom address is invalid', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Select custom address option
      const customRadio = screen.getAllByRole('radio')[1]
      await user.click(customRadio)

      // Continue button should be disabled (custom address has empty fields)
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      expect(continueButton).toBeDisabled()
    })

    it('should enable continue button when using default address', async () => {
      renderCheckout([mockItem1])

      // Default address is already valid (using cadastro)
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      expect(continueButton).not.toBeDisabled()
    })

    it('should enable continue button when custom address is valid', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Select custom address
      const customRadio = screen.getAllByRole('radio')[1]
      await user.click(customRadio)

      // Fill required fields
      const inputs = screen.getAllByPlaceholderText(/\*/i)
      await user.type(inputs[0], 'Rua A')
      await user.type(inputs[1], '123')
      await user.type(inputs[2], '12345-678')
      await user.type(inputs[3], 'São Paulo')
      await user.type(inputs[4], 'SP')

      // Continue button should be enabled
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      expect(continueButton).not.toBeDisabled()
    })

    it('should navigate to revisao when continue is clicked', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText('Revisão do pedido')).toBeInTheDocument()
    })
  })

  describe('Passo: Revisao', () => {
    it('should display items grouped by supplier', async () => {
      renderCheckout([mockItem1, mockItem2])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText('Revisão do pedido')).toBeInTheDocument()
      expect(screen.getByText('Fornecedor A')).toBeInTheDocument()
      expect(screen.getByText('Fornecedor B')).toBeInTheDocument()
    })

    it('should display items with quantities and totals', async () => {
      renderCheckout([mockItem1, mockItem2])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText(/Fralda Premium × 2/)).toBeInTheDocument()
      expect(screen.getByText(/Fralda Conforto × 1/)).toBeInTheDocument()
    })

    it('should display total amount', async () => {
      renderCheckout([mockItem1, mockItem2])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      // Total: (5000 * 2) + (3500 * 1) = 10000 + 3500 = 13500 (R$ 135,00)
      expect(screen.getByText('R$ 135,00')).toBeInTheDocument()
    })

    it('should display delivery address', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText(/Av. Paulista/)).toBeInTheDocument()
      expect(screen.getByText(/São Paulo/)).toBeInTheDocument()
    })

    it('should navigate back to endereco when back button is clicked', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton1 = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton1)

      expect(screen.getByText('Revisão do pedido')).toBeInTheDocument()

      // Click back
      const backButton = screen.getByRole('button', { name: /Voltar/i })
      await user.click(backButton)

      expect(screen.getByText('Endereço de entrega')).toBeInTheDocument()
    })

    it('should navigate to pagamento when continue is clicked', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to revisao
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      // Click continue to go to pagamento
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText('Forma de pagamento')).toBeInTheDocument()
    })
  })

  describe('Passo: Pagamento (STUB)', () => {
    it('should display payment method selection', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to pagamento
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText('Forma de pagamento')).toBeInTheDocument()
      expect(screen.getByText('Pix')).toBeInTheDocument()
      expect(screen.getByText('Cartão de crédito')).toBeInTheDocument()
    })

    it('should display simulated payment warning', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to pagamento
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      expect(screen.getByText(/Pagamento simulado/)).toBeInTheDocument()
      expect(screen.getByText(/nenhuma cobrança real/)).toBeInTheDocument()
    })

    it('should navigate to confirmacao when pagar is clicked', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to pagamento
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      // Click pagar
      const pagarButton = screen.getByRole('button', { name: /Pagar/i })
      await user.click(pagarButton)

      expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument()
    })

    it('should select pix by default', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate to pagamento
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      const pixRadio = screen.getByDisplayValue('pix') as HTMLInputElement
      expect(pixRadio.checked).toBe(true)
    })
  })

  describe('Passo: Confirmacao', () => {
    it('should display success message', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate through all steps
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      const pagarButton = screen.getByRole('button', { name: /Pagar/i })
      await user.click(pagarButton)

      expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument()
      expect(screen.getByText(/Acompanhe seu pedido/)).toBeInTheDocument()
    })

    it('should display link to minha-conta', async () => {
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate through all steps
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      const pagarButton = screen.getByRole('button', { name: /Pagar/i })
      await user.click(pagarButton)

      expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Ver meus pedidos/i })
      expect(link).toHaveAttribute('href', '/minha-conta')
    })

    it('should clear cart after clicking pagar (S5b)', async () => {
      // This test verifies that the cart IS cleared when reaching confirmacao
      renderCheckout([mockItem1])
      const user = userEvent.setup()

      // Navigate through all steps
      let continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)
      const pagarButton = screen.getByRole('button', { name: /Pagar/i })
      await user.click(pagarButton)

      // Verify we're at confirmacao
      expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument()

      // Verify that cart was cleared
      // Check localStorage to ensure it is empty
      const stored = window.localStorage.getItem('fl.cart.v1')
      expect(stored).toBe('[]')
    })
  })

  describe('Multiple suppliers', () => {
    it('should display each supplier as separate section', async () => {
      renderCheckout([mockItem1, mockItem2])
      const user = userEvent.setup()

      // Navigate to revisao
      const continueButton = screen.getByRole('button', { name: /Continuar/i })
      await user.click(continueButton)

      // Both suppliers should be visible
      expect(screen.getByText('Fornecedor A')).toBeInTheDocument()
      expect(screen.getByText('Fornecedor B')).toBeInTheDocument()
    })
  })
})
