// src/app/(main)/minha-conta/page.tsx
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/contexts/orders-context'
import { copySupportCode } from '@/lib/frontend-diagnostics'
import PedidosTab from '@/components/minha-conta/PedidosTab'
import HistoricoTab from '@/components/minha-conta/HistoricoTab'
import PerfilTab from '@/components/minha-conta/PerfilTab'

type TabKey = 'pedidos' | 'historico' | 'perfil'

function MinhaContaContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { orders, loading: ordersLoading, error: ordersError, errorDiagnostic, refreshOrders } = useOrders()

  // Hooks SEMPRE devem ser chamados na mesma ordem, antes de qualquer early return
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tabParam = searchParams.get('tab') as TabKey | null
    return (tabParam && ['pedidos', 'historico', 'perfil'].includes(tabParam)) ? tabParam : 'pedidos'
  })

  const [copiedCode, setCopiedCode] = useState(false)

  const returnTo = searchParams.get('returnTo')

  if (!user) return null

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
                <span className="font-black text-2xl text-primary-dark leading-none">
                  {ordersLoading ? '—' : activeOrdersCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Pedidos</span>
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
                {ordersLoading ? (
                  <div className="text-center py-12 text-brand-muted">
                    <p className="font-semibold text-sm">Carregando pedidos...</p>
                  </div>
                ) : ordersError ? (
                  <div className="bg-white rounded-2xl p-6 sm:p-8 border border-red-200 shadow-card text-center max-w-lg mx-auto">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-base font-bold text-brand-text mb-2">
                      Não foi possível carregar seus pedidos
                    </h3>
                    <p className="text-sm text-brand-muted mb-4">
                      {ordersError}
                    </p>
                    {errorDiagnostic?.requestId && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-left text-xs text-brand-muted flex items-center justify-between gap-3">
                        <span className="font-mono truncate">
                          Código de suporte: <strong className="text-brand-text">{errorDiagnostic.requestId}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void copySupportCode(errorDiagnostic.requestId!).then((copied) => {
                              if (copied) {
                                setCopiedCode(true)
                                setTimeout(() => setCopiedCode(false), 2000)
                              }
                            })
                          }}
                          className="text-xs font-semibold text-primary-dark hover:underline flex-none cursor-pointer"
                        >
                          {copiedCode ? 'Copiado!' : 'Copiar código'}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshOrders?.()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-dark text-white rounded-xl font-bold text-sm hover:bg-primary transition-colors shadow-sm cursor-pointer"
                    >
                      <RotateCw size={16} />
                      Tentar novamente
                    </button>
                  </div>
                ) : (
                  <PedidosTab orders={orders} />
                )}
              </TabsContent>

              <TabsContent value="historico">
                {ordersLoading ? (
                  <div className="text-center py-12 text-brand-muted">
                    <p className="font-semibold text-sm">Carregando pedidos...</p>
                  </div>
                ) : ordersError ? (
                  <div className="bg-white rounded-2xl p-6 sm:p-8 border border-red-200 shadow-card text-center max-w-lg mx-auto">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-base font-bold text-brand-text mb-2">
                      Não foi possível carregar o histórico
                    </h3>
                    <p className="text-sm text-brand-muted mb-4">
                      {ordersError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void refreshOrders?.()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-dark text-white rounded-xl font-bold text-sm hover:bg-primary transition-colors shadow-sm cursor-pointer"
                    >
                      <RotateCw size={16} />
                      Tentar novamente
                    </button>
                  </div>
                ) : (
                  <HistoricoTab orders={orders} />
                )}
              </TabsContent>

              <TabsContent value="perfil">
                <PerfilTab returnTo={returnTo ?? undefined} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </>
  )
}

export default function MinhaContaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <MinhaContaContent />
    </Suspense>
  )
}
