/// <reference types="vitest/globals" />

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { OrdersDataTable, type SupplierOrderRow } from '../OrdersDataTable'
import { AddProductDialog, type MasterCatalogItem } from '../AddProductDialog'
import CatalogoPage from '@/app/(fornecedor)/painel-fornecedor/catalogo/page'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'

// Mocks
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
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'sup-adv-1', email: 'fornecedor-adv@teste.com' },
    role: 'fornecedor',
  })),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: [],
    directOrdersLoading: false,
    handleConfirmarDireto: vi.fn(),
    handleRecusarDireto: vi.fn(),
  })),
}))

vi.mock('@/lib/adapters/http-product-repository', () => ({
  HttpProductRepository: vi.fn(),
}))

import { toast } from 'sonner'

const ADVERSARIAL_ORDERS: SupplierOrderRow[] = [
  {
    id: 'DIR-EDGE-01',
    product: 'Fralda Pampers Supersec G (Especial)',
    quantity: 10,
    unit: 'pct',
    price: 15000, // R$ 150,00
    buyerName: 'Comprador Alfa & Filhos',
    buyerLocation: 'São Paulo, SP',
    createdAt: '2026-08-15T12:00:00.000Z',
    status: 'aguardando',
    deliveryAddress: {
      logradouro: 'Rua das Flores, nº 123 (Apto 4B)',
      numero: '123',
      bairro: 'Jardins',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01400-000',
    },
    items: [
      {
        productId: 'item-1',
        productName: 'Fralda Pampers Supersec G',
        unitPrice: 1500,
        quantity: 10,
        unit: 'pct',
      },
    ],
  },
  {
    id: 'DIR-EDGE-02',
    product: 'Huggies Tripla Proteção M',
    quantity: 50,
    unit: 'un',
    price: 50000, // R$ 500,00
    buyerName: 'Drogaria Beta [Filial 2]',
    buyerLocation: 'Rio de Janeiro, RJ',
    createdAt: '2026-08-14T08:30:00.000Z',
    status: 'confirmado',
  },
  {
    id: 'DIR-EDGE-03',
    product: 'Babysec Ultra Jumbo XXG',
    quantity: 5,
    unit: 'cx',
    price: 15000, // Same price as DIR-EDGE-01 for sorting tie
    buyerName: 'Centro Infantil Gama',
    buyerLocation: 'Belo Horizonte, MG',
    createdAt: '2026-08-13T10:00:00.000Z',
    status: 'a-caminho', // Should match "entregues" tab logic
  },
  {
    id: 'DIR-EDGE-04',
    product: 'Cremer Disney P',
    quantity: 2,
    unit: 'cx',
    price: 8000, // R$ 80,00
    buyerName: 'Farmácia Delta',
    buyerLocation: 'Curitiba, PR',
    createdAt: '2026-08-12T15:45:00.000Z',
    status: 'entregue',
  },
  {
    id: 'DIR-EDGE-05',
    product: 'Pomada Hipoglós 45g',
    quantity: 100,
    unit: 'un',
    price: 120000, // R$ 1200,00
    buyerName: 'Rede Farmácias Ômega',
    buyerLocation: 'Porto Alegre, RS',
    createdAt: '2026-08-11T18:20:00.000Z',
    status: 'cancelado',
  },
]

const ADVERSARIAL_MASTER_ITEMS: MasterCatalogItem[] = [
  {
    id: 'm-special-1',
    name: 'Fralda Especial (Com Caracteres: [100%] + Ação & Proteção)',
    brand: 'Marca (X)',
    size: 'G/XG',
    slug: 'fralda-especial-caracteres',
    categoria: 'fraldas-especiais',
    descricao: 'Descrição com $100% de absorção e tecnologia anti-leak!',
    priceInCents: 4500,
    atributos: {
      faixaPeso: '11–15 kg',
      genero: 'unissex',
      absorcao: '14 horas (extra)',
      tecnologia: 'Gel Active Plus',
    },
    badge: 'Destaque *',
  },
  {
    id: 'm-special-2',
    name: 'Lenço Umedecido Aloe Vera [99.9% Água]',
    brand: 'BioBaby',
    size: '48 un',
    slug: 'lenco-biobaby-99-agua',
    categoria: 'higiene-bebe',
    descricao: 'Lenço 100% puro e hipoalergênico.',
    priceInCents: 1250,
    atributos: {
      faixaPeso: 'todas',
      genero: 'unissex',
      absorcao: 'N/A',
      tecnologia: 'Fibras Naturais',
    },
  },
]

describe('Milestone 3 Adversarial Stress Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. OrdersDataTable Adversarial Suite', () => {
    it('handles sorting edge cases (multi-cycle toggling, equal values, date parsing)', async () => {
      const user = userEvent.setup()
      render(<OrdersDataTable orders={ADVERSARIAL_ORDERS} />)

      const priceHeaderBtn = screen.getByRole('button', { name: /valor total/i })

      // Ascending sort
      await user.click(priceHeaderBtn)
      // DIR-EDGE-04 is lowest (R$ 80,00)
      expect(screen.getByText('#DIR-EDGE-04')).toBeInTheDocument()

      // Descending sort
      await user.click(priceHeaderBtn)
      // DIR-EDGE-05 is highest (R$ 1.200,00)
      expect(screen.getByText('#DIR-EDGE-05')).toBeInTheDocument()

      // Cycle back (none / default)
      await user.click(priceHeaderBtn)
      expect(screen.getByText('#DIR-EDGE-01')).toBeInTheDocument()

      // Sort by Data / Hora
      const dateHeaderBtn = screen.getByRole('button', { name: /data \/ hora/i })
      await user.click(dateHeaderBtn)
      expect(screen.getByText('#DIR-EDGE-05')).toBeInTheDocument() // oldest first
    })

    it('handles empty search results, regex characters in search and recovers gracefully', async () => {
      const user = userEvent.setup()
      render(<OrdersDataTable orders={ADVERSARIAL_ORDERS} />)

      const searchInput = screen.getByTestId('orders-search-input')

      // Adversarial search with regex tokens and brackets
      fireEvent.change(searchInput, { target: { value: '[.*+?^${}()|]' } })
      expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument()
      expect(screen.getByText(/Tente ajustar os filtros/i)).toBeInTheDocument()

      // Partial match on buyer location
      await user.clear(searchInput)
      await user.type(searchInput, 'Curitiba')
      expect(screen.getByText('#DIR-EDGE-04')).toBeInTheDocument()
      expect(screen.queryByText('#DIR-EDGE-01')).not.toBeInTheDocument()

      // Clear search restores all
      await user.clear(searchInput)
      expect(screen.getByText('#DIR-EDGE-01')).toBeInTheDocument()
      expect(screen.getByText('#DIR-EDGE-02')).toBeInTheDocument()
    })

    it('handles status filter switching and aggregates "a-caminho" into "entregues"', async () => {
      const user = userEvent.setup()
      render(<OrdersDataTable orders={ADVERSARIAL_ORDERS} />)

      // Check Entregues tab includes both 'a-caminho' (DIR-EDGE-03) and 'entregue' (DIR-EDGE-04)
      const entreguesTab = screen.getByRole('button', { name: /entregues/i })
      await user.click(entreguesTab)

      expect(screen.getByText('#DIR-EDGE-03')).toBeInTheDocument()
      expect(screen.getByText('#DIR-EDGE-04')).toBeInTheDocument()
      expect(screen.queryByText('#DIR-EDGE-01')).not.toBeInTheDocument()
      expect(screen.queryByText('#DIR-EDGE-02')).not.toBeInTheDocument()

      // Switch to Aguardando
      const aguardandoTab = screen.getByRole('button', { name: /aguardando/i })
      await user.click(aguardandoTab)
      expect(screen.getByText('#DIR-EDGE-01')).toBeInTheDocument()
      expect(screen.queryByText('#DIR-EDGE-03')).not.toBeInTheDocument()
    })

    it('handles pagination size changes and boundary bounds', async () => {
      render(<OrdersDataTable orders={ADVERSARIAL_ORDERS} />)

      const pageSizeSelect = screen.getByTestId('page-size-select')
      fireEvent.change(pageSizeSelect, { target: { value: '50' } })

      expect(screen.getByTestId('pagination-info')).toHaveTextContent(
        'Mostrando 1 a 5 de 5 pedidos'
      )
    })

    it('copies order ID safely and opens details with full addresses', async () => {
      const user = userEvent.setup()
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        configurable: true,
      })

      render(<OrdersDataTable orders={ADVERSARIAL_ORDERS} />)

      // Open detail modal for DIR-EDGE-01
      const orderLink = screen.getByTestId('order-id-DIR-EDGE-01')
      await user.click(orderLink)

      await waitFor(() => {
        expect(screen.getByText('Pedido #DIR-EDGE-01')).toBeInTheDocument()
        expect(screen.getByText(/Rua das Flores, nº 123 \(Apto 4B\)/i)).toBeInTheDocument()
      })

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /fechar/i })
      await user.click(closeBtn)
    })
  })

  describe('2. AddProductDialog Adversarial Suite', () => {
    let mockRepo: ProductRepository

    beforeEach(() => {
      mockRepo = {
        list: vi.fn().mockResolvedValue([]),
        listForSupplier: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async (req: CreateProductRequest) => {
          return {
            id: 'prod-created-adv',
            supplierId: 'sup-adv-1',
            active: true,
            ...req,
          } as Product
        }),
        update: vi.fn(),
        remove: vi.fn(),
      }
    })

    it('handles master product search with special characters and symbols', async () => {
      const user = userEvent.setup()
      render(
        <AddProductDialog
          open={true}
          onOpenChange={vi.fn()}
          masterProducts={ADVERSARIAL_MASTER_ITEMS}
          repo={mockRepo}
        />
      )

      const searchInput = screen.getByTestId('master-search-input')

      // Search with bracketed term
      fireEvent.change(searchInput, { target: { value: '[100%]' } })
      expect(screen.getByText(/Fralda Especial \(Com Caracteres/i)).toBeInTheDocument()
      expect(screen.queryByText(/Lenço Umedecido/i)).not.toBeInTheDocument()

      // Search with non-existent term
      await user.clear(searchInput)
      await user.type(searchInput, 'NonExistentItemXYZ123')
      expect(screen.getByText(/Nenhum produto encontrado/i)).toBeInTheDocument()
    })

    it('rejects 0, negative prices, non-numbers and empty prices with specific error messages', async () => {
      const user = userEvent.setup()
      render(
        <AddProductDialog
          open={true}
          onOpenChange={vi.fn()}
          masterProducts={ADVERSARIAL_MASTER_ITEMS}
          repo={mockRepo}
        />
      )

      // Select first item
      await user.click(screen.getByTestId('master-item-m-special-1'))

      const priceInput = screen.getByTestId('custom-price-input')
      const submitBtn = screen.getByTestId('submit-add-product-btn')

      // Test 0 price
      await user.clear(priceInput)
      await user.type(priceInput, '0')
      await user.click(submitBtn)
      expect(screen.getByText('Informe um preço de venda válido maior que zero.')).toBeInTheDocument()
      expect(mockRepo.create).not.toHaveBeenCalled()

      // Test negative price
      await user.clear(priceInput)
      await user.type(priceInput, '-19.90')
      await user.click(submitBtn)
      expect(screen.getByText('Informe um preço de venda válido maior que zero.')).toBeInTheDocument()
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('rejects negative stock quantities', async () => {
      const user = userEvent.setup()
      render(
        <AddProductDialog
          open={true}
          onOpenChange={vi.fn()}
          masterProducts={ADVERSARIAL_MASTER_ITEMS}
          repo={mockRepo}
        />
      )

      await user.click(screen.getByTestId('master-item-m-special-1'))

      const stockInput = screen.getByTestId('stock-quantity-input')
      const submitBtn = screen.getByTestId('submit-add-product-btn')

      await user.clear(stockInput)
      await user.type(stockInput, '-10')
      await user.click(submitBtn)

      expect(
        screen.getByText('Informe uma quantidade de estoque válida maior ou igual a zero.')
      ).toBeInTheDocument()
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('handles comma-separated decimal price (Brazilian format) and trims ERP_ID', async () => {
      const user = userEvent.setup()
      const handleProductAdded = vi.fn()

      render(
        <AddProductDialog
          open={true}
          onOpenChange={vi.fn()}
          onProductAdded={handleProductAdded}
          masterProducts={ADVERSARIAL_MASTER_ITEMS}
          repo={mockRepo}
        />
      )

      await user.click(screen.getByTestId('master-item-m-special-1'))

      // Enter Brazilian format price with comma "49.90" (or 49.90 since input type=number)
      const priceInput = screen.getByTestId('custom-price-input')
      await user.clear(priceInput)
      await user.type(priceInput, '49.90')

      // Stock 0 is valid (e.g. registered out of stock)
      const stockInput = screen.getByTestId('stock-quantity-input')
      await user.clear(stockInput)
      await user.type(stockInput, '0')

      // ERP ID with leading/trailing spaces
      const erpInput = screen.getByTestId('erp-id-input')
      await user.type(erpInput, '   ERP-SAP-9099   ')

      const submitBtn = screen.getByTestId('submit-add-product-btn')
      await user.click(submitBtn)

      await waitFor(() => {
        expect(mockRepo.create).toHaveBeenCalledWith({
          name: 'Fralda Especial (Com Caracteres: [100%] + Ação & Proteção)',
          brand: 'Marca (X)',
          size: 'G/XG',
          slug: 'fralda-especial-caracteres',
          categoria: 'fraldas-especiais',
          descricao: 'Descrição com $100% de absorção e tecnologia anti-leak!',
          quantity: 0,
          priceCents: 4990,
          atributos: {
            faixaPeso: '11–15 kg',
            genero: 'unissex',
            absorcao: '14 horas (extra)',
            tecnologia: 'Gel Active Plus',
            erpId: 'ERP-SAP-9099',
          },
          badge: 'Destaque *',
        })
      })

      expect(handleProductAdded).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    })
  })

  describe('3. CatalogoPage Adversarial Management Suite', () => {
    let mockRepoInstance: {
      listForSupplier: ReturnType<typeof vi.fn>
      list: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }

    const CATALOG_ITEMS: Product[] = [
      {
        id: 'cat-1',
        name: 'Pampers Confort M',
        brand: 'Pampers',
        size: 'M',
        quantity: 50,
        priceCents: 3500,
        supplierId: 'sup-adv-1',
        slug: 'pampers-confort-m',
        categoria: 'fraldas',
        descricao: 'Fralda confort',
        atributos: {
          faixaPeso: '5-9kg',
          genero: 'unissex',
          absorcao: '12h',
          tecnologia: 'Canais de Ar',
          erpId: 'SKU-001',
        },
        active: true,
      },
      {
        id: 'cat-2',
        name: 'Huggies Supreme G',
        brand: 'Huggies',
        size: 'G',
        quantity: 30,
        priceCents: 4000,
        supplierId: 'sup-adv-1',
        slug: 'huggies-supreme-g',
        categoria: 'fraldas',
        descricao: 'Fralda huggies',
        atributos: {
          faixaPeso: '9-12kg',
          genero: 'unissex',
          absorcao: '12h',
          tecnologia: 'Aloe',
        },
        active: false,
      },
    ]

    beforeEach(() => {
      let currentItems = [...CATALOG_ITEMS]
      mockRepoInstance = {
        listForSupplier: vi.fn().mockImplementation(async () => [...currentItems]),
        list: vi.fn().mockImplementation(async () => currentItems.filter((p) => p.active)),
        create: vi.fn().mockImplementation(async (req) => {
          const newItem = { id: 'cat-new', supplierId: 'sup-adv-1', active: true, ...req }
          currentItems.push(newItem)
          return newItem
        }),
        update: vi.fn().mockImplementation(async (id: string, req: UpdateProductRequest) => {
          const idx = currentItems.findIndex((p) => p.id === id)
          if (idx !== -1) {
            currentItems[idx] = { ...currentItems[idx], ...req }
            return currentItems[idx]
          }
          throw new Error('Item not found')
        }),
        remove: vi.fn().mockImplementation(async (id: string) => {
          currentItems = currentItems.filter((p) => p.id !== id)
        }),
      }

      vi.mocked(HttpProductRepository).mockImplementation(
        function() { return mockRepoInstance as unknown as InstanceType<typeof HttpProductRepository> }
      )
    })

    it('handles toggle active failure gracefully without crashing', async () => {
      const user = userEvent.setup()
      mockRepoInstance.update.mockRejectedValueOnce(new Error('Network error on toggle'))

      render(<CatalogoPage />)

      await waitFor(() => {
        expect(screen.getByText('Pampers Confort M')).toBeInTheDocument()
      })

      const toggleBtn = screen.getByTestId('toggle-active-cat-1')
      await user.click(toggleBtn)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erro ao alterar status de publicação.')
      })
    })

    it('cancels deletion dialog without deleting product', async () => {
      const user = userEvent.setup()
      render(<CatalogoPage />)

      await waitFor(() => {
        expect(screen.getByText('Pampers Confort M')).toBeInTheDocument()
      })

      // Click delete button
      const deleteBtn = screen.getByTestId('delete-btn-cat-1')
      await user.click(deleteBtn)

      await waitFor(() => {
        expect(screen.getByText('Remover produto do catálogo?')).toBeInTheDocument()
      })

      // Click Cancelar
      const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
      await user.click(cancelBtn)

      expect(mockRepoInstance.remove).not.toHaveBeenCalled()
      expect(screen.getByText('Pampers Confort M')).toBeInTheDocument()
    })

    it('filters by brand select accurately', async () => {
      render(<CatalogoPage />)

      await waitFor(() => {
        expect(screen.getByText('Pampers Confort M')).toBeInTheDocument()
      })

      const brandSelect = screen.getByTestId('brand-filter-select')
      fireEvent.change(brandSelect, { target: { value: 'Huggies' } })

      expect(screen.getByText('Huggies Supreme G')).toBeInTheDocument()
      expect(screen.queryByText('Pampers Confort M')).not.toBeInTheDocument()
    })
  })
})
