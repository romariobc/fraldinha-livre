import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '../page'
import { useAuth, type AuthContextType } from '@/contexts/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt || ''} />,
}))

function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    profile: null,
    role: null,
    claims: null,
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

describe('LoginPage', () => {
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

  it('renders login form and Entrar com Google button', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())

    render(<LoginPage />)

    expect(screen.getByText('Entrar na conta')).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar na conta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar com Google/i })).toBeInTheDocument()
  })

  it('clicking Entrar com Google triggers signInGoogle', async () => {
    const signInGoogleMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: signInGoogleMock }))

    render(<LoginPage />)

    const googleBtn = screen.getByRole('button', { name: /Entrar com Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(signInGoogleMock).toHaveBeenCalledTimes(1)
    })
  })

  it('handles signInGoogle error gracefully with error toast', async () => {
    const signInGoogleMock = vi.fn().mockRejectedValue(new Error('Popup blocked'))
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: signInGoogleMock }))

    render(<LoginPage />)

    const googleBtn = screen.getByRole('button', { name: /Entrar com Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao fazer login com Google')
    })
  })

  it('disables buttons during loading to prevent duplicate clicks', async () => {
    let resolveGoogle: () => void = () => {}
    const slowGoogleSignIn = vi.fn().mockImplementation(() => new Promise<void>((res) => { resolveGoogle = res }))
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: slowGoogleSignIn }))

    render(<LoginPage />)

    const googleBtn = screen.getByRole('button', { name: /Entrar com Google/i })
    const submitBtn = screen.getByRole('button', { name: /Entrar na conta/i })

    fireEvent.click(googleBtn)

    expect(googleBtn).toBeDisabled()
    expect(submitBtn).toBeDisabled()

    fireEvent.click(googleBtn)
    expect(slowGoogleSignIn).toHaveBeenCalledTimes(1)

    resolveGoogle()
    await waitFor(() => {
      expect(googleBtn).not.toBeDisabled()
    })
  })

  it('submitting form triggers signInEmail with credentials', async () => {
    const signInEmailMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInEmail: signInEmailMock }))

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'user@teste.com' } })
    fireEvent.change(screen.getByLabelText(/Senha/i), { target: { value: 'minhasenha' } })

    fireEvent.click(screen.getByRole('button', { name: /Entrar na conta/i }))

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith('user@teste.com', 'minhasenha')
    })
  })

  it('redirects to /onboarding when user is authenticated with role=null', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'novo@teste.com', displayName: null },
        role: null,
      })
    )

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  it('redirects to /painel-fornecedor when user has role=fornecedor', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'sup@teste.com', displayName: 'Fornecedor' },
        role: 'fornecedor',
      })
    )

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/painel-fornecedor')
    })
  })

  it('redirects to /minha-conta when user has role=comprador without redirect param', async () => {
    mockGet.mockReturnValue(null)
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'buyer@teste.com', displayName: 'Comprador' },
        role: 'comprador',
      })
    )

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/minha-conta')
    })
  })

  it('redirects to sanitized target when redirect param is present', async () => {
    mockGet.mockReturnValue('/sacola')
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'buyer@teste.com', displayName: 'Comprador' },
        role: 'comprador',
      })
    )

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sacola')
    })
  })
})
