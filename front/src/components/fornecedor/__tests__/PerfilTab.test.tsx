/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PerfilTab from '../PerfilTab'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)
const mockUpdateProfile = vi.fn()

const BASE_PROFILE = {
  role: 'fornecedor' as const,
  name: 'Joao Fornecedor',
  email: 'joao@distribuidorasul.com.br',
  cnpj: '11.222.333/0001-81',
  razaoSocial: 'Distribuidora Sul Ltda.',
  nomeFantasia: 'Distribuidora Sul',
  phone: '(11) 98765-4321',
  address: {
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100',
  },
}

function mockAuth(profile: typeof BASE_PROFILE | null) {
  mockUseAuth.mockReturnValue({
    user: null,
    profile,
    role: 'fornecedor',
    loading: false,
    signInGoogle: vi.fn(),
    signOutUser: vi.fn(),
    updateProfile: mockUpdateProfile,
  })
}

describe('PerfilTab (fornecedor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state when profile is null', () => {
    mockAuth(null)

    render(<PerfilTab />)

    expect(screen.getByText('Carregando perfil...')).toBeInTheDocument()
  })

  it('should render company data masked in view mode', () => {
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)

    expect(screen.getByText('Distribuidora Sul')).toBeInTheDocument()
    expect(screen.getByText('Distribuidora Sul Ltda.')).toBeInTheDocument()
    expect(screen.getByText('***.222.333/0001-**')).toBeInTheDocument()
  })

  it('should show validation error for invalid CNPJ on save', async () => {
    const user = userEvent.setup()
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.clear(cnpjInput)
    await user.type(cnpjInput, '11222333000180') // checksum errado (o valido termina em 81)

    await user.click(screen.getByText('Salvar'))

    expect(await screen.findByText('CNPJ inválido')).toBeInTheDocument()
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('should save valid data and show success toast', async () => {
    const user = userEvent.setup()
    mockUpdateProfile.mockResolvedValueOnce(undefined)
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))
    await user.click(screen.getByText('Salvar'))

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        cnpj: BASE_PROFILE.cnpj,
        razaoSocial: BASE_PROFILE.razaoSocial,
        nomeFantasia: BASE_PROFILE.nomeFantasia,
        phone: BASE_PROFILE.phone,
        address: BASE_PROFILE.address,
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Perfil salvo com sucesso!')
  })

  it('should show error toast when updateProfile rejects', async () => {
    const user = userEvent.setup()
    mockUpdateProfile.mockRejectedValueOnce(new Error('network error'))
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))
    await user.click(screen.getByText('Salvar'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao salvar perfil'))
  })
})
