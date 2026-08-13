'use client'

import { useState } from 'react'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ShoppingBag, Package, Settings, Store, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

type TabKey = 'pedidos' | 'catalogo' | 'configuracoes'

function PainelFornecedorContent() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('pedidos')

  return (
    <>
      {/* Hero Header */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                <Store className="w-3.5 h-3.5" />
                Painel da Distribuidora
              </div>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Painel da Distribuidora
              </h1>
              <p className="text-sm text-brand-muted mt-1">
                Bem-vindo, {user?.displayName || user?.email || 'Fornecedor'}. Gerencie seus pedidos, catálogo e loja.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-card border border-primary/10 flex items-center gap-3">
                <div className="p-2.5 bg-primary-light rounded-xl text-primary-dark">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-brand-muted block">Status da Conta</span>
                  <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fornecedor Verificado
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs & Content */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
            className="flex-col"
          >
            {/* Sticky Tabs Navigation */}
            <div className="sticky top-[64px] lg:top-[80px] z-10 bg-brand-bg pb-0">
              <TabsList
                variant="line"
                className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent overflow-x-auto"
              >
                <TabsTrigger
                  value="pedidos"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Pedidos Recebidos
                </TabsTrigger>

                <TabsTrigger
                  value="catalogo"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap gap-2"
                >
                  <Package className="w-4 h-4" />
                  Meu Catálogo
                </TabsTrigger>

                <TabsTrigger
                  value="configuracoes"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Configurações da Loja
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Contents */}
            <div className="pt-6">
              {/* Tab 1: Pedidos Recebidos */}
              <TabsContent value="pedidos" className="outline-none">
                <div className="bg-white rounded-2xl p-6 shadow-card border border-primary/10 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-primary" />
                        Pedidos Recebidos
                      </h2>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Acompanhe e gerencie as solicitações enviadas pelos compradores.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-brand-bg/50 p-4 rounded-xl border border-gray-100">
                      <span className="text-xs text-brand-muted font-medium">Pedidos Pendentes</span>
                      <p className="text-2xl font-black text-brand-text mt-1">0</p>
                    </div>
                    <div className="bg-brand-bg/50 p-4 rounded-xl border border-gray-100">
                      <span className="text-xs text-brand-muted font-medium">Em Processamento</span>
                      <p className="text-2xl font-black text-brand-text mt-1">0</p>
                    </div>
                    <div className="bg-brand-bg/50 p-4 rounded-xl border border-gray-100">
                      <span className="text-xs text-brand-muted font-medium">Concluídos este Mês</span>
                      <p className="text-2xl font-black text-brand-text mt-1">0</p>
                    </div>
                  </div>

                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <Clock className="w-10 h-10 text-brand-muted mx-auto mb-3 opacity-50" />
                    <h3 className="text-base font-semibold text-brand-text">Nenhum pedido recebido no momento</h3>
                    <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                      Os novos pedidos encaminhados para sua distribuidora aparecerão aqui em tempo real.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Meu Catálogo */}
              <TabsContent value="catalogo" className="outline-none">
                <div className="bg-white rounded-2xl p-6 shadow-card border border-primary/10 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Meu Catálogo de Produtos
                      </h2>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Gerencie os produtos, preços e disponibilidade no seu catálogo exclusivo.
                      </p>
                    </div>
                  </div>

                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <Package className="w-10 h-10 text-brand-muted mx-auto mb-3 opacity-50" />
                    <h3 className="text-base font-semibold text-brand-text">Catálogo da Distribuidora</h3>
                    <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                      Cadastre e organize seus produtos comercializados para atender os compradores cadastrados.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Configurações da Loja */}
              <TabsContent value="configuracoes" className="outline-none">
                <div className="bg-white rounded-2xl p-6 shadow-card border border-primary/10 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        Configurações da Loja
                      </h2>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Ajuste as informações comerciais e operacionais da distribuidora.
                      </p>
                    </div>
                  </div>

                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <Settings className="w-10 h-10 text-brand-muted mx-auto mb-3 opacity-50" />
                    <h3 className="text-base font-semibold text-brand-text">Configurações Gerais</h3>
                    <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                      Defina políticas de entrega, dados cadastrais e opções de atendimento da sua empresa.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </>
  )
}

export default function PainelFornecedorPage() {
  return (
    <RoleProtectedRoute allowedRoles={['fornecedor']}>
      <PainelFornecedorContent />
    </RoleProtectedRoute>
  )
}
