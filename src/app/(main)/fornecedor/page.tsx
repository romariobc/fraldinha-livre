// src/app/(main)/fornecedor/page.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  MOCK_SUPPLIER,
  MOCK_MARKET_ORDERS,
  MOCK_DIRECT_ORDERS,
  MOCK_OFFERS,
  MarketOrder,
  DirectOrder,
  SupplierOffer,
} from '@/lib/supplier-mock'
import MercadoTab        from '@/components/fornecedor/MercadoTab'
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import MinhasOfertasTab  from '@/components/fornecedor/MinhasOfertasTab'
import HistoricoTab      from '@/components/fornecedor/HistoricoTab'
import PerfilTab         from '@/components/fornecedor/PerfilTab'
import EnviarOfertaModal from '@/components/fornecedor/EnviarOfertaModal'

type TabKey = 'pedidos-diretos' | 'mercado' | 'minhas-ofertas' | 'historico' | 'perfil'

export default function FornecedorPage() {
  const [activeTab, setActiveTab]         = useState<TabKey>('pedidos-diretos')
  const [marketOrders, setMarketOrders]   = useState<MarketOrder[]>(MOCK_MARKET_ORDERS)
  const [directOrders, setDirectOrders]   = useState<DirectOrder[]>(MOCK_DIRECT_ORDERS)
  const [offers, setOffers]               = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds]     = useState<Set<string>>(new Set())
  const [ofertaModal, setOfertaModal]     = useState<MarketOrder | null>(null)

  const pendingDirectCount = directOrders.filter((o) => o.status === 'aguardando').length
  const openMarketCount    = marketOrders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id)
  ).length
  const sentOffersCount    = offers.filter((o) => o.status === 'enviada').length

  function handleEnviarOferta(
    orderId: string,
    price: number,
    deliveryDays: number,
    note?: string
  ) {
    setMarketOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, offeredByMe: true, myOffer: { price, deliveryDays, note }, status: 'ofertado' as const }
          : o
      )
    )
    const order = marketOrders.find((o) => o.id === orderId)
    if (order) {
      const newOffer: SupplierOffer = {
        id: `sof-${Date.now()}`,
        orderId,
        product: order.product,
        quantity: order.quantity,
        unit: order.unit,
        buyerCity: order.buyerCity,
        buyerState: order.buyerState,
        price,
        deliveryDays,
        note,
        status: 'enviada',
        createdAt: new Date().toISOString(),
      }
      setOffers((prev) => [newOffer, ...prev])
    }
    setOfertaModal(null)
    toast.success('Oferta enviada com sucesso!')
  }

  function handleDeclineMercado(orderId: string) {
    setDeclinedIds((prev) => new Set([...prev, orderId]))
    toast.info('Pedido removido da sua fila.')
  }

  function handleConfirmarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: 'confirmado' as const } : o)
    )
    toast.success('Pedido confirmado! O comprador será notificado.')
  }

  function handleRecusarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: 'cancelado' as const } : o)
    )
    toast.info('Pedido recusado.')
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Área do fornecedor
              </p>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Olá, {MOCK_SUPPLIER.name.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-brand-muted mt-1">{MOCK_SUPPLIER.email}</p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('pedidos-diretos')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-accent/20 hover:border-accent/40 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-accent leading-none">{pendingDirectCount}</span>
                <span className="text-xs text-brand-muted mt-1">Diretos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mercado')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-primary/10 hover:border-primary/30 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-primary-dark leading-none">{openMarketCount}</span>
                <span className="text-xs text-brand-muted mt-1">Mercado</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('minhas-ofertas')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-green-200 hover:border-green-400 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-green-600 leading-none">{sentOffersCount}</span>
                <span className="text-xs text-brand-muted mt-1">Ofertas</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
            className="flex-col"
          >
            <div className="sticky top-[64px] lg:top-[80px] z-10 bg-brand-bg pb-0">
              <TabsList
                variant="line"
                className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent overflow-x-auto"
              >
                <TabsTrigger value="pedidos-diretos" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  🛒 Pedidos Diretos
                  {pendingDirectCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                      {pendingDirectCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mercado" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  🏷️ Mercado
                </TabsTrigger>
                <TabsTrigger value="minhas-ofertas" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  💬 Minhas Ofertas
                </TabsTrigger>
                <TabsTrigger value="historico" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  📦 Histórico
                </TabsTrigger>
                <TabsTrigger value="perfil" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  👤 Perfil
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-6">
              <TabsContent value="pedidos-diretos">
                <PedidosDiretosTab
                  orders={directOrders}
                  onConfirmar={handleConfirmarDireto}
                  onRecusar={handleRecusarDireto}
                />
              </TabsContent>
              <TabsContent value="mercado">
                <MercadoTab
                  orders={marketOrders}
                  declinedIds={declinedIds}
                  onEnviarOferta={(order) => setOfertaModal(order)}
                  onDecline={handleDeclineMercado}
                />
              </TabsContent>
              <TabsContent value="minhas-ofertas">
                <MinhasOfertasTab offers={offers} />
              </TabsContent>
              <TabsContent value="historico">
                <HistoricoTab directOrders={directOrders} offers={offers} />
              </TabsContent>
              <TabsContent value="perfil">
                <PerfilTab supplier={MOCK_SUPPLIER} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>

      {/* Modal */}
      <EnviarOfertaModal
        order={ofertaModal}
        open={ofertaModal !== null}
        onOpenChange={(open) => { if (!open) setOfertaModal(null) }}
        onSubmit={handleEnviarOferta}
      />
    </>
  )
}
