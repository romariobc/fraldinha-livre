'use client'

import { useCallback, useEffect, useState } from 'react'
import { SupplierApplicationSchema, type SupplierApplication } from '@contracts'
import { useAuth } from '@/contexts/auth-context'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

export default function SupplierApprovalStatus() {
  const { user, role } = useAuth()
  const uid = user?.uid
  const [record, setApplication] = useState<SupplierApplication | null>(null)
  const application = record?.uid === uid ? record : null
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/auth/supplier-application', { method: 'POST' })
      const data = await response.json()
      const next = SupplierApplicationSchema.parse(data.application)
      if (next.uid !== uid) return
      setError('')
      setApplication(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar a habilitação.')
    } finally { setBusy(false) }
  }, [uid])
  // HTTP resolves asynchronously; no state is changed before the first await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid && role === 'fornecedor') void load() }, [uid, role, load])
  if (!user || role !== 'fornecedor') return null
  return <section aria-label="Habilitação comercial" className="rounded-card bg-white p-4 mb-6 border border-slate-200 space-y-2">
    <h2 className="font-display font-bold">Habilitação comercial: {application?.status ?? 'consultando'}</h2>
    {application && <p className="text-sm text-brand-muted">{application.status === 'aprovado'
      ? 'Você pode publicar ofertas e receber novas compras simuladas.'
      : 'Novas ofertas e compras estão bloqueadas. Você pode consultar e concluir pedidos anteriores. A administração analisa sua habilitação.'}</p>}
    {application?.reason && <p className="text-sm">Motivo da decisão: {application.reason}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button variant="outline" disabled={busy} onClick={() => { setBusy(true); setError(''); void load() }}>{busy ? 'Consultando…' : 'Atualizar habilitação'}</Button>
  </section>
}
