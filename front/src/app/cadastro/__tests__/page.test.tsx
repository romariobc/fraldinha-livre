import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CadastroPage from '../page'
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

describe('CadastroPage', () => {
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

  it('renders registration form and Continuar com Google button', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuth())

    render(<CadastroPage />)

    expect(screen.getByText('Criar conta grátis')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar minha conta grátis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeInTheDocument()
  })

  it('clicking Continuar com Google triggers signInGoogle', async () => {
    const signInGoogleMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: signInGoogleMock }))

    render(<CadastroPage />)

    const googleBtn = screen.getByRole('button', { name: /Continuar com Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(signInGoogleMock).toHaveBeenCalledTimes(1)
    })
  })

  it('handles signInGoogle error gracefully with error toast', async () => {
    const signInGoogleMock = vi.fn().mockRejectedValue(new Error('Popup blocked'))
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: signInGoogleMock }))

    render(<CadastroPage />)

    const googleBtn = screen.getByRole('button', { name: /Continuar com Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao conectar com Google')
    })
  })

  it('disables buttons during loading to prevent duplicate clicks', async () => {
    let resolveGoogle: () => void = () => {}
    const slowGoogleSignIn = vi.fn().mockImplementation(() => new Promise<void>((res) => { resolveGoogle = res }))
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signInGoogle: slowGoogleSignIn }))

    render(<CadastroPage />)

    const googleBtn = screen.getByRole('button', { name: /Continuar com Google/i })
    const submitBtn = screen.getByRole('button', { name: /Criar minha conta grátis/i })

    fireEvent.click(googleBtn)

    // Button text changes to "Conectando..." and both buttons disabled
    expect(screen.getByRole('button', { name: /Conectando/i })).toBeDisabled()
    expect(submitBtn).toBeDisabled()

    // Second click should not call signInGoogle again
    fireEvent.click(googleBtn)
    expect(slowGoogleSignIn).toHaveBeenCalledTimes(1)

    resolveGoogle()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continuar com Google/i })).not.toBeDisabled()
    })
  })

  it('submitting form triggers signUpEmail with entered credentials', async () => {
    const signUpEmailMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(createMockAuth({ signUpEmail: signUpEmailMock }))

    render(<CadastroPage />)

    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: 'Maria Silva' } })
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'maria@example.com' } })
    fireEvent.change(screen.getByLabelText(/Senha/i), { target: { value: 'senha123' } })

    fireEvent.click(screen.getByRole('button', { name: /Criar minha conta grátis/i }))

    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledWith('maria@example.com', 'senha123', 'Maria Silva')
    })
  })

  it('redirects to /onboarding when user is authenticated with role=null', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'novo@teste.com', displayName: null },
        role: null,
      })
    )

    render(<CadastroPage />)

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

    render(<CadastroPage />)

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

    render(<CadastroPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/minha-conta')
    })
  })

  it('redirects to sanitized target when redirect param is present', async () => {
    mockGet.mockReturnValue('/catalogo')
    vi.mocked(useAuth).mockReturnValue(
      createMockAuth({
        user: { uid: 'u123', email: 'buyer@teste.com', displayName: 'Comprador' },
        role: 'comprador',
      })
    )

    render(<CadastroPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/catalogo')
    })
  })
})
