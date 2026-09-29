'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import AdminUsersTab from '@/components/admin/AdminUsersTab'
import AdminOrdersTab from '@/components/admin/AdminOrdersTab'
import AdminProductsTab from '@/components/admin/AdminProductsTab'
import AdminAuditTab from '@/components/admin/AdminAuditTab'

import { ShieldCheck, Users, ShoppingBag, Package, Shield } from 'lucide-react'

type TabKey = 'usuarios' | 'pedidos' | 'produtos' | 'auditoria'

export default function AdminPage() {
  const router = useRouter()
  const { user, isAdmin, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('usuarios')

  useEffect(() => {
    if (loading) return
    if (!user || !isAdmin) {
      router.push('/')
    }
  }, [loading, user, isAdmin, router])

  if (loading || !user || !isAdmin) {
    return null
  }

  return (
    <div className="container-fl py-8">
      {/* Top Header / Hero */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 mb-2">
            <Shield size={14} className="text-purple-700" />
            <span>Área Restrita do Administrador</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-brand-text">
            Painel Administrativo
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Gestão operacional de usuários, pedidos, moderação de produtos e trilha de auditoria.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs className="flex-col" value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <div className="border-b border-slate-200 pb-px">
          <TabsList className="h-auto p-1 bg-slate-100/80 border border-slate-200/80 rounded-xl w-full sm:w-auto inline-flex overflow-x-auto gap-1">
            <TabsTrigger
              value="usuarios"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all data-active:bg-white data-active:text-brand-text data-active:shadow-sm"
            >
              <Users size={16} />
              <span>Usuários</span>
            </TabsTrigger>
            <TabsTrigger
              value="pedidos"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all data-active:bg-white data-active:text-brand-text data-active:shadow-sm"
            >
              <ShoppingBag size={16} />
              <span>Pedidos</span>
            </TabsTrigger>
            <TabsTrigger
              value="produtos"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all data-active:bg-white data-active:text-brand-text data-active:shadow-sm"
            >
              <Package size={16} />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all data-active:bg-white data-active:text-brand-text data-active:shadow-sm"
            >
              <ShieldCheck size={16} />
              <span>Auditoria</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6 rounded-card bg-white p-4 sm:p-6 shadow-card border border-slate-100 min-h-[400px]">
          <TabsContent value="usuarios"><AdminUsersTab /></TabsContent>
          <TabsContent value="pedidos"><AdminOrdersTab /></TabsContent>
          <TabsContent value="produtos"><AdminProductsTab /></TabsContent>
          <TabsContent value="auditoria"><AdminAuditTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
