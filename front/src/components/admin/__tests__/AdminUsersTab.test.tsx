/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminUsersTab from '../AdminUsersTab'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: 'uid-1', data: () => ({ role: 'comprador', name: 'Ana', email: 'ana@a.com' }) },
      { id: 'uid-2', data: () => ({ role: 'fornecedor', name: 'João', email: 'joao@a.com' }) },
    ],
  }),
}))

describe('AdminUsersTab', () => {
  it('renderiza os usuarios retornados do Firestore', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    expect(screen.getByText('João')).toBeInTheDocument()
    expect(screen.getByText('comprador')).toBeInTheDocument()
    expect(screen.getByText('fornecedor')).toBeInTheDocument()
  })

  it('mostra erro se a query do Firestore falhar (ex.: permission-denied)', async () => {
    const { getDocs } = await import('firebase/firestore')
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('permission-denied'))
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar usu/i)).toBeInTheDocument())
  })
})
