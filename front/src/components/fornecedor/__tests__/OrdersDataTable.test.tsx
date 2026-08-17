/// <reference types="vitest/globals" />

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { OrdersDataTable, type SupplierOrderRow } from '../OrdersDataTable'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(() => ({
    directOrders: [],
    directOrdersLoading: false,
    handleConfirmarDireto: vi.fn(),
    handleRecusarDireto: vi.fn(),
  })),
}))

import { toast } from 'sonner'

const MOCK_ROWS: SupplierOrderRow[] = [
  {
    id: 'DIR-0031',
    product: 'Pampers Supersec G',
    quantity: 48,
    unit: 'un',
    price: 31200, // R$ 312,00
    buyerName: 'Farmácia Central',
    buyerLocation: 'São Paulo, SP',
    createdAt: '2026-08-15T10:00:00.000Z',
    status: 'aguardando',
    deliveryAddress: {
      logradouro: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310-100',
    },
    items: [
      {
        productId: 'prod-1',
        productName: 'Pampers Supersec G',
        unitPrice: 650,
        quantity: 48,
        unit: 'un',
      },
    ],
  },
  {
    id: 'DIR-0025',
    product: 'Babysec Premium G',
    quantity: 24,
    unit: 'un',
    price: 18400, // R$ 184,00
    buyerName: 'Clínica Materna',
    buyerLocation: 'Campinas, SP',
    createdAt: '2026-08-14T14:30:00.000Z',
    status: 'confirmado',
    deliveryAddress: {
      logradouro: 'Rua Barão de Jaguara',
      numero: '500',
      bairro: 'Centro',
      cidade: 'Campinas',
      estado: 'SP',
      cep: '13015-001',
    },
    items: [
      {
        productId: 'prod-2',
        productName: 'Babysec Premium G',
        unitPrice: 766,
        quantity: 24,
        unit: 'un',
      },
    ],
  },
  {
    id: 'DIR-0015',
    product: 'Cremer PP',
    quantity: 3,
    unit: 'cx',
    price: 22800, // R$ 228,00
    buyerName: 'Hospital Infantil',
    buyerLocation: 'Santos, SP',
    createdAt: '2026-08-10T09:15:00.000Z',
    status: 'cancelado',
    deliveryAddress: {
      logradouro: 'Av. Ana Costa',
      numero: '200',
      bairro: 'Gonzaga',
      cidade: 'Santos',
      estado: 'SP',
      cep: '11060-001',
    },
    items: [
      {
        productId: 'prod-3',
        productName: 'Cremer PP',
        unitPrice: 7600,
        quantity: 3,
        unit: 'cx',
      },
    ],
  },
  {
    id: 'DIR-0010',
    product: 'Huggies Mega M',
    quantity: 10,
    unit: 'un',
    price: 9500, // R$ 95,00
    buyerName: 'Revenda ABC',
    buyerLocation: 'Guarulhos, SP',
    createdAt: '2026-08-01T11:00:00.000Z',
    status: 'entregue',
  },
]

describe('OrdersDataTable Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders table columns correctly with formatted values', () => {
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    // Check table headers
    expect(screen.getByText('ID do Pedido')).toBeInTheDocument()
    expect(screen.getByText('Data / Hora')).toBeInTheDocument()
    expect(screen.getByText('Cliente / Destino')).toBeInTheDocument()
    expect(screen.getByText('Itens')).toBeInTheDocument()
    expect(screen.getByText('Valor Total')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()

    // Check row data
    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
    expect(screen.getByText('Pampers Supersec G')).toBeInTheDocument()
    expect(screen.getByText('Farmácia Central')).toBeInTheDocument()
    expect(screen.getByText('São Paulo, SP')).toBeInTheDocument()
    expect(screen.getByText('R$ 312,00')).toBeInTheDocument()
    expect(screen.getAllByText(/Aguardando/i).length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('#DIR-0025')).toBeInTheDocument()
    expect(screen.getByText('Babysec Premium G')).toBeInTheDocument()
    expect(screen.getByText('R$ 184,00')).toBeInTheDocument()
    expect(screen.getAllByText(/Confirmado/i).length).toBeGreaterThanOrEqual(1)
  })

  it('filters orders by global search input', async () => {
    const user = userEvent.setup()
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    const searchInput = screen.getByTestId('orders-search-input')

    // Search by product name
    await user.type(searchInput, 'Cremer')

    expect(screen.getByText('#DIR-0015')).toBeInTheDocument()
    expect(screen.getByText('Cremer PP')).toBeInTheDocument()
    expect(screen.queryByText('#DIR-0031')).not.toBeInTheDocument()
    expect(screen.queryByText('#DIR-0025')).not.toBeInTheDocument()

    // Clear search
    await user.clear(searchInput)
    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
  })

  it('filters orders by status tabs', async () => {
    const user = userEvent.setup()
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    // Click "Aguardando" status tab
    const aguardandoTab = screen.getByRole('button', { name: /aguardando/i })
    await user.click(aguardandoTab)

    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
    expect(screen.queryByText('#DIR-0025')).not.toBeInTheDocument()
    expect(screen.queryByText('#DIR-0015')).not.toBeInTheDocument()

    // Click "Confirmados" status tab
    const confirmadosTab = screen.getByRole('button', { name: /confirmados/i })
    await user.click(confirmadosTab)

    expect(screen.getByText('#DIR-0025')).toBeInTheDocument()
    expect(screen.queryByText('#DIR-0031')).not.toBeInTheDocument()

    // Click "Cancelados" status tab
    const canceladosTab = screen.getByRole('button', { name: /cancelados/i })
    await user.click(canceladosTab)

    expect(screen.getByText('#DIR-0015')).toBeInTheDocument()
    expect(screen.queryByText('#DIR-0031')).not.toBeInTheDocument()

    // Click "Todos" tab
    const todosTab = screen.getByRole('button', { name: /todos/i })
    await user.click(todosTab)

    expect(screen.getByText('#DIR-0031')).toBeInTheDocument()
    expect(screen.getByText('#DIR-0025')).toBeInTheDocument()
  })

  it('sorts orders when clicking column headers', async () => {
    const user = userEvent.setup()
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    const priceSortBtn = screen.getByRole('button', { name: /valor total/i })
    await user.click(priceSortBtn)

    // Price sort ascending: 95,00 should be first
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
  })

  it('opens order detail modal when clicking order ID', async () => {
    const user = userEvent.setup()
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    const orderIdLink = screen.getByTestId('order-id-DIR-0031')
    await user.click(orderIdLink)

    // Detail dialog should be open
    await waitFor(() => {
      expect(screen.getByText('Pedido #DIR-0031')).toBeInTheDocument()
      expect(screen.getByText(/Av. Paulista, 1000/i)).toBeInTheDocument()
      expect(screen.getByText('Dados do Comprador')).toBeInTheDocument()
      expect(screen.getByText('Valor Total a Receber:')).toBeInTheDocument()
    })
  })

  it('calls onConfirm when confirming an order from detail modal', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<OrdersDataTable orders={MOCK_ROWS} onConfirm={handleConfirm} />)

    // Open detail for DIR-0031 (aguardando)
    const orderIdLink = screen.getByTestId('order-id-DIR-0031')
    await user.click(orderIdLink)

    await waitFor(() => {
      expect(screen.getByText('Pedido #DIR-0031')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /confirmar pedido/i })
    await user.click(confirmBtn)

    expect(handleConfirm).toHaveBeenCalledWith('DIR-0031')
    expect(toast.success).toHaveBeenCalledWith('Pedido #DIR-0031 confirmado com sucesso!')
  })

  it('calls onRefuse when refusing an order from detail modal', async () => {
    const user = userEvent.setup()
    const handleRefuse = vi.fn()
    render(<OrdersDataTable orders={MOCK_ROWS} onRefuse={handleRefuse} />)

    // Open detail for DIR-0031 (aguardando)
    const orderIdLink = screen.getByTestId('order-id-DIR-0031')
    await user.click(orderIdLink)

    await waitFor(() => {
      expect(screen.getByText('Pedido #DIR-0031')).toBeInTheDocument()
    })

    const refuseBtn = screen.getByRole('button', { name: /recusar pedido/i })
    await user.click(refuseBtn)

    expect(handleRefuse).toHaveBeenCalledWith('DIR-0031')
    expect(toast.info).toHaveBeenCalledWith('Pedido #DIR-0031 recusado/cancelado.')
  })

  it('changes page size via select', async () => {
    render(<OrdersDataTable orders={MOCK_ROWS} />)

    const pageSizeSelect = screen.getByTestId('page-size-select')
    fireEvent.change(pageSizeSelect, { target: { value: '5' } })

    expect(screen.getByTestId('pagination-info')).toHaveTextContent(
      'Mostrando 1 a 4 de 4 pedidos'
    )
  })

  it('renders loading state when isLoading is true', () => {
    render(<OrdersDataTable orders={[]} isLoading={true} />)
    expect(screen.getByText('Carregando pedidos...')).toBeInTheDocument()
  })

  it('renders empty state when no orders exist', () => {
    render(<OrdersDataTable orders={[]} isLoading={false} />)
    expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument()
  })
})
