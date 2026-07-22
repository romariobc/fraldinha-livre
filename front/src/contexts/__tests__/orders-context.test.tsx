/// <reference types="vitest/globals" />

import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { OrdersProvider, useOrders } from '../orders-context'
import { CartProvider } from '../cart-context'
import { AuthProvider } from '../auth-context'
import { MarketProvider } from '../market-context'
import { vi } from 'vitest'

// Mock firebase (used by AuthProvider)
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null)
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

type AllProvidersProps = {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <OrdersProvider>
      <CartProvider>
        <AuthProvider>
          <MarketProvider>{children}</MarketProvider>
        </AuthProvider>
      </CartProvider>
    </OrdersProvider>
  )
}

describe('OrdersContext - createOrdersFromCart', () => {
  const mockAddress = {
    logradouro: 'Rua Teste',
    numero: '123',
    complemento: 'Apt 456',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100',
  }

  it('should create orders from cart with 2 suppliers', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Two items from different suppliers
    const item1 = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000, // R$ 50,00
      quantity: 2,
      unit: 'un' as const,
    }

    const item2 = {
      productId: 'p2',
      productName: 'Fralda Conforto',
      supplierId: 'sup-002',
      supplierName: 'Fornecedor B',
      unitPrice: 3500, // R$ 35,00
      quantity: 1,
      unit: 'un' as const,
    }

    let orders
    await act(async () => {
      orders = await result.current.createOrdersFromCart([item1, item2], mockAddress)
    })

    expect(orders).toHaveLength(2)

    // First order (sup-001)
    const order1 = orders![0]
    expect(order1.type).toBe('compra-direta')
    expect(order1.status).toBe('aguardando')
    expect(order1.supplierId).toBe('sup-001')
    expect(order1.supplierName).toBe('Fornecedor A')
    expect(order1.quantity).toBe(2) // sum of quantities
    expect(order1.price).toBe(10000) // 5000 * 2
    expect(order1.items).toHaveLength(1)
    expect(order1.items![0].unitPrice).toBe(5000) // unitário correto
    expect(order1.items![0].quantity).toBe(2)

    // Second order (sup-002)
    const order2 = orders![1]
    expect(order2.type).toBe('compra-direta')
    expect(order2.status).toBe('aguardando')
    expect(order2.supplierId).toBe('sup-002')
    expect(order2.supplierName).toBe('Fornecedor B')
    expect(order2.quantity).toBe(1)
    expect(order2.price).toBe(3500)
    expect(order2.items).toHaveLength(1)
    expect(order2.items![0].unitPrice).toBe(3500)
    expect(order2.items![0].quantity).toBe(1)
  })

  it('should set correct product field for single item', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const item = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000,
      quantity: 1,
      unit: 'un' as const,
    }

    let createdOrders
    await act(async () => {
      createdOrders = await result.current.createOrdersFromCart([item], mockAddress)
    })

    expect(createdOrders![0].product).toBe('Fralda Premium')
  })

  it('should set product field to "N itens" for multiple items', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const items = [
      {
        productId: 'p1',
        productName: 'Fralda A',
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        unitPrice: 5000,
        quantity: 1,
        unit: 'un' as const,
      },
      {
        productId: 'p2',
        productName: 'Fralda B',
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        unitPrice: 3000,
        quantity: 1,
        unit: 'un' as const,
      },
    ]

    let orders
    await act(async () => {
      orders = await result.current.createOrdersFromCart(items, mockAddress)
    })

    expect(orders![0].product).toBe('2 itens')
  })

  it('should append orders to existing orders in context', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const item = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000,
      quantity: 1,
      unit: 'un' as const,
    }

    const initialOrderCount = result.current.orders.length

    await act(async () => {
      await result.current.createOrdersFromCart([item], mockAddress)
    })

    // Check that orders were appended
    expect(result.current.orders.length).toBe(initialOrderCount + 1)
  })

  it('should set deliveryAddress correctly', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const item = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000,
      quantity: 1,
      unit: 'un' as const,
    }

    let orders
    await act(async () => {
      orders = await result.current.createOrdersFromCart([item], mockAddress)
    })

    expect(orders![0].deliveryAddress).toEqual(mockAddress)
  })

  it('should set createdAt to ISO 8601 timestamp', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const item = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000,
      quantity: 1,
      unit: 'un' as const,
    }

    let orders
    await act(async () => {
      orders = await result.current.createOrdersFromCart([item], mockAddress)
    })

    expect(orders![0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should calculate total quantity correctly for multiple items in same order', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    const items = [
      {
        productId: 'p1',
        productName: 'Fralda A',
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        unitPrice: 5000,
        quantity: 2,
        unit: 'un' as const,
      },
      {
        productId: 'p2',
        productName: 'Fralda B',
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        unitPrice: 3000,
        quantity: 3,
        unit: 'un' as const,
      },
    ]

    let orders
    await act(async () => {
      orders = await result.current.createOrdersFromCart(items, mockAddress)
    })

    // Total quantity should be sum of all quantities
    expect(orders![0].quantity).toBe(5) // 2 + 3
  })
})

describe('OrdersContext - cancelOrder', () => {
  const mockAddress = {
    logradouro: 'Rua Teste',
    numero: '123',
    complemento: 'Apt 456',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100',
  }

  it('should cancel an order by changing status to cancelado', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Create a new order (with status 'aguardando') to cancel
    const item = {
      productId: 'p1',
      productName: 'Fralda Premium',
      supplierId: 'sup-001',
      supplierName: 'Fornecedor A',
      unitPrice: 5000,
      quantity: 1,
      unit: 'un' as const,
    }

    let createdOrders
    await act(async () => {
      createdOrders = await result.current.createOrdersFromCart([item], mockAddress)
    })

    const orderToCancel = createdOrders![0]

    await act(async () => {
      await result.current.cancelOrder(orderToCancel.id)
    })

    const updatedOrder = result.current.orders.find(o => o.id === orderToCancel.id)
    expect(updatedOrder?.status).toBe('cancelado')
  })

  it('should not affect other orders when canceling one', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: AllProviders })

    // Wait for initial loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Create two new orders to test cancellation
    const items = [
      {
        productId: 'p1',
        productName: 'Fralda A',
        supplierId: 'sup-001',
        supplierName: 'Fornecedor A',
        unitPrice: 5000,
        quantity: 1,
        unit: 'un' as const,
      },
      {
        productId: 'p2',
        productName: 'Fralda B',
        supplierId: 'sup-002',
        supplierName: 'Fornecedor B',
        unitPrice: 3000,
        quantity: 1,
        unit: 'un' as const,
      },
    ]

    let createdOrders
    await act(async () => {
      createdOrders = await result.current.createOrdersFromCart(items, mockAddress)
    })

    const orderToCancel = createdOrders![0]
    const otherOrder = createdOrders![1]
    const otherOrderInitialStatus = otherOrder.status

    await act(async () => {
      await result.current.cancelOrder(orderToCancel.id)
    })

    const updatedOtherOrder = result.current.orders.find(o => o.id === otherOrder.id)
    expect(updatedOtherOrder?.status).toBe(otherOrderInitialStatus)
  })
})
