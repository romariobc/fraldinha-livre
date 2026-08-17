'use client'

import * as React from 'react'
import {
  BarChart3,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MetricCard } from '@/components/fornecedor/MetricCard'
import { ReportsComparativeChart } from '@/components/fornecedor/ReportsComparativeChart'
import { DatePickerWithRange, formatDateRangeLabel } from '@/components/fornecedor/DatePickerWithRange'
import type { DateRange } from '@/components/ui/calendar'
import { useSupplierReports } from '@/hooks/use-supplier-data'

export default function RelatoriosPage() {
  // Default to last 30 days
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 29)
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  })

  const { summary, loading } = useSupplierReports(dateRange)

  // Export CSV report
  const handleExportCSV = () => {
    try {
      const headers = ['Data', 'Entregas Concluidas', 'Cancelamentos', 'Taxa de Sucesso (%)', 'Receita Estimada (R$)']
      const rows = summary.chartData.map((d) => [
        `"${String(d.label || d.date).replace(/"/g, '""')}"`,
        d.deliveries,
        d.cancellations,
        `"${String(d.successRate ?? 100).replace(/"/g, '""')}%"`,
        `"${((d.revenue || 0) / 100).toFixed(2).replace(/"/g, '""')}"`,
      ])

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      const periodName = formatDateRangeLabel(dateRange).replace(/[^a-zA-Z0-9-]/g, '_')
      link.setAttribute('download', `relatorio_desempenho_fornecedor_${periodName}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Relatório CSV exportado com sucesso!')
    } catch (err) {
      console.error('Erro ao exportar relatório:', err)
      toast.error('Não foi possível gerar a exportação do relatório.')
    }
  }

  // Print report
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="space-y-6" data-testid="relatorios-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-black text-brand-text flex items-center gap-2.5">
            <BarChart3 className="size-6 text-primary-dark" />
            Relatórios de Desempenho
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Análise operacional de entregas, cancelamentos, taxas de sucesso e faturamento da distribuidora.
          </p>
        </div>

        {/* Action Controls: Date Range Filter, Export & Print */}
        <div className="flex flex-wrap items-center gap-2.5">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
            data-testid="reports-date-filter"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-9 font-semibold gap-1.5 border-border bg-card shadow-2xs hover:bg-accent cursor-pointer"
            data-testid="export-csv-btn"
          >
            <Download className="size-3.5 text-primary-dark" />
            Exportar CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-9 font-semibold gap-1.5 border-border bg-card shadow-2xs hover:bg-accent cursor-pointer"
            data-testid="print-report-btn"
          >
            <Printer className="size-3.5 text-primary-dark" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-metric-cards">
        {/* 1. Total Entregas (com variação e taxa de sucesso) */}
        <MetricCard
          title="Total Entregas"
          value={`${summary.totalDeliveries} pedidos`}
          change={{
            value: '+12.8%',
            label: 'cumprimento de SLA',
            trend: 'up',
            isPositiveGood: true,
          }}
          icon={CheckCircle2}
          variant="primary"
          sparklineData={[15, 18, 22, 20, 26, 24, summary.totalDeliveries]}
          loading={loading}
          data-testid="metric-card-total-deliveries"
        />

        {/* 2. Total Cancelamentos (com taxa de cancelamento) */}
        <MetricCard
          title="Total Cancelamentos"
          value={`${summary.totalCancellations} pedidos`}
          change={{
            value: `${summary.cancellationRate}%`,
            label: 'taxa de cancelamento',
            trend: 'down',
            isPositiveGood: true,
          }}
          icon={XCircle}
          variant="danger"
          sparklineData={[3, 2, 4, 1, 2, 1, summary.totalCancellations]}
          loading={loading}
          data-testid="metric-card-total-cancellations"
        />

        {/* 3. Taxa de Conversão / Sucesso de Entrega (%) */}
        <MetricCard
          title="Taxa de Sucesso"
          value={`${summary.deliverySuccessRate}%`}
          change={{
            value: '+2.4%',
            label: 'conversão de pedidos',
            trend: 'up',
            isPositiveGood: true,
          }}
          icon={TrendingUp}
          variant="success"
          sparklineData={[91, 92.5, 93, 91.8, 94.2, 95.1, summary.deliverySuccessRate]}
          loading={loading}
          data-testid="metric-card-success-rate"
        />

        {/* 4. Receita Gerada no Período (R$) */}
        <MetricCard
          title="Receita no Período"
          value={summary.totalRevenueFormatted}
          change={{
            value: '+8.4%',
            label: 'faturamento bruto',
            trend: 'up',
            isPositiveGood: true,
          }}
          icon={DollarSign}
          variant="info"
          sparklineData={[42000, 45000, 48000, 47500, 51000, 52000, summary.totalRevenueCents / 100]}
          loading={loading}
          data-testid="metric-card-revenue"
        />
      </div>

      {/* Main Comparative Chart Section */}
      <ReportsComparativeChart
        data={summary.chartData}
        loading={loading}
        title="Comparativo: Entregas Concluídas vs Cancelamentos"
        description="Evolução diária de pedidos entregues com sucesso versus cancelamentos no período selecionado."
        data-testid="main-reports-chart"
      />

      {/* Secondary Operational Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="breakdown-sections">
        {/* 1. Status Breakdown */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold font-display flex items-center gap-2 text-foreground">
              <Layers className="size-4 text-primary" />
              Distribuição por Status
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Divisão proporcional dos {summary.totalOrdersCount} pedidos movimentados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-1 space-y-4">
            {summary.statusBreakdown.map((item) => (
              <div key={item.status} className="space-y-1.5" data-testid={`status-row-${item.status}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{item.count}</span>
                    <span className="text-muted-foreground text-[11px]">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-300`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
              <span>Total de Pedidos:</span>
              <span className="font-bold text-foreground">{summary.totalOrdersCount} pedidos</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Category Performance */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold font-display flex items-center gap-2 text-foreground">
              <Package className="size-4 text-primary" />
              Desempenho por Categoria
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Volume e faturamento por categoria de produto no período.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-1 space-y-3">
            {summary.categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                className="p-2.5 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors"
                data-testid={`category-row-${cat.category}`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="truncate pr-2">{cat.name}</span>
                  <span className="text-primary-dark shrink-0">{cat.revenueFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>{cat.quantity} unidades vendidas</span>
                  <span>{cat.percentage}% do total</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 3. Cancellation Reasons & Actionable Insights */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold font-display flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-4 text-rose-500" />
              Motivos de Cancelamento
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Causas mapeadas e oportunidades para aumentar a taxa de conversão.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-1 space-y-3.5">
            <div className="space-y-2">
              {summary.cancellationReasons.map((reason, idx) => (
                <div key={idx} className="text-xs space-y-1">
                  <div className="flex items-center justify-between text-foreground">
                    <span className="text-[11px] font-medium text-muted-foreground truncate pr-2">
                      {reason.reason}
                    </span>
                    <span className="font-bold shrink-0">{reason.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500/80"
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendation Box */}
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/80 p-3 text-[11px] text-emerald-950 space-y-1 mt-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <ArrowUpRight className="size-3.5 text-emerald-600" />
                Dica Operacional Fraldinha Livre:
              </div>
              <p className="leading-relaxed text-emerald-900">
                Manter o estoque de pacotes G e XG sincronizado via ERP evita até <strong>25%</strong> dos cancelamentos involuntários e melhora seu destaque nas buscas do marketplace.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
