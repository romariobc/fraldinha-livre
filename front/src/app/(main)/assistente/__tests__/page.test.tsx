/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { type ReactNode } from 'react'
import AssistentePage from '../page'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))

let mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))
import { useAuth } from '@/contexts/auth-context'

vi.mock('@/components/assistente/ChatUI', () => ({
  default: () => <div data-testid="chat-ui" />,
}))

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null, profile: null, role: null, loading: false,
    signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn(),
    signOutUser: vi.fn(), updateProfile: vi.fn(),
    ...overrides,
  }
}

describe('AssistentePage — gate de acesso', () => {
  beforeEach(() => { mockPush = vi.fn() })

  it('enquanto loading=true, nao redireciona nem renderiza o chat', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }))
    render(<AssistentePage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByTestId('chat-ui')).not.toBeInTheDocument()
  })

  it('usuario deslogado → redireciona para /login?redirect=/assistente', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: false, user: null }))
    render(<AssistentePage />)
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=/assistente')
  })

  it('usuario logado → renderiza o ChatUI, sem redirecionar', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: 'uid-comprador', email: 'a@a.com', displayName: 'A' },
    }))
    render(<AssistentePage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('chat-ui')).toBeInTheDocument()
  })
})
