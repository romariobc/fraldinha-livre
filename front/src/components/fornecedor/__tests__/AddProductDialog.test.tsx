/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AddProductDialog, type MasterCatalogItem } from '../AddProductDialog'
import type { ProductRepository } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest } from '@contracts'

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

import { toast } from 'sonner'

const MOCK_MASTER_ITEMS: MasterCatalogItem[] = [
  {
    id: 'm1',
    name: 'Supersec Pants',
    brand: 'Pampers',
    size: 'M',
    slug: 'pampers-supersec-pants-m',
    categoria: 'fraldas-descartaveis',
    descricao: 'Fralda Pampers Supersec Pants tamanho M.',
    priceInCents: 2200,
    atributos: {
      faixaPeso: '5–9 kg',
      genero: 'unissex',
      absorcao: 'ate 12 horas',
      tecnologia: 'camada seca antivazamento',
    },
    badge: 'Mais vendido',
  },
  {
    id: 'm2',
    name: 'Supreme Care',
    brand: 'Huggies',
    size: 'G',
    slug: 'huggies-supreme-care-g',
    categoria: 'fraldas-descartaveis',
    descricao: 'Fralda Huggies Supreme Care tamanho G.',
    priceInCents: 2900,
    atributos: {
      faixaPeso: '9–12,5 kg',
      genero: 'unissex',
      absorcao: 'ate 12 horas',
      tecnologia: 'toque suave com aloe',
    },
  },
]

describe('AddProductDialog Component', () => {
  let mockRepo: ProductRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = {
      list: vi.fn().mockResolvedValue([]),
      listForSupplier: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(async (req: CreateProductRequest) => {
        return {
          id: 'prod-new-123',
          supplierId: 'sup-1',
          active: true,
          ...req,
        } as Product
      }),
      update: vi.fn(),
      remove: vi.fn(),
    }
  })

  it('renders master catalog search when opened', () => {
    render(
      <AddProductDialog
        open={true}
        onOpenChange={vi.fn()}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    expect(screen.getByText('Adicionar Produto ao Catálogo')).toBeInTheDocument()
    expect(screen.getByText(/Catálogo Mestre Padronizado/i)).toBeInTheDocument()
    expect(screen.getByTestId('master-search-input')).toBeInTheDocument()
    expect(screen.getByText('Supersec Pants')).toBeInTheDocument()
    expect(screen.getByText('Supreme Care')).toBeInTheDocument()
  })

  it('filters master catalog items by search query', async () => {
    const user = userEvent.setup()
    render(
      <AddProductDialog
        open={true}
        onOpenChange={vi.fn()}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    const searchInput = screen.getByTestId('master-search-input')
    await user.type(searchInput, 'Huggies')

    expect(screen.getByText('Supreme Care')).toBeInTheDocument()
    expect(screen.queryByText('Supersec Pants')).not.toBeInTheDocument()
  })

  it('selects master product and displays price, stock and ERP_ID form', async () => {
    const user = userEvent.setup()
    render(
      <AddProductDialog
        open={true}
        onOpenChange={vi.fn()}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    // Select Supersec Pants
    const item = screen.getByTestId('master-item-m1')
    await user.click(item)

    // Form configuration should be visible
    expect(screen.getByTestId('link-product-form')).toBeInTheDocument()
    expect(screen.getByText('Supersec Pants')).toBeInTheDocument()
    expect(screen.getByText(/Marca:/i)).toBeInTheDocument()
    expect(screen.getByText('Pampers')).toBeInTheDocument()

    // Pre-filled price in Reais from master price (2200 cents = 22.00)
    const priceInput = screen.getByTestId('custom-price-input') as HTMLInputElement
    expect(priceInput.value).toBe('22.00')

    // Stock quantity input
    const stockInput = screen.getByTestId('stock-quantity-input') as HTMLInputElement
    expect(stockInput.value).toBe('50')

    // ERP ID input
    expect(screen.getByTestId('erp-id-input')).toBeInTheDocument()
  })

  it('validates price and stock before submission', async () => {
    const user = userEvent.setup()
    render(
      <AddProductDialog
        open={true}
        onOpenChange={vi.fn()}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    // Select item
    await user.click(screen.getByTestId('master-item-m1'))

    // Clear price
    const priceInput = screen.getByTestId('custom-price-input')
    await user.clear(priceInput)

    // Submit
    const submitBtn = screen.getByTestId('submit-add-product-btn')
    await user.click(submitBtn)

    expect(
      screen.getByText('Informe um preço de venda válido maior que zero.')
    ).toBeInTheDocument()
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('submits linked product with custom price, stock and ERP_ID', async () => {
    const user = userEvent.setup()
    const handleProductAdded = vi.fn()
    const handleOpenChange = vi.fn()

    render(
      <AddProductDialog
        open={true}
        onOpenChange={handleOpenChange}
        onProductAdded={handleProductAdded}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    // Select master item
    await user.click(screen.getByTestId('master-item-m1'))

    // Edit price to 25.50
    const priceInput = screen.getByTestId('custom-price-input')
    await user.clear(priceInput)
    await user.type(priceInput, '25.50')

    // Edit stock to 120
    const stockInput = screen.getByTestId('stock-quantity-input')
    await user.clear(stockInput)
    await user.type(stockInput, '120')

    // Set ERP_ID
    const erpInput = screen.getByTestId('erp-id-input')
    await user.type(erpInput, 'ERP-SKU-99482')

    // Submit
    const submitBtn = screen.getByTestId('submit-add-product-btn')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockRepo.create).toHaveBeenCalledWith({
        name: 'Supersec Pants',
        brand: 'Pampers',
        size: 'M',
        slug: 'pampers-supersec-pants-m',
        categoria: 'fraldas-descartaveis',
        descricao: 'Fralda Pampers Supersec Pants tamanho M.',
        quantity: 120,
        priceCents: 2550, // 25.50 * 100
        atributos: {
          faixaPeso: '5–9 kg',
          genero: 'unissex',
          absorcao: 'ate 12 horas',
          tecnologia: 'camada seca antivazamento',
          erpId: 'ERP-SKU-99482',
        },
        badge: 'Mais vendido',
      })
    })

    expect(handleProductAdded).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Supersec Pants')
    )
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('allows switching master product before submitting', async () => {
    const user = userEvent.setup()
    render(
      <AddProductDialog
        open={true}
        onOpenChange={vi.fn()}
        masterProducts={MOCK_MASTER_ITEMS}
        repo={mockRepo}
      />
    )

    // Select Supersec Pants
    await user.click(screen.getByTestId('master-item-m1'))
    expect(screen.getByText('Supersec Pants')).toBeInTheDocument()

    // Click "Trocar"
    const trocarBtn = screen.getByRole('button', { name: /trocar/i })
    await user.click(trocarBtn)

    // Back to search step
    expect(screen.getByTestId('master-search-input')).toBeInTheDocument()
    expect(screen.getByText('Supreme Care')).toBeInTheDocument()
  })
})
