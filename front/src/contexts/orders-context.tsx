'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Order, Offer, Address, INITIAL_ORDERS } from '@/lib/account-mock'

interface OrdersContextType {
  orders: Order[]
  createDirectOrder: (product: string, quantity: number, deliveryAddress: Address, price: number, supplierId?: string, supplierName?: string) => Order
  handleAceitarOferta: (orderId: string, offer: Offer) => void
  handleNovoPedido: (product: string, quantity: number, deliveryAddress: Address) => string
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

  const handleAceitarOferta = (orderId: string, offer: Offer) => {
    setOrders(
      orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'aceito' as const,
              price: offer.price,
              supplierId: offer.supplier,
              supplierName: offer.supplier,
            }
          : order
      )
    )
  }

  const handleNovoPedido = (product: string, quantity: number, deliveryAddress: Address): string => {
    const newOrderId = `ord-${Date.now()}`
    const newOrder: Order = {
      id: newOrderId,
      type: 'cotacao',
      product,
      quantity,
      unit: 'un',
      deliveryAddress,
      status: 'aguardando',
      createdAt: new Date().toISOString(),
      offers: [],
      items: [{
        productId: `${newOrderId}-p1`,
        productName: product,
        unitPrice: 0,
        quantity,
        unit: 'un',
      }],
    }
    setOrders([...orders, newOrder])
    return newOrderId
  }

  return (
    <OrdersContext.Provider value={{ orders, createDirectOrder, handleAceitarOferta, handleNovoPedido }}>
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
