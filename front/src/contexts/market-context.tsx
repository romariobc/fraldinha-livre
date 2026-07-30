'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { MarketOrder, DirectOrder, SupplierOffer, DeliveryType, DispatchStatus } from '@/lib/supplier-mock'
import { MOCK_MARKET_ORDERS, MOCK_DIRECT_ORDERS, MOCK_OFFERS } from '@/lib/supplier-mock'
import { buildOfferSnapshot } from '@/lib/market-utils'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import { contractOrderToDirectOrder } from '@/lib/order-adapters'
import { useAuth } from '@/contexts/auth-context'

interface MarketContextValue {
  marketOrders: MarketOrder[]
  directOrders: DirectOrder[]
  directOrdersLoading: boolean
  directOrdersError: string | null
  offers: SupplierOffer[]
  declinedIds: Set<string>
  handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string): Promise<void>
  handleDeclineMercado(orderId: string): void
  handleConfirmarDireto(orderId: string): Promise<void>
  handleRecusarDireto(orderId: string): Promise<void>
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
  const [offers, setOffers] = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!useBackend) return // modo mock: mantem MOCK_DIRECT_ORDERS estatico, sem fetch (decisao item 3)
    if (authLoading) return // aguarda o Firebase resolver a sessao antes de decidir

    // MarketProvider envolve todo o route group (main), inclusive paginas publicas
    // (landing, catalogo). listForSupplier() e autenticado e so faz sentido pro
    // fornecedor logado no proprio painel — sem esse gate, todo visitante anonimo
    // dispara um GET /orders?scope=fornecedor que sempre volta 401 (e, pior, o
    // mesmo acontecia ate pro fornecedor de verdade: o efeito rodava antes do
    // Firebase restaurar a sessao, api-client saia sem token e a chamada tambem
    // caia em 401 — mesma classe de bug ja corrigida antes em OrdersProvider/B9).
    if (!user || role !== 'fornecedor') return // directOrdersLoadingExposed cobre o estado exibido

    let cancelled = false
    const repo: OrderRepository = new HttpOrderRepository()

    const load = async () => {
      if (cancelled) return
      setDirectOrdersLoading(true)
      setDirectOrdersError(null)
      try {
        const result = await repo.listForSupplier()
        if (cancelled) return
        setDirectOrders(result.map(contractOrderToDirectOrder))
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar pedidos diretos:', err)
        setDirectOrdersError('Não foi possível carregar os pedidos diretos. Tente novamente.')
      } finally {
        if (cancelled) return
        setDirectOrdersLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
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
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmado' as const } : o))
    )
    // TODO: await fetch(`/api/direct-orders/${orderId}/confirm`, { method: 'POST' })
    toast.success('Pedido confirmado! O comprador será notificado.')
  }

  async function handleRecusarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
    )
    // TODO: await fetch(`/api/direct-orders/${orderId}/refuse`, { method: 'POST' })
    toast.info('Pedido recusado.')
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

  // Deriva o loading exposto em vez de setState no corpo do effect (react-hooks/set-state-in-effect):
  // enquanto o Firebase resolve a sessao, mostra loading; se nao e fornecedor logado, nunca carrega.
  const directOrdersLoadingExposed =
    useBackend && (authLoading || (!!user && role === 'fornecedor' && directOrdersLoading))

  return (
    <MarketContext.Provider
      value={{
        marketOrders,
        directOrders,
        directOrdersLoading: directOrdersLoadingExposed,
        directOrdersError,
        offers,
        declinedIds,
        handleEnviarOferta,
        handleDeclineMercado,
        handleConfirmarDireto,
        handleRecusarDireto,
        handleAtualizarDespacho,
        addDirectOrder,
        cancelDirectOrder,
      }}
    >
      {children}
    </MarketContext.Provider>
  )
}
