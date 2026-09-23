/// <reference types="vitest/globals" />
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../auth-context'

// Mocks do Firebase
const mockOnAuthStateChanged = vi.fn()
const mockGetRedirectResult = vi.fn().mockResolvedValue(null)
const mockGetDoc = vi.fn()
const mockDoc = vi.fn((_db, col, id) => ({ path: `${col}/${id}` }))

vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  googleProvider: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) => mockOnAuthStateChanged(auth, cb),
  getRedirectResult: () => mockGetRedirectResult(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: (db: unknown, col: string, id: string) => mockDoc(db, col, id),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  updateDoc: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true }),
}))

function TestConsumer() {
  const { user, profile, role, claims, isAdmin, loading } = useAuth()
  if (loading) return <div>Carregando...</div>
  return (
    <div>
      <span data-testid="user-uid">{user?.uid || 'no-user'}</span>
      <span data-testid="user-role">{role || 'no-role'}</span>
      <span data-testid="profile-role">{profile?.role || 'no-profile-role'}</span>
      <span data-testid="is-admin">{isAdmin ? 'true' : 'false'}</span>
      <span data-testid="has-admin-claim">{claims?.admin ? 'true' : 'false'}</span>
    </div>
  )
}

describe('AuthContext — Segurança e Isolamento de Autoridade Administrativa', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ADMIN_UID

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_ADMIN_UID = 'LEGACY_ADMIN_UID_123'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_UID = originalEnv
  })

  it('SEGURANÇA: Usuário comum com role: admin no Firestore NÃO se torna admin na UI sem Custom Claims', async () => {
    // Simula usuário logado sem Custom Claims no JWT
    const mockFbUser = {
      uid: 'user-hacker-456',
      email: 'hacker@teste.com',
      displayName: 'Hacker',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockFbUser)
      return vi.fn()
    })

    // Firestore contém role: 'admin' forjado/adicionado diretamente
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        role: 'admin',
        name: 'Hacker',
        email: 'hacker@teste.com',
      }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-uid')).toHaveTextContent('user-hacker-456')
    })

    // O profile guarda os dados brutos para exibição
    expect(screen.getByTestId('profile-role')).toHaveTextContent('admin')
    // Porém a autoridade efetiva NÃO é admin e isAdmin é FALSE
    expect(screen.getByTestId('user-role')).toHaveTextContent('no-role')
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
  })

  it('AUTORIDADE LEGÍTIMA: Usuário com Custom Claim admin: true é reconhecido como admin', async () => {
    const mockAdminUser = {
      uid: 'user-admin-real',
      email: 'admin@fraldinhalivre.com.br',
      displayName: 'Admin Real',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true } }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockAdminUser)
      return vi.fn()
    })

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        role: 'admin',
        name: 'Admin Real',
        email: 'admin@fraldinhalivre.com.br',
      }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-uid')).toHaveTextContent('user-admin-real')
    })

    expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin')
  })

  it('AUTORIDADE LEGÍTIMA: Usuário com Custom Claim role: admin é reconhecido como admin', async () => {
    const mockAdminUser = {
      uid: 'user-admin-role-real',
      email: 'admin2@fraldinhalivre.com.br',
      displayName: 'Admin Role Real',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'admin' } }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockAdminUser)
      return vi.fn()
    })

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        role: 'admin',
        name: 'Admin Role Real',
        email: 'admin2@fraldinhalivre.com.br',
      }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-uid')).toHaveTextContent('user-admin-role-real')
    })

    expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin')
  })

  it('FALLBACK TEMPORÁRIO: Usuário com UID correspondente ao NEXT_PUBLIC_ADMIN_UID é aceito', async () => {
    const mockLegacyUser = {
      uid: 'LEGACY_ADMIN_UID_123',
      email: 'romariobc@gmail.com',
      displayName: 'Romário',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockLegacyUser)
      return vi.fn()
    })

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        role: 'admin',
        name: 'Romário',
        email: 'romariobc@gmail.com',
      }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-uid')).toHaveTextContent('LEGACY_ADMIN_UID_123')
    })

    expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin')
  })

  it('COMPATIBILIDADE: Usuário comprador com role legítimo no Firestore recebe role comprador', async () => {
    const mockCompradorUser = {
      uid: 'user-comprador-789',
      email: 'comprador@teste.com',
      displayName: 'Comprador',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockCompradorUser)
      return vi.fn()
    })

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        role: 'comprador',
        name: 'Comprador',
        email: 'comprador@teste.com',
      }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-uid')).toHaveTextContent('user-comprador-789')
    })

    expect(screen.getByTestId('user-role')).toHaveTextContent('comprador')
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
  })
})
