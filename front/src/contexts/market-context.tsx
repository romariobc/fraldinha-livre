'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { MarketOrder, DirectOrder, DirectOrderStatus, SupplierOffer, DeliveryType, DispatchStatus } from '@/lib/supplier-mock'
import { MOCK_MARKET_ORDERS, MOCK_DIRECT_ORDERS, MOCK_OFFERS } from '@/lib/supplier-mock'
import { buildOfferSnapshot } from '@/lib/market-utils'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import { contractOrderToDirectOrder } from '@/lib/order-adapters'
import { useAuth } from '@/contexts/auth-context'
import type { OrderStatus } from '@contracts'
import { diagnoseError, logFrontendDiagnostic, type DiagnosticResult } from '@/lib/frontend-diagnostics'

interface MarketContextValue {
  marketOrders: MarketOrder[]
  directOrders: DirectOrder[]
  directOrdersLoading: boolean
  directOrdersError: string | null
  directOrdersDiagnostic?: DiagnosticResult | null
  refetchDirectOrders(): Promise<void>
  offers: SupplierOffer[]
  declinedIds: Set<string>
  handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string): Promise<void>
  handleDeclineMercado(orderId: string): void
  handleConfirmarDireto(orderId: string): Promise<void>
  handleRecusarDireto(orderId: string): Promise<void>
  handleAtualizarStatusDireto(orderId: string, status: OrderStatus): Promise<void>
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
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>(
    useBackend ? [] : MOCK_DIRECT_ORDERS
  )
  const [directOrdersLoading, setDirectOrdersLoading] = useState(useBackend)
  const [directOrdersError, setDirectOrdersError] = useState<string | null>(null)
  const [directOrdersDiagnostic, setDirectOrdersDiagnostic] = useState<DiagnosticResult | null>(null)
  const [directOrdersDataOwnerUid, setDirectOrdersDataOwnerUid] = useState<string | null>(null)
  const [directOrdersQueryOwnerUid, setDirectOrdersQueryOwnerUid] = useState<string | null>(null)
  const [offers, setOffers] = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set())

  // Ref sequencial para controle estrito de concorrência e descarte de respostas tardias
  const activeFetchIdRef = useRef(0)

  const refetchDirectOrders = useCallback(async () => {
    if (!useBackend) return
    if (authLoading) return
    if (!user || role !== 'fornecedor') return

    const fetchId = ++activeFetchIdRef.current
    const currentUid = user.uid
    setDirectOrdersLoading(true)
    setDirectOrdersError(null)
    setDirectOrdersDiagnostic(null)

    const repo: OrderRepository = new HttpOrderRepository()
    try {
      const result = await repo.listForSupplier()
      if (fetchId !== activeFetchIdRef.current) return
      setDirectOrders(result.map(contractOrderToDirectOrder))
      setDirectOrdersDataOwnerUid(currentUid)
      setDirectOrdersQueryOwnerUid(currentUid)
    } catch (err) {
      if (fetchId !== activeFetchIdRef.current) return
      console.error('Erro ao carregar pedidos diretos:', err)
      const diag = diagnoseError(err)
      logFrontendDiagnostic(diag, { operation: 'listForSupplier' })
      setDirectOrdersError('Não foi possível carregar os pedidos diretos. Tente novamente.')
      setDirectOrdersDiagnostic(diag)
      setDirectOrdersQueryOwnerUid(currentUid)
    } finally {
      if (fetchId === activeFetchIdRef.current) {
        setDirectOrdersLoading(false)
      }
    }
  }, [useBackend, authLoading, user, role])

  useEffect(() => {
    if (!useBackend) return
    if (authLoading) return
    if (!user || role !== 'fornecedor') return

    const fetchId = ++activeFetchIdRef.current
    const currentUid = user.uid

    const repo: OrderRepository = new HttpOrderRepository()

    repo
      .listForSupplier()
      .then((result) => {
        if (fetchId !== activeFetchIdRef.current) return
        setDirectOrders(result.map(contractOrderToDirectOrder))
        setDirectOrdersDataOwnerUid(currentUid)
        setDirectOrdersQueryOwnerUid(currentUid)
        setDirectOrdersError(null)
        setDirectOrdersDiagnostic(null)
      })
      .catch((err) => {
        if (fetchId !== activeFetchIdRef.current) return
        console.error('Erro ao carregar pedidos diretos:', err)
        const diag = diagnoseError(err)
        logFrontendDiagnostic(diag, { operation: 'listForSupplier' })
        setDirectOrdersError('Não foi possível carregar os pedidos diretos. Tente novamente.')
        setDirectOrdersDiagnostic(diag)
        setDirectOrdersQueryOwnerUid(currentUid)
      })
      .finally(() => {
        if (fetchId === activeFetchIdRef.current) {
          setDirectOrdersLoading(false)
        }
      })

    const fetchIdRef = activeFetchIdRef
    return () => {
      fetchIdRef.current++
    }
  }, [useBackend, authLoading, user, role])

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
      const repo: OrderRepository = new HttpOrderRepository()
      await repo.updateStatus(orderId, 'confirmado')
    }
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmado' as const } : o))
    )
  }

  async function handleRecusarDireto(orderId: string) {
    if (useBackend) {
      const repo: OrderRepository = new HttpOrderRepository()
      await repo.updateStatus(orderId, 'cancelado')
    }
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
    )
  }

  async function handleAtualizarStatusDireto(orderId: string, status: OrderStatus) {
    if (useBackend) {
      const repo: OrderRepository = new HttpOrderRepository()
      await repo.updateStatus(orderId, status)
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
    if (user) {
      setDirectOrdersDataOwnerUid(user.uid)
      setDirectOrdersQueryOwnerUid(user.uid)
    }
    setDirectOrders((prev) => [directOrder, ...prev])
  }

  function cancelDirectOrder(orderId: string) {
    setDirectOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
  }

  // Deriva loading, dados e erros expostos em vez de setState no corpo do effect (react-hooks/set-state-in-effect):
  // separando a propriedade dos dados (directOrdersDataOwnerUid) da propriedade do estado de consulta/erro (directOrdersQueryOwnerUid).
  const isEligibleSupplier = Boolean(user && role === 'fornecedor')
  const hasDataForCurrentAccount = Boolean(user && directOrdersDataOwnerUid === user.uid)
  const hasQueryForCurrentAccount = Boolean(user && directOrdersQueryOwnerUid === user.uid)

  const directOrdersExposed =
    useBackend && (!isEligibleSupplier || !hasDataForCurrentAccount)
      ? []
      : directOrders

  const directOrdersErrorExposed =
    useBackend && (!isEligibleSupplier || !hasQueryForCurrentAccount)
      ? null
      : directOrdersError

  const directOrdersDiagnosticExposed =
    useBackend && (!isEligibleSupplier || !hasQueryForCurrentAccount)
      ? null
      : directOrdersDiagnostic

  const directOrdersLoadingExposed =
    useBackend && (authLoading || (isEligibleSupplier && (directOrdersLoading || !hasQueryForCurrentAccount)))

  return (
    <MarketContext.Provider
      value={{
        marketOrders,
        directOrders: directOrdersExposed,
        directOrdersLoading: directOrdersLoadingExposed,
        directOrdersError: directOrdersErrorExposed,
        directOrdersDiagnostic: directOrdersDiagnosticExposed,
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
