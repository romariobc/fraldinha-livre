// src/app/(main)/minha-conta/page.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MOCK_USER, INITIAL_ORDERS, Order, Offer } from '@/lib/account-mock'
import PedidosTab from '@/components/minha-conta/PedidosTab'
import OfertasTab from '@/components/minha-conta/OfertasTab'
import HistoricoTab from '@/components/minha-conta/HistoricoTab'
import PerfilTab from '@/components/minha-conta/PerfilTab'
import NovoPedidoModal from '@/components/minha-conta/NovoPedidoModal'

type TabKey = 'pedidos' | 'ofertas' | 'historico' | 'perfil'

export default function MinhaContaPage() {
  const [activeTab, setActiveTab]   = useState<TabKey>('pedidos')
  const [orders, setOrders]         = useState<Order[]>(INITIAL_ORDERS)
  const [modalOpen, setModalOpen]   = useState(false)

  // Número total de ofertas pendentes para o badge
  const pendingOffersCount = orders
    .filter((o) => o.status === 'ofertas-recebidas')
    .reduce((sum, o) => sum + (o.offers?.length ?? 0), 0)

  function handleNovoPedido(partial: Omit<Order, 'id' | 'createdAt'>) {
    const newOrder: Order = {
      ...partial,
      id: `ord-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setOrders((prev) => [newOrder, ...prev])
    toast.success('Pedido criado! Fornecedores serão notificados em breve.')
    setActiveTab('pedidos')
  }

  function handleAceitarOferta(orderId: string, offer: Offer) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'aceito' as const, price: offer.price } : o
      )
    )
    toast.success(`Oferta da ${offer.supplier} aceita! Seu pedido está confirmado.`)
    setActiveTab('pedidos')
  }

  function handleVerOfertas(_orderId: string) {
    setActiveTab('ofertas')
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-6">
        <div className="container-fl">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
            Área do cliente
          </p>
          <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
            Olá, {MOCK_USER.name.split(' ')[0]} 👋
          </h1>
        </div>
      </section>

      {/* Conteúdo com tabs */}
      <section className="bg-brand-bg min-h-[60vh] py-6">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
          >
            {/* Barra de tabs */}
            <TabsList
              variant="line"
              className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent mb-6"
            >
              <TabsTrigger
                value="pedidos"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                📦 Pedidos
              </TabsTrigger>

              <TabsTrigger
                value="ofertas"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                🏷️ Ofertas
                {pendingOffersCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                    {pendingOffersCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="historico"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                📋 Histórico
              </TabsTrigger>

              <TabsTrigger
                value="perfil"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                👤 Perfil
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pedidos">
              <PedidosTab
                orders={orders}
                onNovoPedido={() => setModalOpen(true)}
                onVerOfertas={handleVerOfertas}
              />
            </TabsContent>

            <TabsContent value="ofertas">
              <OfertasTab orders={orders} onAceitarOferta={handleAceitarOferta} />
            </TabsContent>

            <TabsContent value="historico">
              <HistoricoTab orders={orders} />
            </TabsContent>

            <TabsContent value="perfil">
              <PerfilTab user={MOCK_USER} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Modal fora das tabs para não herdar seu contexto */}
      <NovoPedidoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={MOCK_USER}
        onSubmit={handleNovoPedido}
      />
    </>
  )
}
