// src/app/(main)/minha-conta/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MOCK_USER, INITIAL_ORDERS, Order, Offer } from '@/lib/account-mock'
import { useAuth } from '@/contexts/auth-context'
import PedidosTab from '@/components/minha-conta/PedidosTab'
import OfertasTab from '@/components/minha-conta/OfertasTab'
import HistoricoTab from '@/components/minha-conta/HistoricoTab'
import PerfilTab from '@/components/minha-conta/PerfilTab'
import NovoPedidoModal from '@/components/minha-conta/NovoPedidoModal'

type TabKey = 'pedidos' | 'ofertas' | 'historico' | 'perfil'

export default function MinhaContaPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Hooks SEMPRE devem ser chamados na mesma ordem, antes de qualquer early return
  const [activeTab, setActiveTab]   = useState<TabKey>('pedidos')
  const [orders, setOrders]         = useState<Order[]>(INITIAL_ORDERS)
  const [modalOpen, setModalOpen]   = useState(false)

  // Guarda client-side: redireciona deslogado para /login?redirect=/minha-conta
  // (endurecimento SSR com session cookie fica para deploy/006 — D-010)
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/minha-conta')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null // Redirecionar em progresso
  }

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

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Área do cliente
              </p>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Olá, {(user.displayName || user.email || 'Cliente').split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-brand-muted mt-1">{user.email}</p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('pedidos')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-primary/10 hover:border-primary/30 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-primary-dark leading-none">{activeOrdersCount}</span>
                <span className="text-xs text-brand-muted mt-1">Pedidos</span>
              </button>
              <button
                onClick={() => setActiveTab('ofertas')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-accent/20 hover:border-accent/40 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-accent leading-none">{pendingOffersCount}</span>
                <span className="text-xs text-brand-muted mt-1">Ofertas</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo com tabs */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          {/* Fix: forçar flex-col pois data-horizontal:flex-col não dispara com base-ui */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
            className="flex-col"
          >
            {/* Barra de tabs — sticky no scroll */}
            <div className="sticky top-[64px] lg:top-[80px] z-10 bg-brand-bg pb-0">
              <TabsList
                variant="line"
                className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent"
              >
                <TabsTrigger
                  value="pedidos"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none"
                >
                  📦 Pedidos
                </TabsTrigger>

                <TabsTrigger
                  value="ofertas"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none"
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
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none"
                >
                  📋 Histórico
                </TabsTrigger>

                <TabsTrigger
                  value="perfil"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none"
                >
                  👤 Perfil
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-6">
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
            </div>
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
