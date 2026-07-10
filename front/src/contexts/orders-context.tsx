'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Order, Address, INITIAL_ORDERS } from '@/lib/account-mock'
import type { CartItem } from '@/lib/domain/cart'
import { buildOrdersFromCart } from '@/lib/domain/order'

interface OrdersContextType {
  orders: Order[]
  createDirectOrder: (product: string, quantity: number, deliveryAddress: Address, price: number, supplierId?: string, supplierName?: string) => Order
  createOrdersFromCart: (items: CartItem[], address: Address) => Order[]
  cancelOrder: (orderId: string) => void
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)

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
    setOrders([...orders, newOrder])
    return newOrder
  }

  const createOrdersFromCart = (items: CartItem[], address: Address): Order[] => {
    // ID factory for unique order IDs
    let idCounter = 0
    const idFactory = () => {
      idCounter++
      return `ord-${Date.now()}-${idCounter}`
    }

    // ISO 8601 timestamp for createdAt
    const now = new Date().toISOString()

    // Build domain orders from cart (grouped by supplier)
    const domainOrders = buildOrdersFromCart(items, address, idFactory, now)

    // Map DomainOrder → Order (account-mock format)
    const newOrders: Order[] = domainOrders.map((domainOrder) => {
      // Calculate total quantity sum
      const totalQuantity = domainOrder.items.reduce((sum, item) => sum + item.quantity, 0)

      // Product field: single item name or "N itens"
      const productField = domainOrder.items.length === 1
        ? domainOrder.items[0].productName
        : `${domainOrder.items.length} itens`

      const order: Order = {
        id: domainOrder.id,
        type: 'compra-direta',
        status: 'aguardando',
        product: productField,
        quantity: totalQuantity,
        unit: 'un',
        deliveryAddress: address,
        createdAt: domainOrder.createdAt,
        price: domainOrder.total,
        supplierId: domainOrder.supplierId,
        supplierName: domainOrder.supplierName,
        items: domainOrder.items,
      }

      return order
    })

    // Append to orders state and return the new orders
    setOrders((prev) => [...prev, ...newOrders])
    return newOrders
  }

  const cancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o))
  }

  return (
    <OrdersContext.Provider value={{ orders, createDirectOrder, createOrdersFromCart, cancelOrder }}>
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
