'use client'

import { useCallback, useEffect, useState } from 'react'
import { SupplierApplicationListSchema, type SupplierApplication } from '@contracts'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function AdminSupplierApprovals() {
  const [rows, setRows] = useState<SupplierApplication[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<SupplierApplication | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async (after?: string) => {
    try {
      const response = await apiFetch('/admin/suppliers' + (after ? '?cursor=' + encodeURIComponent(after) : ''))
      const data = SupplierApplicationListSchema.parse(await response.json())
      setError('')
      setRows(old => after ? [...old, ...data.applications] : data.applications)
      setCursor(data.nextCursor)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao consultar solicitações.') }
    finally { setBusy(false) }
  }, [])
  // HTTP resolves asynchronously; no state is changed before the first await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])
  async function decide(status: 'aprovado' | 'rejeitado' | 'suspenso') {
    if (!selected || reason.trim().length < 5) return
    setBusy(true); setError(''); setNotice('')
    try {
      await apiFetch('/admin/suppliers/' + encodeURIComponent(selected.uid), { method: 'PATCH',
        body: JSON.stringify({ status, reason: reason.trim(), expectedVersion: selected.version }) })
      setNotice('Decisão registrada.'); setSelected(null); setReason(''); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao registrar decisão. Atualize antes de decidir novamente.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Aprovação de fornecedores" className="rounded-card bg-white border border-slate-200 p-4 space-y-4">
    <h2 className="font-display text-lg font-bold">Aprovação de fornecedores</h2>
    <p className="text-sm text-brand-muted">Confira o cadastro pelo UID na lista de usuários. Toda decisão exige motivo e fica registrada na auditoria.</p>
    <Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setBusy(true); setError(''); void load() }}>Atualizar solicitações</Button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {busy && <p role="status">Processando…</p>}
    {!busy && rows.length === 0 && !error && <p>Nenhuma solicitação.</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.uid} className="border-b pb-2 flex flex-wrap items-center gap-3">
      <span className="break-all">{row.uid} — {row.status}</span>
      <Button variant="outline" disabled={busy} onClick={() => { setSelected(row); setReason(''); setNotice('') }}>Analisar {row.uid}</Button>
    </li>)}</ul>
    {cursor && <Button disabled={busy} onClick={() => { setBusy(true); setError(''); void load(cursor) }}>Mais solicitações</Button>}
    {selected && <div className="space-y-3">
      <h3 className="font-bold break-all">Decidir sobre {selected.uid} ({selected.status})</h3>
      {selected.reason && <p>Motivo anterior: {selected.reason}</p>}
      <Label htmlFor="supplier-decision-reason">Motivo da decisão (5 a 500 caracteres)</Label>
      <Textarea id="supplier-decision-reason" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-2">{(['aprovado', 'rejeitado', 'suspenso'] as const).filter(status =>
        status !== selected.status && (status !== 'suspenso' || selected.status === 'aprovado') &&
        (status !== 'rejeitado' || selected.status === 'pendente')).map(status =>
        <Button key={status} disabled={busy || reason.trim().length < 5} onClick={() => void decide(status)}>
          {status === 'aprovado' ? 'Aprovar' : status === 'rejeitado' ? 'Rejeitar' : 'Suspender'}
        </Button>)}
        <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Fechar análise</Button>
      </div>
    </div>}
  </section>
}
