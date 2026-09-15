import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OnboardingPage from '../page'
import { useAuth } from '@/contexts/auth-context'
import { setDoc } from 'firebase/firestore'
import { auth } from '@/lib/firebase'
import { apiFetch } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  setDoc: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('fresh-jwt-token'),
    },
  },
  db: {},
}))

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt || ''} />,
}))

describe('OnboardingPage — Provisionamento e Renovação de Token (AUTH-001)', () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ push: mockPush })
  })

  it('provisiona claim comprador, renova ID token e salva perfil no Firestore', async () => {
    ;(useAuth as any).mockReturnValue({
      user: { uid: 'user-123', email: 'mae@teste.com', displayName: 'Maria' },
      role: null,
      loading: false,
    })

    ;(apiFetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, role: 'comprador', claims: { comprador: true } }),
    })

    render(<OnboardingPage />)

    const compradorBtn = screen.getByText('Sou Comprador').closest('button')!
    fireEvent.click(compradorBtn)

    await waitFor(() => {
      // 1. Verifica chamada para POST /auth/claim com role comprador
      expect(apiFetch).toHaveBeenCalledWith('/auth/claim', {
        method: 'POST',
        body: JSON.stringify({ role: 'comprador' }),
      })

      // 2. Verifica renovação do token via getIdToken(true)
      expect(auth.currentUser?.getIdToken).toHaveBeenCalledWith(true)

      // 3. Verifica persistência do perfil no Firestore
      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123' }),
        expect.objectContaining({
          role: 'comprador',
          email: 'mae@teste.com',
          name: 'Maria',
        })
      )

      // 4. Redirecionamento para /minha-conta
      expect(mockPush).toHaveBeenCalledWith('/minha-conta')
      expect(toast.success).toHaveBeenCalledWith('Bem-vindo, comprador!')
    })
  })

  it('provisiona claim fornecedor, renova ID token e redireciona para painel-fornecedor', async () => {
    ;(useAuth as any).mockReturnValue({
      user: { uid: 'user-forn', email: 'forn@teste.com', displayName: 'Distribuidora' },
      role: null,
      loading: false,
    })

    ;(apiFetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, role: 'fornecedor', claims: { fornecedor: true } }),
    })

    render(<OnboardingPage />)

    const fornecedorBtn = screen.getByText('Sou Fornecedor').closest('button')!
    fireEvent.click(fornecedorBtn)

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/auth/claim', {
        method: 'POST',
        body: JSON.stringify({ role: 'fornecedor' }),
      })

      expect(auth.currentUser?.getIdToken).toHaveBeenCalledWith(true)

      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-forn' }),
        expect.objectContaining({
          role: 'fornecedor',
          email: 'forn@teste.com',
        })
      )

      expect(mockPush).toHaveBeenCalledWith('/painel-fornecedor')
      expect(toast.success).toHaveBeenCalledWith('Bem-vindo, fornecedor!')
    })
  })

  it('se o backend rejeitar o provisionamento, exibe toast de erro e NÃO grava no Firestore', async () => {
    ;(useAuth as any).mockReturnValue({
      user: { uid: 'user-fail', email: 'fail@teste.com', displayName: 'Falha' },
      role: null,
      loading: false,
    })

    ;(apiFetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid role' }),
    })

    render(<OnboardingPage />)

    const compradorBtn = screen.getByText('Sou Comprador').closest('button')!
    fireEvent.click(compradorBtn)

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled()
      expect(setDoc).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalled()
    })
  })
})
