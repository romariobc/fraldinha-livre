'use client'

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { Order, Address } from '@/lib/account-mock'
import type { CartItem } from '@/lib/domain/cart'
import { buildOrdersFromCart } from '@/lib/domain/order'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { MockOrderRepository } from '@/lib/adapters/mock-order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import type { Order as ContractOrder, CreateOrderRequest } from '@contracts'

function contractOrderToAccountMockOrder(order: ContractOrder): Order {
  return {
    id: order.id,
    type: order.type,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    createdAt: order.createdAt,
    price: order.price,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    items: order.items,
  }
}

interface OrdersContextType {
  orders: Order[]
  loading: boolean
  error: string | null
  createDirectOrder: (product: string, quantity: number, deliveryAddress: Address, price: number, supplierId?: string, supplierName?: string) => Order
  createOrdersFromCart: (items: CartItem[], address: Address) => Promise<Order[]>
  cancelOrder: (orderId: string) => Promise<void>
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo: OrderRepository = useMemo(() => {
    const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
    if (useBackend) return new HttpOrderRepository()
    return new MockOrderRepository({
      now: () => new Date().toISOString(),
      idFactory: () => crypto.randomUUID(),
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const result = await repo.list()
        if (cancelled) return
        setOrders(result.map(contractOrderToAccountMockOrder))
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar pedidos:', err)
        setError('Não foi possível carregar seus pedidos. Tente novamente.')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [repo])

  // Codigo morto (sem chamador em producao, sobrou do flip S5b/D-023) - NAO MEXER, fora de escopo B8.
  const createDirectOrder = (
    product: string,
    quantity: number,
    deliveryAddress: Address,
    price: number,
    supplierId?: string,
    supplierName?: string
  ): Order => {
    const newOrderId = `ord-${Date.now()}`
    const newOrder: Order = {
      id: newOrderId,
      type: 'compra-direta',
      product,
      quantity,
      unit: 'un',
      deliveryAddress,
      status: 'aguardando',
      createdAt: new Date().toISOString(),
      price,
      supplierId,
      supplierName,
      items: [{
        productId: `${newOrderId}-p1`,
        productName: product,
        unitPrice: price,
        quantity,
        unit: 'un',
      }],
    }
    setOrders(prev => [...prev, newOrder])
    return newOrder
  }

  const createOrdersFromCart = async (items: CartItem[], address: Address): Promise<Order[]> => {
    let idCounter = 0
    const idFactory = () => {
      idCounter++
      return `tmp-${idCounter}` // descartado - servidor define o id real (RN-03)
    }
    const now = new Date().toISOString()

    // DEC-A: o split por fornecedor continua no front (dominio puro, ja testado, T1).
    const domainOrders = buildOrdersFromCart(items, address, idFactory, now)

    const newOrders: Order[] = []
    for (const domainOrder of domainOrders) {
      const totalQuantity = domainOrder.items.reduce((sum, item) => sum + item.quantity, 0)
      const productField = domainOrder.items.length === 1
        ? domainOrder.items[0].productName
        : `${domainOrder.items.length} itens`

      const createRequest: CreateOrderRequest = {
        product: productField,
        quantity: totalQuantity,
        unit: 'un',
        price: domainOrder.total,
        supplierId: domainOrder.supplierId,
        supplierName: domainOrder.supplierName,
        deliveryAddress: address,
        items: domainOrder.items,
      }

      // DEC-A: uma chamada POST /orders por pedido resultante do split.
      const created = await repo.create(createRequest)
      newOrders.push(contractOrderToAccountMockOrder(created))
    }

    setOrders((prev) => [...prev, ...newOrders])
    return newOrders
  }

  const cancelOrder = async (orderId: string): Promise<void> => {
    const updated = await repo.cancel(orderId)
    const mapped = contractOrderToAccountMockOrder(updated)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? mapped : o)))
  }

  return (
    <OrdersContext.Provider value={{ orders, loading, error, createDirectOrder, createOrdersFromCart, cancelOrder }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error('useOrders deve ser usado dentro de OrdersProvider')
  }
  return context
}
