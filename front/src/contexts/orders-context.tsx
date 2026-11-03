'use client'

import { contractOrderToAccountOrder } from '@/lib/order-adapters'

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import type { Order, Address } from '@/lib/domain/account'
import type { CartItem } from '@/lib/domain/cart'
import { buildOrdersFromCart } from '@/lib/domain/order'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { MockOrderRepository } from '@/lib/adapters/mock-order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import type { CreateOrderRequest, Order as ContractOrder } from '@contracts'
import { diagnoseError, type DiagnosticResult } from '@/lib/frontend-diagnostics'



export interface OrdersContextType {
  orders: Order[]
  loading: boolean
  error: string | null
  errorDiagnostic?: DiagnosticResult | null
  refreshOrders?: (options?: { refreshSession?: boolean }) => Promise<void>
  recordConfirmedOrders?: (confirmed: ContractOrder[]) => void
  createDirectOrder: (product: string, quantity: number, deliveryAddress: Address, price: number, supplierId?: string, supplierName?: string) => Order
  createOrdersFromCart: (
    items: CartItem[],
    address: Address,
    idempotencyKey?: string,
    paymentInfo?: {
      paymentMethod?: 'pix' | 'card'
      paymentTransactionId?: string
      paymentStatus?: 'approved' | 'declined' | 'pending'
    }
  ) => Promise<Order[]>
  cancelOrder: (orderId: string) => Promise<void>
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
  const [session, setSession] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: !useBackend })
  useEffect(() => {
    if (!useBackend) return
    return onAuthStateChanged(auth, user => setSession({ user, ready: true }))
  }, [useBackend])
  const uid = session.user?.uid
  const repo: OrderRepository = useMemo(() => useBackend ? new HttpOrderRepository(uid) : new MockOrderRepository({
    now: () => new Date().toISOString(), idFactory: () => crypto.randomUUID(),
  }), [useBackend, uid])
  const renewSession = useRef(false)
  const load = useCallback(async () => {
    if (useBackend) {
      if (!session.user || window.location.pathname.startsWith('/painel-fornecedor') || window.location.pathname.startsWith('/admin')) return []
      const force = renewSession.current
      renewSession.current = false
      if (typeof session.user.getIdTokenResult === 'function') {
        const { claims } = await session.user.getIdTokenResult(force)
        if (claims?.role === 'fornecedor' || claims?.fornecedor === true || claims?.role === 'admin' || claims?.admin === true) return []
      } else if (force && typeof session.user.getIdToken === 'function') await session.user.getIdToken(true)
    }
    return (await repo.list()).map(contractOrderToAccountOrder)
  }, [repo, session.user, useBackend])
  const query = useLiveOrderQuery<Order[]>(useBackend ? uid ? 'buyer:' + uid : null : 'mock-buyer', load, useBackend)
  const { setData: setOrderData, refresh: refreshQuery } = query
  const orders = query.data ?? []
  const setOrders = useCallback((update: React.SetStateAction<Order[]>) => {
    setOrderData(previous => typeof update === 'function' ? update(previous ?? []) : update)
  }, [setOrderData])
  const loading = !session.ready || query.loading
  const errorDiagnostic = useMemo(() => query.error ? diagnoseError(query.error, { operation: 'orders.load_list' }) : null, [query.error])
  const error = errorDiagnostic?.message ?? null
  const refreshOrders = useCallback(async (options?: { refreshSession?: boolean }) => {
    renewSession.current = options?.refreshSession ?? true
    await refreshQuery()
  }, [refreshQuery])
  const recordConfirmedOrders = useCallback((confirmed: ContractOrder[]) => {
    const mapped = confirmed.map(contractOrderToAccountOrder)
    setOrders(previous => [...previous.filter(order => !mapped.some(saved => saved.id === order.id)), ...mapped])
  }, [setOrders])

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

  const createOrdersFromCart = async (
    items: CartItem[],
    address: Address,
    idempotencyKey?: string,
    paymentInfo?: {
      paymentMethod?: 'pix' | 'card'
      paymentTransactionId?: string
      paymentStatus?: 'approved' | 'declined' | 'pending'
    }
  ): Promise<Order[]> => {
    let idCounter = 0
    const idFactory = () => {
      idCounter++
      return `tmp-${idCounter}` // descartado - servidor define o id real (RN-03)
    }
    const now = new Date().toISOString()

    // DEC-A: o split por fornecedor continua no front (dominio puro, ja testado, T1).
    const domainOrders = buildOrdersFromCart(items, address, idFactory, now)

    const baseKey = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`)

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
        paymentMethod: paymentInfo?.paymentMethod,
        paymentTransactionId: paymentInfo?.paymentTransactionId,
        paymentStatus: paymentInfo?.paymentStatus,
      }

      // Garante que cada pedido do split receba uma chave determinística e única
      const orderKey = domainOrders.length === 1 ? baseKey : `${baseKey}-${domainOrder.supplierId}`

      // DEC-A: uma chamada POST /orders por pedido resultante do split.
      const created = await repo.create(createRequest, orderKey)
      newOrders.push(contractOrderToAccountOrder(created))
    }

    setOrders((prev) => [...prev, ...newOrders])
    return newOrders
  }

  const cancelOrder = async (orderId: string): Promise<void> => {
    const updated = await repo.cancel(orderId)
    const mapped = contractOrderToAccountOrder(updated)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? mapped : o)))
  }

  return (
    <OrdersContext.Provider value={{ orders, loading, error, errorDiagnostic, refreshOrders, recordConfirmedOrders, createDirectOrder, createOrdersFromCart, cancelOrder }}>
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
