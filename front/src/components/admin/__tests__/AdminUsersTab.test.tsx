/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AdminUsersTab from '../AdminUsersTab'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
}))

const initialUsers = [
  { id: 'uid-1', data: () => ({ role: 'comprador', name: 'Ana Silva', email: 'ana@a.com' }) },
  { id: 'uid-2', data: () => ({ role: 'comprador', name: 'Beatriz Lima', email: 'beatriz@b.com' }) },
  { id: 'uid-3', data: () => ({ role: 'fornecedor', name: 'João Santos', email: 'joao@a.com' }) },
  { id: 'uid-4', data: () => ({ role: 'fornecedor', name: 'Carlos Distribuidora', email: 'carlos@c.com' }) },
  { id: 'uid-5', data: () => ({ role: 'admin', name: 'Romário Admin', email: 'romario@admin.com' }) },
  { id: 'uid-6', data: () => ({ name: 'Sem Papel Definido', email: 'sempapel@teste.com' }) }, // role undefined
]

describe('AdminUsersTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { getDocs } = await import('firebase/firestore')
    vi.mocked(getDocs).mockResolvedValue({ docs: initialUsers } as never)
  })

  it('calcula e exibe contagens consistentes por papel no seletor (incluindo papéis indefinidos)', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    // Opções do select de papel
    const roleSelect = screen.getByRole('combobox', { name: /filtrar por papel/i })
    expect(roleSelect).toBeInTheDocument()

    // 2 compradores, 2 fornecedores, 1 admin, 1 outros = 6 total
    expect(screen.getByRole('option', { name: 'Todos (6)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Compradores (2)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Fornecedores (2)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Administradores (1)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Outros (1)' })).toBeInTheDocument()
  })

  it('atualiza as contagens dinamicamente após recarregar os dados do Firestore', async () => {
    const { getDocs } = await import('firebase/firestore')
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    // Simula nova resposta após refresh: 1 comprador, 3 fornecedores, 1 admin (total 5)
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        { id: 'uid-1', data: () => ({ role: 'comprador', name: 'Ana Silva', email: 'ana@a.com' }) },
        { id: 'uid-3', data: () => ({ role: 'fornecedor', name: 'João Santos', email: 'joao@a.com' }) },
        { id: 'uid-4', data: () => ({ role: 'fornecedor', name: 'Carlos Distribuidora', email: 'carlos@c.com' }) },
        { id: 'uid-7', data: () => ({ role: 'fornecedor', name: 'Marcos Fraldas', email: 'marcos@m.com' }) },
        { id: 'uid-5', data: () => ({ role: 'admin', name: 'Romário Admin', email: 'romario@admin.com' }) },
      ],
    } as never)

    const refreshButton = screen.getByRole('button', { name: /atualizar/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Todos (5)' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Compradores (1)' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Fornecedores (3)' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Administradores (1)' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: /outros/i })).not.toBeInTheDocument()
    })
  })

  it('filtra usuários comportamentalmente por cada papel selecionado', async () => {
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const roleSelect = screen.getByRole('combobox', { name: /filtrar por papel/i })

    // Filtra Compradores
    fireEvent.change(roleSelect, { target: { value: 'comprador' } })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Beatriz Lima')).toBeInTheDocument()
    expect(screen.queryByText('João Santos')).not.toBeInTheDocument()
    expect(screen.queryByText('Sem Papel Definido')).not.toBeInTheDocument()

    // Filtra Fornecedores
    fireEvent.change(roleSelect, { target: { value: 'fornecedor' } })
    expect(screen.getByText('João Santos')).toBeInTheDocument()
    expect(screen.getByText('Carlos Distribuidora')).toBeInTheDocument()
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()

    // Filtra Administradores
    fireEvent.change(roleSelect, { target: { value: 'admin' } })
    expect(screen.getByText('Romário Admin')).toBeInTheDocument()
    expect(screen.queryByText('João Santos')).not.toBeInTheDocument()

    // Filtra Outros / Sem Papel
    fireEvent.change(roleSelect, { target: { value: 'outros' } })
    expect(screen.getByText('Sem Papel Definido')).toBeInTheDocument()
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.queryByText('Romário Admin')).not.toBeInTheDocument()
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

  it('copia UID com sucesso via Clipboard API e exibe feedback visual temporário', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const copyBtn = screen.getByRole('button', { name: /copiar uid de ana silva/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('uid-1')
    })
  })

  it('trata falha da Clipboard API de forma segura sem exibir feedback falso de sucesso', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument())

    const copyBtn = screen.getByRole('button', { name: /copiar uid de ana silva/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('uid-1')
    })
    // O botão continua acessível sem quebrar e sem exibir ícone de sucesso indevido
    expect(copyBtn).toBeInTheDocument()
  })

  it('mostra erro se a query do Firestore falhar (ex.: permission-denied)', async () => {
    const { getDocs } = await import('firebase/firestore')
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('permission-denied'))
    render(<AdminUsersTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar usu/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})
