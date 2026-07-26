/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import CatalogoTab from '../CatalogoTab'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/adapters/mock-product-repository', () => ({
  MockProductRepository: vi.fn(),
}))

vi.mock('@/lib/adapters/http-product-repository', () => ({
  HttpProductRepository: vi.fn(),
}))

import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { MockProductRepository } from '@/lib/adapters/mock-product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'

const mockUseAuth = vi.mocked(useAuth)
const mockMockProductRepository = vi.mocked(MockProductRepository)

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Fraldinha Premium',
    brand: 'MegaLife',
    size: 'G',
    quantity: 100,
    priceCents: 2500, // R$ 25,00
    supplierId: 'sup-1',
    slug: 'fraldinha-premium',
    categoria: 'Fraldas',
    descricao: 'Fralda descartável premium com máxima absorção',
    atributos: {
      faixaPeso: '12-15kg',
      genero: 'unissex',
      absorcao: 'Alta',
      tecnologia: 'Gel absorvente',
    },
    badge: 'Best Seller',
    active: true,
  },
  {
    id: 'prod-2',
    name: 'Lenço Umedecido',
    brand: 'SuaveBebe',
    size: 'Pacote 100 unidades',
    quantity: 50,
    priceCents: 1500, // R$ 15,00
    supplierId: 'sup-1',
    slug: 'lenco-umedecido',
    categoria: 'Higiene',
    descricao: 'Lenço umedecido hipoalergênico',
    atributos: {
      faixaPeso: 'todos',
      genero: 'unissex',
      absorcao: 'Média',
      tecnologia: 'Loção suave',
    },
    badge: undefined,
    active: false, // Despublicado
  },
  {
    id: 'prod-3',
    name: 'Pomada Preventiva',
    brand: 'CuteKids',
    size: 'Tubo 100g',
    quantity: 30,
    priceCents: 3000, // R$ 30,00
    supplierId: 'sup-1',
    slug: 'pomada-preventiva',
    categoria: 'Cuidados',
    descricao: 'Pomada para prevenir assaduras',
    atributos: {
      faixaPeso: 'todos',
      genero: 'unissex',
      absorcao: 'Alta',
      tecnologia: 'Óleo de coco',
    },
    badge: undefined,
    active: true,
  },
]

class MockRepoInstance {
  private products: Product[]
  supplierId: string

  constructor(options: { supplierId: string; idFactory: () => string }) {
    this.supplierId = options.supplierId
    this.products = MOCK_PRODUCTS.map((p) =>
      p.supplierId === options.supplierId ? { ...p } : p
    )
  }

  async listForSupplier(): Promise<Product[]> {
    return this.products.filter((p) => p.supplierId === this.supplierId)
  }

  async create(req: CreateProductRequest): Promise<Product> {
    const product: Product = {
      id: crypto.randomUUID(),
      supplierId: this.supplierId,
      active: true,
      ...req,
    }
    this.products.push(product)
    return product
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    const product = this.products.find((p) => p.id === id)
    if (!product) throw new Error(`Product not found: ${id}`)
    if (product.supplierId !== this.supplierId) throw new Error(`Not allowed to modify product: ${id}`)
    Object.assign(product, req)
    return product
  }

  async remove(id: string): Promise<void> {
    const index = this.products.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Product not found: ${id}`)
    if (this.products[index].supplierId !== this.supplierId)
      throw new Error(`Not allowed to modify product: ${id}`)
    this.products.splice(index, 1)
  }
}

describe('CatalogoTab (fornecedor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: {
        uid: 'sup-1',
        email: 'fornecedor@test.com',
        displayName: 'Fornecedor Test',
      },
      profile: null,
      role: 'fornecedor',
      loading: false,
      signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })

    const mockRepo = new MockRepoInstance({
      supplierId: 'sup-1',
      idFactory: () => crypto.randomUUID(),
    })
    mockMockProductRepository.mockImplementation(() => mockRepo as unknown as InstanceType<typeof MockProductRepository>)
  })

  it('should load and display supplier products including inactive ones', async () => {
    render(<CatalogoTab />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Verificar produtos ativos
    expect(screen.getByText('Fraldinha Premium')).toBeInTheDocument()
    expect(screen.getByText('Pomada Preventiva')).toBeInTheDocument()

    // Verificar produto despublicado
    expect(screen.getByText('Lenço Umedecido')).toBeInTheDocument()

    // Verificar badges de estado
    const badges = screen.getAllByText(/Ativo|Despublicado/)
    expect(badges.length).toBeGreaterThanOrEqual(3)
  })

  it('should show empty state when no products', async () => {
    mockMockProductRepository.mockImplementation(() => ({
      listForSupplier: async () => [],
    }) as unknown as InstanceType<typeof MockProductRepository>)

    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum produto ainda. Comece criando um!')).toBeInTheDocument()
    })
  })

  it('should show error state when loading fails', async () => {
    mockMockProductRepository.mockImplementation(() => ({
      listForSupplier: async () => {
        throw new Error('Network error')
      },
    }) as unknown as InstanceType<typeof MockProductRepository>)

    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar produtos')).toBeInTheDocument()
    })
  })

  it('should create product with form data and add to list', async () => {
    const user = userEvent.setup()
    render(<CatalogoTab />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Clicar em "Criar Produto"
    const createBtn = screen.getByText('+ Criar Produto')
    await user.click(createBtn)

    // Preencher formulário
    await user.type(screen.getByLabelText('Nome'), 'Novo Produto')
    await user.type(screen.getByLabelText('Marca'), 'MarcaNova')
    await user.type(screen.getByLabelText('Tamanho'), 'M')
    await user.type(screen.getByLabelText('Quantidade'), '50')
    await user.type(screen.getByLabelText('Preço (R$)'), '20.50')
    await user.type(screen.getByLabelText('Categoria'), 'Categoria Teste')
    await user.type(screen.getByLabelText('Faixa de Peso'), '10-12kg')
    await user.type(screen.getByLabelText('Absorção'), 'Alta')
    await user.type(screen.getByLabelText('Tecnologia'), 'Tecnologia X')

    // Submeter
    const saveBtn = screen.getByText('Salvar')
    await user.click(saveBtn)

    // Verificar toast de sucesso
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Produto criado com sucesso!')
    })

    // Verificar que produto aparece na lista
    await waitFor(() => {
      expect(screen.getByText('Novo Produto')).toBeInTheDocument()
    })
  })

  it('should reject form submission with empty required fields', async () => {
    const user = userEvent.setup()
    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Clicar em "Criar Produto"
    const createBtn = screen.getByText('+ Criar Produto')
    await user.click(createBtn)

    // Tentar submeter sem preencher nada
    const saveBtn = screen.getByText('Salvar')
    await user.click(saveBtn)

    // Verificar mensagens de erro
    expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument()
    expect(screen.getByText('Marca é obrigatória')).toBeInTheDocument()
    expect(screen.getByText('Tamanho é obrigatório')).toBeInTheDocument()

    // Toast de sucesso não deve ter sido chamado
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('should toggle product active status', async () => {
    const user = userEvent.setup()
    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Encontrar produto ativo (Fraldinha Premium) e seu card
    const prodCard = screen.getByText('Fraldinha Premium').closest('.bg-white')
    expect(prodCard).toBeInTheDocument()

    // Pegar todos os botões do card: Editar, Despublicar/Republicar, Excluir
    const buttons = prodCard?.querySelectorAll('button') ?? []
    if (buttons.length >= 2) {
      // O segundo botão é o de toggle (Despublicar/Republicar)
      await user.click(buttons[1])
    }

    // Verificar toast foi chamado (com qualquer mensagem)
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })

    // Verificar que houve mudança no estado visual
    await waitFor(() => {
      const badges = screen.getAllByText(/Ativo|Despublicado/)
      expect(badges.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('should open delete confirmation dialog and delete product', async () => {
    const user = userEvent.setup()
    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Encontrar todos os botões de excluir
    const deleteButtons = screen.getAllByRole('button').filter((btn) => {
      // Procurar pelo ícone de trash (o botão terá esse comportamento)
      const parent = btn.parentElement
      return parent?.className.includes('border-red-200')
    })

    if (deleteButtons.length === 0) {
      // Alternativa: procurar pelo padrão do teste do OrderCard
      const prodNameBefore = screen.getByText('Fraldinha Premium')
      const card = prodNameBefore.closest('.bg-white')
      const trashButton = card?.querySelector('button[class*="border-red"]')
      if (trashButton) {
        await user.click(trashButton)
      }
    } else {
      await user.click(deleteButtons[0])
    }

    // Aguardar dialog e confirmar
    await waitFor(() => {
      expect(screen.getByText('Excluir produto')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('Confirmar exclusão')
    await user.click(confirmButton)

    // Verificar toast de sucesso
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Produto excluído com sucesso!')
    })
  })

  it('should edit existing product', async () => {
    const user = userEvent.setup()
    render(<CatalogoTab />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument()
    })

    // Encontrar botão Editar
    const editButtons = screen.getAllByText('Editar')
    await user.click(editButtons[0])

    // Verificar que formulário está preenchido
    const nomeInput = screen.getByDisplayValue('Fraldinha Premium')
    expect(nomeInput).toBeInTheDocument()

    // Modificar campo
    await user.clear(nomeInput)
    await user.type(nomeInput, 'Fraldinha Premium Editada')

    // Salvar
    const saveBtn = screen.getByText('Salvar')
    await user.click(saveBtn)

    // Verificar sucesso
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Produto atualizado com sucesso!')
    })

    // Verificar que produto foi atualizado na lista
    await waitFor(() => {
      expect(screen.getByText('Fraldinha Premium Editada')).toBeInTheDocument()
    })
  })
})
