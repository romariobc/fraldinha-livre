/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { type ReactNode } from 'react'
import AdminPage from '../page'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}))

let mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))
import { useAuth } from '@/contexts/auth-context'

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  const isAdminCalculated = overrides.isAdmin ?? (
    overrides.role === 'admin' ||
    Boolean(overrides.claims?.admin) ||
    Boolean(overrides.user?.uid && overrides.user.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
  )

  return {
    user: null, profile: null, role: null, claims: null, loading: false,
    signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn(),
    signOutUser: vi.fn(), updateProfile: vi.fn(),
    ...overrides,
    isAdmin: overrides.isAdmin !== undefined ? overrides.isAdmin : isAdminCalculated,
  }
}

describe('AdminPage — gate de acesso', () => {
  beforeEach(() => { mockPush = vi.fn() })

  it('enquanto loading=true, nao redireciona nem renderiza conteudo', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }))
    render(<AdminPage />)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('usuario deslogado → redireciona para /', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: false, user: null, isAdmin: false }))
    render(<AdminPage />)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('usuario logado mas nao-admin → redireciona para /', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: 'uid-qualquer', email: 'a@a.com', displayName: 'A' },
      isAdmin: false,
    }))
    render(<AdminPage />)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('usuario logado com UID admin legado → renderiza as 3 abas, sem redirecionar', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: process.env.NEXT_PUBLIC_ADMIN_UID!, email: 'admin@a.com', displayName: 'Admin' },
      isAdmin: true,
    }))
    render(<AdminPage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
    expect(screen.getByText('Produtos')).toBeInTheDocument()
  })

  it('usuario logado com Custom Claim role: admin → renderiza as 3 abas, sem redirecionar (RBAC)', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: 'uid-custom-admin', email: 'admin@a.com', displayName: 'Admin' },
      role: 'admin',
      isAdmin: true,
    }))
    render(<AdminPage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
    expect(screen.getByText('Produtos')).toBeInTheDocument()
  })

  it('usuario logado com Custom Claim admin: true → renderiza as 3 abas, sem redirecionar (RBAC)', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: 'uid-custom-claim-admin', email: 'admin@a.com', displayName: 'Admin' },
      claims: { admin: true },
      isAdmin: true,
    }))
    render(<AdminPage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
    expect(screen.getByText('Produtos')).toBeInTheDocument()
  })
})
