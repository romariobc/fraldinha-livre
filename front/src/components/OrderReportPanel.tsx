'use client'

import { useCallback, useState } from 'react'
import { OrderReportSchema, OrderReportQuerySchema, defaultReportPeriod, REPORT_TIMEZONE, type OrderReport } from '@contracts'
import { useAuth } from '@/contexts/auth-context'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { apiFetch } from '@/lib/api-client'
import { orderReportCSV } from '@/lib/order-report-csv'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
const localTime = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: REPORT_TIMEZONE })
export default function OrderReportPanel({ scope }: { scope: 'admin' | 'fornecedor' }) {
  const { user, role, isAdmin } = useAuth()
  if (!user || (scope === 'admin' ? !isAdmin : role !== 'fornecedor')) return null
  return <AccountReport key={user.uid + ':' + scope} uid={user.uid} scope={scope} />
}
function AccountReport({ uid, scope }: { uid: string; scope: 'admin' | 'fornecedor' }) {
  const [draft, setDraft] = useState(() => ({ ...defaultReportPeriod(), q: '', status: '', supplierId: '' }))
  const serialize = (value: typeof draft) => {
    const p = new URLSearchParams({ from: value.from, to: value.to })
    if (value.q.trim()) p.set('q', value.q.trim())
    if (value.status) p.set('status', value.status)
    if (scope === 'admin' && value.supplierId.trim()) p.set('supplierId', value.supplierId.trim())
    return p.toString()
  }
  const [applied, setApplied] = useState(() => serialize(draft))
  const [page, setPage] = useState(1), [feedback, setFeedback] = useState('')
  const endpoint = scope === 'admin' ? '/admin/reports/orders' : '/reports/orders'
  const load = useCallback(async () => OrderReportSchema.parse(await (await apiFetch(endpoint + '?' + applied, undefined, uid)).json()), [applied, endpoint, uid])
  const query = useLiveOrderQuery(uid + ':' + endpoint + ':' + applied, load, false)
  const data = query.data
  const pages = data ? Math.max(1, Math.ceil(data.rows.length / 20)) : 1, current = Math.min(page, pages)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const params = serialize(draft)
    if (!OrderReportQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(params))).success) { setFeedback('Informe um período válido de até 366 dias.'); return }
    setFeedback(''); setPage(1)
    if (params === applied) void query.refresh(); else setApplied(params)
  }
  const exportCSV = () => {
    if (!data || query.loading || query.refreshing || query.error) return
    try {
      const url = URL.createObjectURL(new Blob([orderReportCSV(data)], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a'); anchor.href = url
      anchor.download = `pedidos_${data.filters.from}_${data.filters.to}_BRL_Fortaleza.csv`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      setFeedback('CSV gerado com todos os pedidos desta consulta, incluindo as demais páginas.')
    } catch { setFeedback('Não foi possível gerar o CSV. Tente novamente.') }
  }
  return <section aria-label="Relatório de pedidos" className="space-y-5">
    <h2 className="font-display text-xl font-bold">Relatório de pedidos</h2>
    <p className="text-sm text-brand-muted">Pedidos criados no período, com a situação atual. Datas em Fortaleza; valores em BRL. Compra, pagamento e entrega simulados.</p>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-card border p-4">
      <div><Label htmlFor="report-from">Início</Label><Input id="report-from" type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} required /></div>
      <div><Label htmlFor="report-to">Fim (inclusive)</Label><Input id="report-to" type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} required /></div>
      <div className="w-full min-w-0 sm:w-auto sm:min-w-56 sm:flex-1"><Label htmlFor="report-search">Buscar pedido, produto ou UID</Label><Input id="report-search" value={draft.q} maxLength={100} onChange={e => setDraft({ ...draft, q: e.target.value })} /></div>
      <div><Label htmlFor="report-status">Estado</Label><select id="report-status" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="rounded-lg border p-2 text-sm"><option value="">Todos</option>{['aguardando','confirmado','a-caminho','entregue','cancelado'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      {scope === 'admin' && <div><Label htmlFor="report-supplier">UID do fornecedor</Label><Input id="report-supplier" value={draft.supplierId} maxLength={128} onChange={e => setDraft({ ...draft, supplierId: e.target.value })} /></div>}
      <Button type="submit" disabled={query.refreshing}>Aplicar filtros</Button>
    </form>
    <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => void query.refresh()} disabled={query.refreshing}>Atualizar relatório</Button><Button type="button" variant="outline" disabled={!data || query.refreshing || Boolean(query.error)} onClick={exportCSV}>Exportar consulta CSV</Button></div>
    {feedback && <p role="status">{feedback}</p>}
    {query.loading && <p role="status">Carregando relatório...</p>}
    {query.error != null && <p role="alert" className="text-red-700">Não foi possível consultar o relatório. Restrinja a consulta se exceder 5.000 pedidos. {data ? 'Os últimos dados foram preservados; a exportação está bloqueada até atualizar.' : 'Tente atualizar novamente.'}</p>}
    {data && <>
      <p className="text-sm" data-testid="report-applied">Filtros aplicados: {data.filters.from} a {data.filters.to} · {data.filters.status ?? 'todos os estados'} · busca: {data.filters.q || 'sem busca'}{data.filters.supplierId && ' · fornecedor: ' + data.filters.supplierId}. Consulta: {localTime(data.snapshotAt)}.</p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
        ['Pedidos', data.summary.total], ['Entregues (estado atual)', data.summary.delivered], ['Cancelados', data.summary.cancelled],
        ['Valor simulado não cancelado', currency(data.summary.simulatedValueCents)], ['Valor legado não comprovado', currency(data.summary.legacyValueCents)], ['Recebimento financeiro', 'Não apurado — sem cobrança real'],
      ].map(([label, value]) => <div className="rounded-card border bg-white p-4 shadow-card" key={label}><dt className="text-sm text-brand-muted">{label}</dt><dd className="font-display text-lg font-bold">{value}</dd></div>)}</dl>
      <p className="text-xs text-brand-muted">Valores somam preços válidos de pedidos não cancelados. Pagamento aprovado na simulação não comprova recebimento financeiro.</p>
      {data.summary.unknownPriceCount > 0 && <p role="note">Valores parciais: {data.summary.unknownPriceCount} pedido(s) sem preço válido registrado.</p>}
      {data.summary.invalidDateCount > 0 && <p role="note">{data.summary.invalidDateCount} registro(s) do escopo sem data válida não puderam ser atribuídos ao período.</p>}
      <ReportRows data={data} page={current} />
      {data.rows.length > 0 && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Página anterior</Button><span>Página {current} de {pages} · {data.rows.length} pedido(s)</span><Button variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>Próxima página</Button></div>}
      <details className="rounded-card border p-4"><summary className="cursor-pointer font-semibold">Distribuição por dia de criação</summary><div className="max-h-80 overflow-auto"><table className="w-full min-w-[560px] text-sm" aria-label="Distribuição diária"><thead><tr><th>Dia</th><th>Pedidos</th><th>Entregues</th><th>Cancelados</th><th>Valor simulado não cancelado</th></tr></thead><tbody>{data.daily.map(d => <tr key={d.day}><td>{d.day}</td><td>{d.orders}</td><td>{d.delivered}</td><td>{d.cancelled}</td><td>{currency(d.simulatedValueCents)}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>
}
function ReportRows({ data, page }: { data: OrderReport; page: number }) {
  if (!data.rows.length) return <p>Nenhum pedido para os filtros aplicados.</p>
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm" aria-label="Pedidos consultados"><thead><tr>{['Pedido','Data Fortaleza','Produto','Fornecedor','Estado','Valor','Modalidade'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.slice((page - 1) * 20, page * 20).map(row => <tr key={row.id} className="border-t"><td className="max-w-40 break-all p-2">{row.id}</td><td className="p-2">{localTime(row.createdAt)}</td><td className="max-w-48 break-words p-2">{row.product}</td><td className="max-w-40 break-all p-2">{row.supplierId ?? 'Vínculo não registrado'}</td><td className="p-2">{row.status}</td><td className="p-2 whitespace-nowrap">{row.priceCents === null ? 'Não registrado' : currency(row.priceCents)}</td><td className="p-2">{row.paymentMode === 'simulated' ? 'Simulado' : 'Legado não comprovado'}</td></tr>)}</tbody></table></div>
}
