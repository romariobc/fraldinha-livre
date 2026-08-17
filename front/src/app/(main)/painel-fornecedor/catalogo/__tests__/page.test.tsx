/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import CatalogoPage from '../page'

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve('test-token'),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'sup-1', email: 'fornecedor@teste.com' },
    role: 'fornecedor',
  })),
}))

vi.mock('@/lib/adapters/mock-product-repository', () => ({
  MockProductRepository: vi.fn(),
}))

import { toast } from 'sonner'
import { MockProductRepository } from '@/lib/adapters/mock-product-repository'
import type { Product, UpdateProductRequest } from '@contracts'

const mockMockProductRepository = vi.mocked(MockProductRepository)

const MOCK_SUPPLIER_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Fralda Pampers Confort Sec M',
    brand: 'Pampers',
    size: 'M',
    quantity: 100,
    priceCents: 3890,
    supplierId: 'sup-1',
    slug: 'fralda-pampers-confort-sec-m',
    categoria: 'fraldas-descartaveis',
    descricao: 'Fralda confortável com máxima absorção.',
    atributos: {
      faixaPeso: '5–9 kg',
      genero: 'unissex',
      absorcao: 'até 12 horas',
      tecnologia: 'Canais de Ar',
      erpId: 'ERP-SKU-1001',
    },
    badge: 'Mais Vendido',
    active: true,
  },
  {
    id: 'prod-2',
    name: 'Fralda Huggies Supreme Care G',
    brand: 'Huggies',
    size: 'G',
    quantity: 45,
    priceCents: 4450,
    supplierId: 'sup-1',
    slug: 'fralda-huggies-supreme-care-g',
    categoria: 'fraldas-descartaveis',
    descricao: 'Toque suave com aloe vera.',
    atributos: {
      faixaPeso: '9–12,5 kg',
      genero: 'unissex',
      absorcao: 'até 12 horas',
      tecnologia: 'Toque Suave',
    },
    active: false, // Despublicado
  },
]

describe('CatalogoPage (/painel-fornecedor/catalogo)', () => {
  let mockRepoInstance: {
    listForSupplier: ReturnType<typeof vi.fn>
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    let prods = [...MOCK_SUPPLIER_PRODUCTS]

    mockRepoInstance = {
      listForSupplier: vi.fn().mockImplementation(async () => [...prods]),
      list: vi.fn().mockImplementation(async () => prods.filter((p) => p.active)),
      create: vi.fn().mockImplementation(async (req) => {
        const created: Product = {
          id: 'prod-' + Date.now(),
          supplierId: 'sup-1',
          active: true,
          ...req,
        }
        prods.push(created)
        return created
      }),
      update: vi.fn().mockImplementation(async (id: string, req: UpdateProductRequest) => {
        const idx = prods.findIndex((p) => p.id === id)
        if (idx !== -1) {
          prods[idx] = { ...prods[idx], ...req }
          return prods[idx]
        }
        throw new Error('Not found')
      }),
      remove: vi.fn().mockImplementation(async (id: string) => {
        prods = prods.filter((p) => p.id !== id)
      }),
    }

    mockMockProductRepository.mockImplementation(
      () => mockRepoInstance as unknown as InstanceType<typeof MockProductRepository>
    )
  })

  it('renders catalog page with KPI summary and supplier products', async () => {
    render(<CatalogoPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Meu Catálogo/i })).toBeInTheDocument()
    })

    expect(screen.getByText('Total de Produtos')).toBeInTheDocument()
    expect(screen.getByText('Ativos no Marketplace')).toBeInTheDocument()
    expect(screen.getByText('Despublicados')).toBeInTheDocument()
    expect(screen.getByText('Estoque Consolidado')).toBeInTheDocument()

    // Products displayed
    expect(screen.getByText('Fralda Pampers Confort Sec M')).toBeInTheDocument()
    expect(screen.getByText('Fralda Huggies Supreme Care G')).toBeInTheDocument()
    expect(screen.getByText('R$ 38,90')).toBeInTheDocument()
    expect(screen.getByText('R$ 44,50')).toBeInTheDocument()

    // ERP ID badge
    expect(screen.getByTestId('erp-badge-prod-1')).toBeInTheDocument()
    expect(screen.getByText('ERP-SKU-1001')).toBeInTheDocument()
  })

  it('filters catalog items by search query and status tabs', async () => {
    const user = userEvent.setup()
    render(<CatalogoPage />)

    await waitFor(() => {
      expect(screen.getByText('Fralda Pampers Confort Sec M')).toBeInTheDocument()
    })

    // Filter by search query
    const searchInput = screen.getByTestId('catalog-search-input')
    await user.type(searchInput, 'Huggies')

    expect(screen.getByText('Fralda Huggies Supreme Care G')).toBeInTheDocument()
    expect(screen.queryByText('Fralda Pampers Confort Sec M')).not.toBeInTheDocument()

    await user.clear(searchInput)

    // Filter by status tab: Ativos
    const ativosTab = screen.getByRole('button', { name: /Ativos/i })
    await user.click(ativosTab)

    expect(screen.getByText('Fralda Pampers Confort Sec M')).toBeInTheDocument()
    expect(screen.queryByText('Fralda Huggies Supreme Care G')).not.toBeInTheDocument()
  })

  it('toggles product active/inactive publication state', async () => {
    const user = userEvent.setup()
    render(<CatalogoPage />)

    await waitFor(() => {
      expect(screen.getByText('Fralda Pampers Confort Sec M')).toBeInTheDocument()
    })

    // Toggle active on prod-1 (currently active -> click Despublicar)
    const toggleBtn = screen.getByTestId('toggle-active-prod-1')
    await user.click(toggleBtn)

    await waitFor(() => {
      expect(mockRepoInstance.update).toHaveBeenCalledWith('prod-1', { active: false })
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('despublicado'))
    })
  })

  it('opens add product dialog when clicking add product button', async () => {
    const user = userEvent.setup()
    render(<CatalogoPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Meu Catálogo/i })).toBeInTheDocument()
    })

    const addBtn = screen.getByTestId('add-product-button')
    await user.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('Adicionar Produto ao Catálogo')).toBeInTheDocument()
    })
  })

  it('deletes a product after confirmation in modal', async () => {
    const user = userEvent.setup()
    render(<CatalogoPage />)

    await waitFor(() => {
      expect(screen.getByText('Fralda Pampers Confort Sec M')).toBeInTheDocument()
    })

    const deleteBtn = screen.getByTestId('delete-btn-prod-1')
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('Remover produto do catálogo?')).toBeInTheDocument()
    })

    const confirmDeleteBtn = screen.getByRole('button', { name: /Sim, remover produto/i })
    await user.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(mockRepoInstance.remove).toHaveBeenCalledWith('prod-1')
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('removido'))
    })
  })
})
