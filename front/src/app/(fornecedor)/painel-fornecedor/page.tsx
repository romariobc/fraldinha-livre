'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import OrderReportPanel from '@/components/OrderReportPanel'

export default function SupplierDashboardOverviewPage() {
  const { user } = useAuth()
  return <div className="space-y-6 min-w-0">
    <h1 className="font-display text-2xl font-bold">Olá, {user?.displayName || 'fornecedor'}!</h1>
    <p>Acompanhe seus pedidos. Compra, pagamento e entrega continuam simulados.</p>
    <nav aria-label="Atalhos do fornecedor" className="flex flex-wrap gap-4 text-primary-dark underline">
      <Link href="/painel-fornecedor/catalogo">Gerenciar catálogo</Link>
      <Link href="/painel-fornecedor/pedidos">Acompanhar pedidos</Link>
      <Link href="/painel-fornecedor/relatorios">Relatórios</Link>
    </nav>
    <OrderReportPanel scope="fornecedor" />
  </div>
}
