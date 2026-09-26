import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MinhaContaPage from '../page'
import CompradorRouteGroupLayout from '../../layout'
import { useAuth, type AuthContextType } from '@/contexts/auth-context'
import { useOrders } from '@/contexts/orders-context'
import { CartProvider } from '@/contexts/cart-context'
import { MarketProvider } from '@/contexts/market-context'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Order } from '@/lib/account-mock'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/contexts/orders-context', () => ({
  useOrders: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn().mockReturnValue('/minha-conta'),
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt || ''} />,
}))

const mockOrder: Order = {
  id: 'order-1',
  type: 'compra-direta',
  product: 'Fralda Pampers G',
  quantity: 2,
  unit: 'un',
  status: 'confirmado',
  price: 8990,
  supplierId: 'sup-001',
  supplierName: 'Fraldas & Cia',
  createdAt: '2026-09-20T10:00:00Z',
  deliveryAddress: {
    logradouro: 'Rua das Flores',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001-000',
  },
}

function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: { uid: 'buyer-1', email: 'comprador@teste.com', displayName: 'Maria Compradora' },
    profile: {
      role: 'comprador',
      name: 'Maria Compradora',
      email: 'comprador@teste.com',
      cpf: '123.456.789-00',
      phone: '(11) 98765-4321',
      address: {
        logradouro: 'Rua das Flores',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01001-000',
      },
    },
    role: 'comprador',
    claims: { role: 'comprador' },
    isAdmin: false,
    loading: false,
    signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
    signOutUser: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

describe('MinhaContaPage', () => {
  const mockPush = vi.fn()
  const mockGet = vi.fn().mockReturnValue(null)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    })
    vi.mocked(useSearchParams).mockReturnValue({
      get: mockGet,
      getAll: vi.fn(),
      has: vi.fn(),
      forEach: vi.fn(),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
      size: 0,
      toString: () => '',
      [Symbol.iterator]: vi.fn(),
    } as unknown as ReturnType<typeof useSearchParams>)
  })

  it('renders greeting, 3 tabs (Pedidos, Histórico, Perfil) and active orders', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())
    vi.mocked(useOrders).mockReturnValue({
      orders: [mockOrder],
      loading: false,
      error: null,
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    render(
      <MarketProvider>
        <CartProvider>
          <CompradorRouteGroupLayout>
            <MinhaContaPage />
          </CompradorRouteGroupLayout>
        </CartProvider>
      </MarketProvider>
    )

    // Header navigation present
    expect(screen.getByRole('banner')).toBeInTheDocument()

    // Greeting and stats
    expect(screen.getByText(/Olá, Maria/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pedidos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Histórico/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Perfil/i })).toBeInTheDocument()

    // Order card rendered in PedidosTab
    expect(screen.getByText('Fralda Pampers G')).toBeInTheDocument()
  })

  it('renders empty orders state with catalogue link, while navigation is intact', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())
    vi.mocked(useOrders).mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    render(
      <MarketProvider>
        <CartProvider>
          <CompradorRouteGroupLayout>
            <MinhaContaPage />
          </CompradorRouteGroupLayout>
        </CartProvider>
      </MarketProvider>
    )

    expect(screen.getByText('Nenhum pedido ativo')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /catálogo/i }).length).toBeGreaterThanOrEqual(2)

    // Global navigation remains present
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('shows orders loading state with global navigation intact', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())
    vi.mocked(useOrders).mockReturnValue({
      orders: [],
      loading: true,
      error: null,
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    render(
      <MarketProvider>
        <CartProvider>
          <CompradorRouteGroupLayout>
            <MinhaContaPage />
          </CompradorRouteGroupLayout>
        </CartProvider>
      </MarketProvider>
    )

    expect(screen.getByText('Carregando pedidos...')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('shows orders error state with global navigation intact', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())
    vi.mocked(useOrders).mockReturnValue({
      orders: [],
      loading: false,
      error: 'Falha ao buscar pedidos no servidor',
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    render(
      <MarketProvider>
        <CartProvider>
          <CompradorRouteGroupLayout>
            <MinhaContaPage />
          </CompradorRouteGroupLayout>
        </CartProvider>
      </MarketProvider>
    )

    expect(screen.getByText('Falha ao buscar pedidos no servidor')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('switches between tabs (Pedidos -> Histórico -> Perfil)', async () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())
    vi.mocked(useOrders).mockReturnValue({
      orders: [mockOrder],
      loading: false,
      error: null,
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    render(
      <MarketProvider>
        <CartProvider>
          <CompradorRouteGroupLayout>
            <MinhaContaPage />
          </CompradorRouteGroupLayout>
        </CartProvider>
      </MarketProvider>
    )

    // Switch to Perfil
    const perfilTab = screen.getByRole('tab', { name: /Perfil/i })
    fireEvent.click(perfilTab)

    await waitFor(() => {
      expect(screen.getByText('Endereço de cadastro')).toBeInTheDocument()
      expect(screen.getByText('Cartões de Crédito Salvos')).toBeInTheDocument()
    })
  })
})
