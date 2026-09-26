import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompradorRouteGroupLayout from '../layout'
import { useAuth, type AuthContextType } from '@/contexts/auth-context'
import { CartProvider } from '@/contexts/cart-context'
import { useRouter, usePathname } from 'next/navigation'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt || ''} />,
}))

function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: { uid: 'buyer-1', email: 'comprador@teste.com', displayName: 'Comprador Teste' },
    profile: null,
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

describe('CompradorRouteGroupLayout', () => {
  const mockPush = vi.fn()

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
    vi.mocked(usePathname).mockReturnValue('/minha-conta')
  })

  it('renders Header, main wrapper, children, and Footer for authenticated comprador', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())

    render(
      <CartProvider>
        <CompradorRouteGroupLayout>
          <div data-testid="comprador-child">Conteúdo da página</div>
        </CompradorRouteGroupLayout>
      </CartProvider>
    )

    // Main tag wraps children
    const child = screen.getByTestId('comprador-child')
    expect(child).toBeInTheDocument()
    expect(child.closest('main')).toBeInTheDocument()

    // Header is present with navigation
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Navegação principal/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Início/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Catálogo/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Sacola/i }).length).toBeGreaterThanOrEqual(1)

    // Footer is present
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('blocks unauthenticated users and redirects to /login via RoleProtectedRoute', () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: null,
        role: null,
      })
    )

    render(
      <CartProvider>
        <CompradorRouteGroupLayout>
          <div data-testid="comprador-child">Conteúdo da página</div>
        </CompradorRouteGroupLayout>
      </CartProvider>
    )

    expect(screen.queryByTestId('comprador-child')).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('blocks users with role fornecedor and redirects to /painel-fornecedor', () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'sup-1', email: 'fornecedor@teste.com', displayName: 'Fornecedor' },
        role: 'fornecedor',
        claims: { role: 'fornecedor' },
      })
    )

    render(
      <CartProvider>
        <CompradorRouteGroupLayout>
          <div data-testid="comprador-child">Conteúdo da página</div>
        </CompradorRouteGroupLayout>
      </CartProvider>
    )

    expect(screen.queryByTestId('comprador-child')).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/painel-fornecedor')
  })

  it('preserves Header and Footer navigation even when child renders an error or loading state', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())

    render(
      <CartProvider>
        <CompradorRouteGroupLayout>
          <div data-testid="orders-error">Erro ao carregar pedidos</div>
        </CompradorRouteGroupLayout>
      </CartProvider>
    )

    expect(screen.getByTestId('orders-error')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
