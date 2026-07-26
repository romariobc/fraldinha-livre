'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMarket } from '@/contexts/market-context'
import { useAuth } from '@/contexts/auth-context'
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import OfertasMercadoTab from '@/components/fornecedor/OfertasMercadoTab'
import LogisticaTab      from '@/components/fornecedor/LogisticaTab'
import PerfilTab         from '@/components/fornecedor/PerfilTab'
import CatalogoTab       from '@/components/fornecedor/CatalogoTab'

type TabKey = 'diretos' | 'ofertas' | 'logistica' | 'catalogo' | 'perfil'

export default function FornecedorPainelPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Hooks SEMPRE devem ser chamados na mesma ordem, antes de qualquer early return
  const [activeTab, setActiveTab] = useState<TabKey>('diretos')
  const { directOrders, directOrdersLoading, directOrdersError, offers, handleConfirmarDireto, handleRecusarDireto } = useMarket()

  // Guarda client-side: redireciona deslogado para /login?redirect=/fornecedor/painel
  // (endurecimento SSR com session cookie fica para deploy/006 — D-010)
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/fornecedor/painel')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null // Redirecionar em progresso
  }

  const pendingDirectCount  = directOrders.filter((o) => o.status === 'aguardando').length
  const pendingOffersCount  = offers.filter((o) => o.status === 'enviada').length
  const inDeliveryCount     =
    offers.filter((o) => o.status === 'aceita').length +
    directOrders.filter((o) => o.status === 'confirmado').length

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Hub do Fornecedor
              </p>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Olá, {(user.displayName || user.email || 'Fornecedor').split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-brand-muted mt-1">{user.email}</p>
            </div>

            <div className="flex flex-wrap gap-3 items-start">
              {/* Counter: Diretos */}
              <button
                type="button"
                onClick={() => setActiveTab('diretos')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-accent/20 hover:border-accent/40 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-accent leading-none">
                  {pendingDirectCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Diretos</span>
              </button>

              {/* Counter: Ofertas */}
              <button
                type="button"
                onClick={() => setActiveTab('ofertas')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-primary/10 hover:border-primary/30 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-primary-dark leading-none">
                  {pendingOffersCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Ofertas</span>
              </button>

              {/* Counter: Entregas */}
              <button
                type="button"
                onClick={() => setActiveTab('logistica')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-green-200 hover:border-green-400 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-green-600 leading-none">
                  {inDeliveryCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Entregas</span>
              </button>

              {/* Shortcut to /mercado */}
              <Link
                href="/mercado"
                className="flex items-center gap-1.5 bg-primary-dark text-white text-xs font-display font-black px-4 py-3 rounded-2xl shadow-card hover:bg-primary transition-colors"
              >
                🏷️ Ver Mercado →
              </Link>
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
                <TabsTrigger
                  value="diretos"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🛒 Pedidos Diretos
                  {pendingDirectCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                      {pendingDirectCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="ofertas"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  💬 Ofertas de Mercado
                </TabsTrigger>
                <TabsTrigger
                  value="logistica"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🚚 Logística
                </TabsTrigger>
                <TabsTrigger
                  value="catalogo"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  📦 Catálogo
                </TabsTrigger>
                <TabsTrigger
                  value="perfil"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🏢 Perfil
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-6">
              <TabsContent value="diretos">
                {directOrdersLoading ? (
                  <div className="flex items-center justify-center py-16 text-brand-muted">Carregando pedidos...</div>
                ) : directOrdersError ? (
                  <div className="flex items-center justify-center py-16 text-red-600">{directOrdersError}</div>
                ) : (
                  <PedidosDiretosTab
                    orders={directOrders}
                    onConfirmar={handleConfirmarDireto}
                    onRecusar={handleRecusarDireto}
                  />
                )}
              </TabsContent>
              <TabsContent value="ofertas">
                <OfertasMercadoTab />
              </TabsContent>
              <TabsContent value="logistica">
                <LogisticaTab />
              </TabsContent>
              <TabsContent value="catalogo">
                <CatalogoTab />
              </TabsContent>
              <TabsContent value="perfil">
                <PerfilTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </>
  )
}
