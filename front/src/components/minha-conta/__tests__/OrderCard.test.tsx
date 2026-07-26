/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OrderCard from '../OrderCard'
import type { Order } from '@/lib/account-mock'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock contexts
vi.mock('@/contexts/orders-context', () => ({
  useOrders: vi.fn(),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(),
}))

import { toast } from 'sonner'
import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'

const mockToast = vi.mocked(toast)
const mockUseOrders = vi.mocked(useOrders)
const mockUseMarket = vi.mocked(useMarket)

// Dados de teste
const TEST_ORDER: Order = {
  id: 'ord-123',
  type: 'compra-direta',
  product: '2 Itens',
  quantity: 5,
  unit: 'un',
  price: 5000,
  status: 'aguardando',
  supplierId: 'sup-002',
  supplierName: 'Distribuidor XYZ',
  createdAt: '2024-01-15T10:30:00Z',
  deliveryAddress: {
    logradouro: 'Rua das Flores',
    numero: '123',
    complemento: 'Apto 45',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100',
  },
  items: [
    {
      productId: 'p1',
      productName: 'Fralda Pampers P',
      unitPrice: 2000,
      quantity: 2,
      unit: 'un',
    },
    {
      productId: 'p2',
      productName: 'Toalha Huggies',
      unitPrice: 1000,
      quantity: 3,
      unit: 'un',
    },
  ],
}

const TEST_ORDER_SUP_001: Order = {
  ...TEST_ORDER,
  id: 'ord-124',
  supplierId: 'sup-001',
}

const TEST_ORDER_CONFIRMADO: Order = {
  ...TEST_ORDER,
  id: 'ord-125',
  status: 'confirmado',
}

const TEST_ORDER_A_CAMINHO: Order = {
  ...TEST_ORDER,
  id: 'ord-126',
  status: 'a-caminho',
}

const TEST_ORDER_HISTORICO: Order = {
  ...TEST_ORDER,
  id: 'ord-127',
  status: 'entregue',
}

describe('OrderCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useOrders
    mockUseOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      createDirectOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
      cancelOrder: vi.fn(),
    })

    // Mock useMarket
    mockUseMarket.mockReturnValue({
      marketOrders: [],
      directOrders: [],
      directOrdersLoading: false,
      directOrdersError: null,
      offers: [],
      declinedIds: new Set(),
      handleEnviarOferta: vi.fn(),
      handleDeclineMercado: vi.fn(),
      handleConfirmarDireto: vi.fn(),
      handleRecusarDireto: vi.fn(),
      handleAtualizarDespacho: vi.fn(),
      addDirectOrder: vi.fn(),
      cancelDirectOrder: vi.fn() as unknown as (orderId: string) => void,
    })
  })

  describe('Acordeão de detalhe', () => {
    it('should render expanded button with chevron icon', () => {
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      expect(expandButton).toBeInTheDocument()
    })

    it('should expand and show items, total, address, and date when clicking chevron', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      await user.click(expandButton)

      // Should show items section
      expect(screen.getByText('Itens')).toBeInTheDocument()
      expect(screen.getByText(/Fralda Pampers P/)).toBeInTheDocument()
      expect(screen.getByText(/Toalha Huggies/)).toBeInTheDocument()

      // Should show item details (name × qty, unit price, subtotal)
      expect(screen.getByText(/Fralda Pampers P × 2/)).toBeInTheDocument()
      expect(screen.getByText(/Toalha Huggies × 3/)).toBeInTheDocument()

      // Should show total
      expect(screen.getByText('Total')).toBeInTheDocument()

      // Should show address
      expect(screen.getByText('Endereço de entrega')).toBeInTheDocument()
      expect(screen.getByText(/Rua das Flores, 123 — Apto 45/)).toBeInTheDocument()
      expect(screen.getByText(/Centro, São Paulo\/SP/)).toBeInTheDocument()

      // Should show date
      expect(screen.getByText('Data do pedido')).toBeInTheDocument()
    })

    it('should collapse when clicking chevron again', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')

      // Expand
      await user.click(expandButton)
      expect(screen.getByText('Itens')).toBeInTheDocument()

      // Collapse
      await user.click(expandButton)
      expect(screen.queryByText('Itens')).not.toBeInTheDocument()
    })

    it('should update aria-expanded attribute when expanding/collapsing', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(expandButton)
      expect(expandButton).toHaveAttribute('aria-expanded', 'true')

      await user.click(expandButton)
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('should show all items with quantity and prices', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      await user.click(expandButton)

      // Check first item
      expect(screen.getByText(/Fralda Pampers P × 2/)).toBeInTheDocument()
      // Subtotal should be R$ 40,00 (2000 * 2 = 4000 cents)

      // Check second item
      expect(screen.getByText(/Toalha Huggies × 3/)).toBeInTheDocument()
      // Subtotal should be R$ 30,00 (1000 * 3 = 3000 cents)
    })
  })

  describe('Cancelamento em pedidos (aguardando + compra-direta)', () => {
    it('should show "Cancelar pedido" button when status is aguardando and type is compra-direta in mode=pedidos', () => {
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      expect(cancelButton).toBeInTheDocument()
    })

    it('should open cancel confirmation dialog when clicking "Cancelar pedido"', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      // Dialog should be open with title and description
      const dialogTitle = screen.getAllByText('Cancelar pedido').find(
        el => el.tagName === 'H2' || el.className.includes('font-heading')
      )
      expect(dialogTitle).toBeInTheDocument()
      expect(
        screen.getByText(/Tem certeza que deseja cancelar este pedido/i)
      ).toBeInTheDocument()
    })

    it('should call cancelOrder exactly once when confirming cancellation', async () => {
      const mockCancelOrder = vi.fn()
      mockUseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: null,
        createDirectOrder: vi.fn(),
        createOrdersFromCart: vi.fn(),
        cancelOrder: mockCancelOrder,
      })

      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      const confirmButton = screen.getByRole('button', { name: /Confirmar cancelamento/i })
      await user.click(confirmButton)

      expect(mockCancelOrder).toHaveBeenCalledOnce()
      expect(mockCancelOrder).toHaveBeenCalledWith(TEST_ORDER.id)
    })

    it('should call both cancelOrder and cancelDirectOrder when order.supplierId is sup-001', async () => {
      const mockCancelOrder = vi.fn()
      const mockCancelDirectOrder = vi.fn()

      mockUseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: null,
        createDirectOrder: vi.fn(),
        createOrdersFromCart: vi.fn(),
        cancelOrder: mockCancelOrder,
      })

      mockUseMarket.mockReturnValue({
        marketOrders: [],
        directOrders: [],
        directOrdersLoading: false,
        directOrdersError: null,
        offers: [],
        declinedIds: new Set(),
        handleEnviarOferta: vi.fn(),
        handleDeclineMercado: vi.fn(),
        handleConfirmarDireto: vi.fn(),
        handleRecusarDireto: vi.fn(),
        handleAtualizarDespacho: vi.fn(),
        addDirectOrder: vi.fn(),
        cancelDirectOrder: mockCancelDirectOrder,
      })

      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER_SUP_001} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      const confirmButton = screen.getByRole('button', { name: /Confirmar cancelamento/i })
      await user.click(confirmButton)

      expect(mockCancelOrder).toHaveBeenCalledOnce()
      expect(mockCancelDirectOrder).toHaveBeenCalledOnce()
      expect(mockCancelDirectOrder).toHaveBeenCalledWith(TEST_ORDER_SUP_001.id)
    })

    it('should NOT call cancelDirectOrder when order.supplierId is not sup-001', async () => {
      const mockCancelOrder = vi.fn()
      const mockCancelDirectOrder = vi.fn()

      mockUseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: null,
        createDirectOrder: vi.fn(),
        createOrdersFromCart: vi.fn(),
        cancelOrder: mockCancelOrder,
      })

      mockUseMarket.mockReturnValue({
        marketOrders: [],
        directOrders: [],
        directOrdersLoading: false,
        directOrdersError: null,
        offers: [],
        declinedIds: new Set(),
        handleEnviarOferta: vi.fn(),
        handleDeclineMercado: vi.fn(),
        handleConfirmarDireto: vi.fn(),
        handleRecusarDireto: vi.fn(),
        handleAtualizarDespacho: vi.fn(),
        addDirectOrder: vi.fn(),
        cancelDirectOrder: mockCancelDirectOrder,
      })

      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      const confirmButton = screen.getByRole('button', { name: /Confirmar cancelamento/i })
      await user.click(confirmButton)

      expect(mockCancelOrder).toHaveBeenCalledOnce()
      expect(mockCancelDirectOrder).not.toHaveBeenCalled()
    })

    it('should show success toast after confirming cancellation', async () => {
      mockUseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: null,
        createDirectOrder: vi.fn(),
        createOrdersFromCart: vi.fn(),
        cancelOrder: vi.fn(),
      })

      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      const confirmButton = screen.getByRole('button', { name: /Confirmar cancelamento/i })
      await user.click(confirmButton)

      expect(mockToast.success).toHaveBeenCalledWith('Pedido cancelado')
    })

    it('should close dialog after confirming cancellation', async () => {
      mockUseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: null,
        createDirectOrder: vi.fn(),
        createOrdersFromCart: vi.fn(),
        cancelOrder: vi.fn(),
      })

      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar pedido/i })
      await user.click(cancelButton)

      expect(screen.getByText(/Tem certeza que deseja cancelar/i)).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', { name: /Confirmar cancelamento/i })
      await user.click(confirmButton)

      // Dialog should be gone after confirmation
      expect(screen.queryByText(/Tem certeza que deseja cancelar/i)).not.toBeInTheDocument()
    })
  })

  describe('Status confirmado', () => {
    it('should NOT show cancel button when status is confirmado', () => {
      render(<OrderCard order={TEST_ORDER_CONFIRMADO} mode="pedidos" />)

      expect(screen.queryByRole('button', { name: /Cancelar pedido/i })).not.toBeInTheDocument()
    })

    it('should show restriction message when status is confirmado', () => {
      render(<OrderCard order={TEST_ORDER_CONFIRMADO} mode="pedidos" />)

      expect(
        screen.getByText(/Pedido confirmado\. Para alterar, fale com o fornecedor\./i)
      ).toBeInTheDocument()
    })
  })

  describe('Status a-caminho', () => {
    it('should NOT show cancel button when status is a-caminho', () => {
      render(<OrderCard order={TEST_ORDER_A_CAMINHO} mode="pedidos" />)

      expect(screen.queryByRole('button', { name: /Cancelar pedido/i })).not.toBeInTheDocument()
    })

    it('should show restriction message when status is a-caminho', () => {
      render(<OrderCard order={TEST_ORDER_A_CAMINHO} mode="pedidos" />)

      expect(
        screen.getByText(/Pedido a caminho — não pode ser cancelado por aqui\./i)
      ).toBeInTheDocument()
    })
  })

  describe('Modo histórico', () => {
    it('should NOT show cancel button in historico mode', () => {
      render(<OrderCard order={TEST_ORDER} mode="historico" />)

      expect(screen.queryByRole('button', { name: /Cancelar pedido/i })).not.toBeInTheDocument()
    })

    it('should NOT show restriction messages in historico mode', () => {
      render(<OrderCard order={TEST_ORDER} mode="historico" />)

      expect(screen.queryByText(/Pedido confirmado/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/a-caminho/i)).not.toBeInTheDocument()
    })

    it('should show date and price in historico mode', () => {
      render(<OrderCard order={TEST_ORDER_HISTORICO} mode="historico" />)

      expect(screen.getByText(/Entregue/i)).toBeInTheDocument()
      expect(screen.getByText(/15\/01\/2024/)).toBeInTheDocument()
    })
  })

  describe('Badge de tipo', () => {
    it('should show "Compra direta" badge for compra-direta type', () => {
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      expect(screen.getByText('Compra direta')).toBeInTheDocument()
    })

    it('should show "Cotação" badge for cotacao type', () => {
      const cotacaoOrder: Order = {
        ...TEST_ORDER,
        type: 'cotacao',
      }
      render(<OrderCard order={cotacaoOrder} mode="pedidos" />)

      expect(screen.getByText('Cotação')).toBeInTheDocument()
    })
  })

  describe('Estilo e acessibilidade', () => {
    it('should have aria-controls pointing to accordion panel', async () => {
      const user = userEvent.setup()
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      const panelId = expandButton.getAttribute('aria-controls')

      expect(panelId).toBeDefined()

      await user.click(expandButton)

      const panel = document.getElementById(panelId!)
      expect(panel).toBeInTheDocument()
    })

    it('should have chevron icon in button for expand/collapse', () => {
      render(<OrderCard order={TEST_ORDER} mode="pedidos" />)

      const expandButton = screen.getByLabelText('Ver detalhes do pedido')
      const svg = expandButton.querySelector('svg')

      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('lucide-chevron-down')
    })
  })
})
