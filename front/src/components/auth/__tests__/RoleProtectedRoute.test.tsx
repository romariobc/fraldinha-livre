/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import RoleProtectedRoute from '../RoleProtectedRoute'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/',
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

describe('RoleProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading spinner when loading is true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      role: null,
      loading: true,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['comprador']}>
        <div>Conteúdo Protegido</div>
      </RoleProtectedRoute>
    )

    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should redirect to /login when user is unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      role: null,
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['comprador']}>
        <div>Conteúdo Protegido</div>
      </RoleProtectedRoute>
    )

    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument()
  })

  it('should render children when user role is allowed', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', email: 'comprador@example.com', displayName: 'Comprador' },
      profile: null,
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['comprador']}>
        <div>Conteúdo Protegido Comprador</div>
      </RoleProtectedRoute>
    )

    expect(screen.getByText('Conteúdo Protegido Comprador')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should redirect fornecedor to /painel-fornecedor when accessing comprador-only route', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-2', email: 'fornecedor@example.com', displayName: 'Fornecedor' },
      profile: null,
      role: 'fornecedor',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['comprador']}>
        <div>Conteúdo Exclusivo Comprador</div>
      </RoleProtectedRoute>
    )

    expect(mockPush).toHaveBeenCalledWith('/painel-fornecedor')
    expect(screen.queryByText('Conteúdo Exclusivo Comprador')).not.toBeInTheDocument()
  })

  it('should redirect comprador to /minha-conta when accessing fornecedor-only route', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-3', email: 'comprador@example.com', displayName: 'Comprador' },
      profile: null,
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['fornecedor']}>
        <div>Conteúdo Exclusivo Fornecedor</div>
      </RoleProtectedRoute>
    )

    expect(mockPush).toHaveBeenCalledWith('/minha-conta')
    expect(screen.queryByText('Conteúdo Exclusivo Fornecedor')).not.toBeInTheDocument()
  })

  it('should render children when user role is included in allowedRoles list', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-4', email: 'fornecedor@example.com', displayName: 'Fornecedor' },
      profile: null,
      role: 'fornecedor',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    render(
      <RoleProtectedRoute allowedRoles={['comprador', 'fornecedor']}>
        <div>Conteúdo Geral</div>
      </RoleProtectedRoute>
    )

    expect(screen.getByText('Conteúdo Geral')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
