/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminUsersTab from '../AdminUsersTab'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: 'uid-1', data: () => ({ role: 'comprador', name: 'Ana Silva', email: 'ana@a.com', phone: '11999990001' }) },
      { id: 'uid-2', data: () => ({ role: 'fornecedor', name: 'João Santos', email: 'joao@a.com', cnpj: '12345678000199' }) },
      { id: 'uid-3', data: () => ({ role: 'admin', name: 'Romário Admin', email: 'romario@admin.com' }) },
    ],
  }),
}))

describe('AdminUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza os usuarios retornados do Firestore com seus papéis', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())
    expect(screen.getByText('João Santos')).toBeInTheDocument()
    expect(screen.getByText('Romário Admin')).toBeInTheDocument()
    expect(screen.getByText('comprador')).toBeInTheDocument()
    expect(screen.getByText('fornecedor')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('filtra usuários por busca de texto (nome ou e-mail)', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/buscar por nome/i)
    fireEvent.change(searchInput, { target: { value: 'João' } })

    expect(screen.getByText('João Santos')).toBeInTheDocument()
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.queryByText('Romário Admin')).not.toBeInTheDocument()
  })

  it('filtra usuários por papel selecionado', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const roleSelect = screen.getByRole('combobox', { name: /filtrar por papel/i })
    fireEvent.change(roleSelect, { target: { value: 'fornecedor' } })

    expect(screen.getByText('João Santos')).toBeInTheDocument()
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.queryByText('Romário Admin')).not.toBeInTheDocument()
  })

  it('exibe mensagem amigável e botão de limpar filtros quando nenhum usuário é encontrado', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/buscar por nome/i)
    fireEvent.change(searchInput, { target: { value: 'inexistente_12345' } })

    expect(screen.getByText(/nenhum usuário encontrado/i)).toBeInTheDocument()

    const clearButton = screen.getByRole('button', { name: /limpar filtros/i })
    fireEvent.click(clearButton)

    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('recarrega os usuários ao clicar no botão de atualizar', async () => {
    const { getDocs } = await import('firebase/firestore')
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const refreshButton = screen.getByRole('button', { name: /atualizar/i })
    fireEvent.click(refreshButton)

    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2))
  })

  it('mostra erro se a query do Firestore falhar (ex.: permission-denied)', async () => {
    const { getDocs } = await import('firebase/firestore')
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('permission-denied'))
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar usu/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})
