'use client'

import OrderReportPanel from '@/components/OrderReportPanel'

export default function RelatoriosPage() {
  return <div className="space-y-6 min-w-0"><h1 className="font-display text-2xl font-bold">Relatórios de pedidos</h1><OrderReportPanel scope="fornecedor" /></div>
}
