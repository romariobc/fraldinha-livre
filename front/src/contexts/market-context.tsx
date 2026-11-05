'use client'

import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { toast } from 'sonner'
import type { MarketOrder, DirectOrder, DirectOrderStatus, SupplierOffer, DeliveryType, DispatchStatus } from '@/lib/domain/supplier'
import { MOCK_MARKET_ORDERS, MOCK_DIRECT_ORDERS, MOCK_OFFERS } from '@/lib/supplier-mock'
import { buildOfferSnapshot } from '@/lib/market-utils'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import { contractOrderToDirectOrder } from '@/lib/order-adapters'
import { useAuth } from '@/contexts/auth-context'
import type { OrderStatus } from '@contracts'
import { diagnoseError, type DiagnosticResult } from '@/lib/frontend-diagnostics'

interface MarketContextValue {
  marketOrders: MarketOrder[]
  directOrders: DirectOrder[]
  directOrdersLoading: boolean
  directOrdersError: string | null
  directOrdersDiagnostic?: DiagnosticResult | null
  refetchDirectOrders(afterPending?: boolean): Promise<void>
  offers: SupplierOffer[]
  declinedIds: Set<string>
  handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string): Promise<void>
  handleDeclineMercado(orderId: string): void
  handleConfirmarDireto(orderId: string): Promise<void>
  handleRecusarDireto(orderId: string, reason: string): Promise<void>
  handleAtualizarStatusDireto(orderId: string, status: OrderStatus, reason?: string): Promise<void>
  handleAtualizarDespacho(orderId: string, orderType: 'market' | 'direct', status: DispatchStatus): Promise<void>
  addDirectOrder(directOrder: DirectOrder): void
  cancelDirectOrder(orderId: string): void
}

const MarketContext = createContext<MarketContextValue | null>(null)

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>')
  return ctx
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { user, role, loading: authLoading } = useAuth()
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>(MOCK_MARKET_ORDERS)
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
  const loadOrders = useCallback(async () => {
    const repo = new HttpOrderRepository(user?.uid)
    return (await repo.listForSupplier()).map(contractOrderToDirectOrder)
  }, [user?.uid])
  const eligible = !authLoading && user && role === 'fornecedor'
  const query = useLiveOrderQuery<DirectOrder[]>(useBackend && eligible ? 'supplier:' + user.uid : null, loadOrders)
  const { setData: setOrderData, refresh: refreshQuery } = query
  const [mockOrders, setMockOrders] = useState<DirectOrder[]>(MOCK_DIRECT_ORDERS)
  const directOrders = useBackend ? query.data ?? [] : mockOrders
  const setDirectOrders = useCallback((update: React.SetStateAction<DirectOrder[]>) => {
    if (!useBackend) setMockOrders(update)
    else setOrderData(previous => typeof update === 'function' ? update(previous ?? []) : update)
  }, [useBackend, setOrderData])
  const directOrdersDiagnostic = useMemo(() => query.error ? diagnoseError(query.error) : null, [query.error])
  const directOrdersError = query.error ? 'Não foi possível carregar os pedidos diretos. Tente novamente.' : null
  const refetchDirectOrders = refreshQuery
  const [offers, setOffers] = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set())

  async function handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string) {
    const order = marketOrders.find((o) => o.id === orderId)!
    setMarketOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, offeredByMe: true, myOffer: { price, deliveryType, note }, status: 'ofertado' as const }
          : o
      )
    )
    setOffers((prev) => [buildOfferSnapshot(order, price, deliveryType, note), ...prev])
    // TODO: await fetch(`/api/market-orders/${orderId}/offer`, { method: 'POST', body: JSON.stringify({ price, deliveryType, note }) })
    toast.success('Oferta enviada com sucesso!')
  }

  function handleDeclineMercado(orderId: string) {
    setDeclinedIds((prev) => new Set([...prev, orderId]))
    toast.info('Pedido removido da sua fila.')
  }

  async function handleConfirmarDireto(orderId: string) {
    if (useBackend) {
      const repo: OrderRepository = new HttpOrderRepository(user?.uid)
      const saved = await repo.updateStatus(orderId, 'confirmado')
      setDirectOrders(previous => previous.map(order => order.id === orderId ? contractOrderToDirectOrder(saved) : order))
      return
    }
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmado' as const } : o))
    )
  }

  async function handleRecusarDireto(orderId: string, reason: string) {
    if (useBackend) {
      const repo: OrderRepository = new HttpOrderRepository(user?.uid)
      const saved = await repo.updateStatus(orderId, 'cancelado', reason)
      setDirectOrders(previous => previous.map(order => order.id === orderId ? contractOrderToDirectOrder(saved) : order))
      return
    }
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
    )
  }

  async function handleAtualizarStatusDireto(orderId: string, status: OrderStatus, reason?: string) {
    if (useBackend) {
      const repo: OrderRepository = new HttpOrderRepository(user?.uid)
      const saved = reason === undefined ? await repo.updateStatus(orderId, status) : await repo.updateStatus(orderId, status, reason)
      setDirectOrders(previous => previous.map(order => order.id === orderId ? contractOrderToDirectOrder(saved) : order))
      return
    }
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: status as DirectOrderStatus } : o))
    )
  }

  async function handleAtualizarDespacho(orderId: string, orderType: 'market' | 'direct', status: DispatchStatus) {
    if (orderType === 'direct') {
      setDirectOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, dispatchStatus: status } : o))
      )
    } else {
      setOffers((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, dispatchStatus: status } : o))
      )
    }
    // TODO: await fetch(`/api/orders/${orderId}/dispatch`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  function addDirectOrder(directOrder: DirectOrder) {
    setDirectOrders((prev) => [directOrder, ...prev])
  }

  function cancelDirectOrder(orderId: string) {
    setDirectOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
  }

  return (
    <MarketContext.Provider
      value={{
        marketOrders,
        directOrders,
        directOrdersLoading: useBackend && (authLoading || query.loading),
        directOrdersError,
        directOrdersDiagnostic,
        refetchDirectOrders,
        offers,
        declinedIds,
        handleEnviarOferta,
        handleDeclineMercado,
        handleConfirmarDireto,
        handleRecusarDireto,
        handleAtualizarStatusDireto,
        handleAtualizarDespacho,
        addDirectOrder,
        cancelDirectOrder,
      }}
    >
      {children}
    </MarketContext.Provider>
  )
}
