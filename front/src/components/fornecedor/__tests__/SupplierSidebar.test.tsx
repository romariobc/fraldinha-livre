/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { SupplierSidebar } from '../SupplierSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  usePathname: vi.fn(() => '/painel-fornecedor'),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

describe('SupplierSidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Ver Catálogo B2C" pointing to /catalogo/fornecedor/${user.uid} when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: 'supplier-uid-123',
        displayName: 'Distribuidora Teste',
        email: 'dist@teste.com',
      } as any,
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
      <SidebarProvider defaultOpen={true}>
        <SupplierSidebar />
      </SidebarProvider>
    )

    const catalogLink = screen.getByRole('link', { name: /ver catálogo b2c/i })
    expect(catalogLink).toBeInTheDocument()
    expect(catalogLink).toHaveAttribute('href', '/catalogo/fornecedor/supplier-uid-123')
    expect(catalogLink).toHaveAttribute('target', '_blank')
  })

  it('falls back to /catalogo when user is not authenticated or has no uid', () => {
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
      <SidebarProvider defaultOpen={true}>
        <SupplierSidebar />
      </SidebarProvider>
    )

    const catalogLink = screen.getByRole('link', { name: /ver catálogo b2c/i })
    expect(catalogLink).toBeInTheDocument()
    expect(catalogLink).toHaveAttribute('href', '/catalogo')
  })

  it('falls back to /catalogo when user has empty uid string', () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: '',
        displayName: 'Distribuidora Sem UID',
        email: 'anon@teste.com',
      } as any,
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
      <SidebarProvider defaultOpen={true}>
        <SupplierSidebar />
      </SidebarProvider>
    )

    const catalogLink = screen.getByRole('link', { name: /ver catálogo b2c/i })
    expect(catalogLink).toBeInTheDocument()
    expect(catalogLink).toHaveAttribute('href', '/catalogo')
  })
})
