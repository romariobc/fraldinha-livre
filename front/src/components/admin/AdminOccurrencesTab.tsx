'use client'

import { useCallback, useState } from 'react'
import { AdminOccurrencesPageSchema } from '@contracts'
import { useAuth } from '@/contexts/auth-context'
import { apiFetch } from '@/lib/api-client'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import OrderOccurrences from '@/components/OrderOccurrences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminOccurrencesTab() {
  const { user, isAdmin } = useAuth()
  if (!user || !isAdmin) return null
  return <AccountOccurrences key={user.uid} uid={user.uid} />
}
function AccountOccurrences({ uid }: { uid: string }) {
  const [page, setPage] = useState(1), [q, setQ] = useState(''), [status, setStatus] = useState('')
  const [selected, setSelected] = useState<{ id: string; orderId: string } | null>(null)
  const params = new URLSearchParams({ page: String(page) }); if (q.trim()) params.set('q', q.trim()); if (status) params.set('status', status)
  const search = params.toString()
  const load = useCallback(async () => AdminOccurrencesPageSchema.parse(await (await apiFetch('/admin/occurrences?' + search, undefined, uid)).json()), [uid, search])
  const query = useLiveOrderQuery(uid + ':admin-occurrences:' + search, load)
  const data = query.data
  return <section aria-label="Supervisão de ocorrências" className="space-y-4">
    <h2 className="font-display text-xl font-bold">Ocorrências dos pedidos</h2>
    <p className="text-sm text-brand-muted">A resposta administrativa é a justificativa da intervenção. A auditoria guarda o trecho inicial e a referência à mensagem integral; não altera pedido ou estoque.</p>
    <div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="admin-occ-search">Buscar ocorrência, pedido ou UID</Label><Input id="admin-occ-search" maxLength={100} value={q} onChange={e => { setPage(1); setSelected(null); setQ(e.target.value) }} /></div><div><Label htmlFor="admin-occ-status">Estado da ocorrência</Label><select id="admin-occ-status" className="rounded-lg border p-2" value={status} onChange={e => { setPage(1); setSelected(null); setStatus(e.target.value) }}><option value="">Todos</option>{['aberta','em_atendimento','resolvida'].map(s => <option key={s} value={s}>{s}</option>)}</select></div><Button variant="outline" disabled={query.refreshing} onClick={() => void query.refresh()}>Atualizar ocorrências administrativas</Button></div>
    {query.loading && <p role="status">Carregando ocorrências...</p>}
    {query.error != null && <p role="alert">Não foi possível atualizar as ocorrências. {data ? 'Os últimos dados foram preservados.' : 'Tente novamente.'}</p>}
    {data && <><p>{data.total} ocorrência(s)</p>{data.items.length === 0 && <p>Nenhuma ocorrência para estes filtros.</p>}<ul className="space-y-2">{data.items.map(row => <li key={row.id} className="rounded-card border p-3 flex flex-wrap items-center gap-3"><span className="min-w-0 break-all">{row.id} · pedido {row.orderId} · {row.status}{row.legacy && ' · registro legado'}</span><Button variant="outline" onClick={() => setSelected({ id: row.id, orderId: row.orderId })}>Abrir ocorrência {row.id}</Button></li>)}</ul><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => { setSelected(null); setPage(page - 1) }}>Ocorrências anteriores</Button><span>Página {page}</span><Button variant="outline" disabled={page * data.limit >= data.total} onClick={() => { setSelected(null); setPage(page + 1) }}>Mais ocorrências</Button></div></>}
    {selected && <div className="rounded-card border p-4 space-y-3 [overflow-wrap:anywhere]"><Button variant="outline" onClick={() => { setSelected(null); void query.refresh() }}>Fechar ocorrência administrativa</Button><OrderOccurrences orderId={selected.orderId} initialReportId={selected.id} /></div>}
  </section>
}
