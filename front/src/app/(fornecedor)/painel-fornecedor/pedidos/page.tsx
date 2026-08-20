'use client'

import * as React from 'react'
import { ShoppingBag, Clock, CheckCircle2, DollarSign } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { OrdersDataTable } from '@/components/fornecedor/OrdersDataTable'
import { useMarket } from '@/contexts/market-context'
import { formatPrice } from '@/lib/utils'

export default function PedidosPage() {
  const { directOrders } = useMarket()

  // Quick summary counts
  const summary = React.useMemo(() => {
    const orders = directOrders || []
    const total = orders.length
    const pending = orders.filter((o) => o.status === 'aguardando').length
    const confirmed = orders.filter((o) => o.status === 'confirmado').length
    const totalRevenueCents = orders
      .filter((o) => o.status !== 'cancelado')
      .reduce((sum, o) => sum + (o.price || 0), 0)

    return {
      total,
      pending,
      confirmed,
      totalRevenueFormatted: formatPrice(totalRevenueCents),
    }
  }, [directOrders])

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-brand-text flex items-center gap-2.5">
            <ShoppingBag className="size-6 text-primary-dark" />
            Gestão de Pedidos
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Acompanhe pedidos diretos recebidos dos compradores, filtre status e gerencie o fluxo de entrega.
          </p>
        </div>
      </div>

      {/* Mini KPI Highlights */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Aguardando Confirmação</p>
            <p className="text-xl font-bold font-display text-foreground mt-0.5">
              {summary.pending} <span className="text-xs font-normal text-muted-foreground">pedidos</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Confirmados / Em Rota</p>
            <p className="text-xl font-bold font-display text-foreground mt-0.5">
              {summary.confirmed} <span className="text-xs font-normal text-muted-foreground">pedidos</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Receita Bruta em Pedidos</p>
            <p className="text-xl font-bold font-display text-primary-dark mt-0.5">
              {summary.totalRevenueFormatted}
            </p>
          </div>
        </div>
      </div>

      {/* Data Table Card */}
      <Card className="border-border shadow-xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle>Histórico de Pedidos Recebidos</CardTitle>
          <CardDescription>
            Use a busca por texto ou clique nos cabeçalhos das colunas para ordenar a listagem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersDataTable />
        </CardContent>
      </Card>
    </div>
  )
}
