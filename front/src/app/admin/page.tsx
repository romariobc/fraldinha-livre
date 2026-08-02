'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import AdminUsersTab from '@/components/admin/AdminUsersTab'
import AdminOrdersTab from '@/components/admin/AdminOrdersTab'
import AdminProductsTab from '@/components/admin/AdminProductsTab'

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID

type TabKey = 'usuarios' | 'pedidos' | 'produtos'

export default function AdminPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('usuarios')

  useEffect(() => {
    if (loading) return
    if (!user || user.uid !== ADMIN_UID) {
      router.push('/')
    }
  }, [loading, user, router])

  if (loading || !user || user.uid !== ADMIN_UID) {
    return null
  }

  return (
    <div className="container-fl py-8">
      <h1 className="font-display font-black text-2xl mb-6">Painel Administrativo</h1>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios"><AdminUsersTab /></TabsContent>
        <TabsContent value="pedidos"><AdminOrdersTab /></TabsContent>
        <TabsContent value="produtos"><AdminProductsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
