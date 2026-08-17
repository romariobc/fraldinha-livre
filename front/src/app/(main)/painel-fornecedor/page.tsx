'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Receipt,
  Truck,
  AlertTriangle,
  ShoppingBag,
  Package,
  BarChart3,
  Settings,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

import { MetricCard } from '@/components/fornecedor/MetricCard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSupplierData } from '@/hooks/use-supplier-data'

export default function SupplierDashboardOverviewPage() {
  const {
    supplier,
    metrics,
    recentOrders,
    catalogSummary,
    loading,
  } = useSupplierData()

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* ── Welcome Banner ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-light/80 via-background to-white p-6 sm:p-8 border border-primary/20 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary-dark border-primary/30 font-bold px-2.5 py-0.5 text-xs gap-1"
              >
                <Sparkles className="size-3" />
                Painel da Distribuidora B2B
              </Badge>
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-green-600" />
                Status:{' '}
                <span className="text-green-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="size-3" /> Verificado
                </span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-tight">
              Olá, {supplier.name}! 👋
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Acompanhe em tempo real as métricas de faturamento, pedidos e desempenho logístico da sua distribuidora.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold bg-background hover:bg-muted"
              render={
                <Link href="/painel-fornecedor/catalogo">
                  <Package className="size-3.5 text-primary-dark" />
                  <span>Gerenciar Catálogo ({catalogSummary.totalProducts})</span>
                </Link>
              }
            />
            <Button
              nativeButton={false}
              variant="default"
              size="sm"
              className="gap-2 text-xs font-semibold shadow-xs"
              render={
                <Link href="/painel-fornecedor/pedidos">
                  <ShoppingBag className="size-3.5" />
                  <span>Ver Pedidos</span>
                </Link>
              }
            />
          </div>
        </div>
      </section>

      {/* ── 4-Card Metric Grid ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-4 text-primary-dark" />
            Indicadores de Desempenho (KPIs)
          </h2>
          <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Receita Total */}
          <MetricCard
            data-testid="metric-card-receita"
            title="Receita Total"
            value={metrics.totalRevenueFormatted}
            change={{
              value: metrics.revenueChangePercent,
              label: 'vs mês anterior',
              isPositiveGood: true,
              trend: 'up',
            }}
            icon={DollarSign}
            variant="primary"
            sparklineData={metrics.sparklines.revenue}
            loading={loading}
          />

          {/* Card 2: Ticket Médio */}
          <MetricCard
            data-testid="metric-card-ticket"
            title="Ticket Médio"
            value={metrics.averageTicketFormatted}
            change={{
              value: metrics.ticketChangePercent,
              label: 'vs mês anterior',
              isPositiveGood: true,
              trend: 'up',
            }}
            icon={Receipt}
            variant="info"
            sparklineData={metrics.sparklines.averageTicket}
            loading={loading}
          />

          {/* Card 3: Entregas Concluídas */}
          <MetricCard
            data-testid="metric-card-entregas"
            title="Entregas Concluídas"
            value={`${metrics.totalDeliveries} pedidos`}
            change={{
              value: metrics.deliveriesChangePercent,
              label: `taxa ${metrics.deliverySuccessRate}%`,
              isPositiveGood: true,
              trend: 'up',
            }}
            icon={Truck}
            variant="success"
            sparklineData={metrics.sparklines.deliveries}
            loading={loading}
          />

          {/* Card 4: Pedidos Cancelados */}
          <MetricCard
            data-testid="metric-card-cancelados"
            title="Pedidos Cancelados"
            value={`${metrics.totalCancellations} cancelamentos`}
            change={{
              value: metrics.cancellationsChangePercent,
              label: `taxa ${metrics.cancellationRate}%`,
              isPositiveGood: false,
              trend: 'down',
            }}
            icon={AlertTriangle}
            variant="danger"
            sparklineData={metrics.sparklines.cancellations}
            loading={loading}
          />
        </div>
      </section>

      {/* ── Main Content Grid (Recent Activity + Quick Shortcuts) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pedidos Recentes / Atividade Recente */}
        <section className="lg:col-span-2 space-y-4">
          <Card className="border-border shadow-2xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="size-4 text-primary-dark" />
                  Pedidos Recentes
                </CardTitle>
                <CardDescription className="text-xs">
                  Últimos pedidos recebidos diretamente pela sua loja
                </CardDescription>
              </div>
              <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="text-xs font-semibold gap-1 text-primary-dark hover:text-primary hover:bg-primary-light"
                render={
                  <Link href="/painel-fornecedor/pedidos">
                    <span>Ver todos</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
              />
            </CardHeader>

            <CardContent className="pt-2">
              {recentOrders.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                  <Clock className="size-8 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">Nenhum pedido recente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Novos pedidos enviados por compradores aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] font-bold text-muted-foreground uppercase bg-muted/40 border-y border-border">
                      <tr>
                        <th className="px-3 py-2.5">ID</th>
                        <th className="px-3 py-2.5">Produto</th>
                        <th className="px-3 py-2.5">Destino</th>
                        <th className="px-3 py-2.5">Valor</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-3 font-mono font-bold text-primary-dark whitespace-nowrap">
                            #{order.id}
                          </td>
                          <td className="px-3 py-3 font-medium text-foreground">
                            <div className="font-semibold line-clamp-1">{order.product}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {order.quantity} {order.unit}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                            {order.buyerLocation}
                          </td>
                          <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">
                            {order.priceFormatted}
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <Badge
                              variant={order.statusVariant}
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                            >
                              {order.statusLabel}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Right 1 Col: Quick Action Shortcuts & Operational Status */}
        <section className="space-y-4">
          {/* Shortcuts Card */}
          <Card className="border-border shadow-2xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Atalhos Rápidos
              </CardTitle>
              <CardDescription className="text-xs">
                Acesse as principais seções operacionais
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5">
              <Link
                href="/painel-fornecedor/pedidos"
                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary-light/40 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary-dark group-hover:bg-primary group-hover:text-white transition-colors">
                    <ShoppingBag className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Gestão de Pedidos</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {metrics.pendingOrdersCount} pendentes de confirmação
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary-dark group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/painel-fornecedor/catalogo"
                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary-light/40 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                    <Package className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Meu Catálogo</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {catalogSummary.totalProducts} produtos cadastrados
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/painel-fornecedor/relatorios"
                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary-light/40 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <BarChart3 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Relatórios & Desempenho</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Gráficos comparativos de entregas
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/painel-fornecedor/configuracoes"
                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary-light/40 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                    <Settings className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Configurações da Loja</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Frete, dados e horários de corte
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </CardContent>
          </Card>

          {/* Operational Support Card */}
          <Card className="border-border shadow-2xs bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase font-bold">
                  B2B Suporte
                </Badge>
                <RefreshCw className="size-3.5 text-slate-400" />
              </div>
              <CardTitle className="text-sm font-bold text-white mt-1">
                Canal da Distribuidora
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                Precisa de auxílio para integração via ERP ou emissão de notas fiscais?
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white gap-1.5"
                render={
                  <Link href="/contato" target="_blank">
                    <span>Falar com Gerente de Contas</span>
                    <ExternalLink className="size-3" />
                  </Link>
                }
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
