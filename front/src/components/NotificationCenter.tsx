'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { NotificationDestinationSchema, NotificationIdSchema, NotificationReadSchema, NotificationsPageSchema } from '@contracts'
import { useAuth, type UserRole } from '@/contexts/auth-context'
import { apiFetch } from '@/lib/api-client'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { Button } from '@/components/ui/button'
import OrderTracking from '@/components/OrderTracking'
import OrderOccurrences from '@/components/OrderOccurrences'

export default function NotificationCenter({ selectedId }: { selectedId?: string | null }) {
  const { user, role } = useAuth()
  if (!user || !role) return null
  // All private state, pending actions and destination previews are discarded on identity/role change.
  return <AccountNotifications key={user.uid + ':' + role} uid={user.uid} role={role} selectedId={selectedId} />
}

function AccountNotifications({ uid, role, selectedId }: { uid: string; role: UserRole; selectedId?: string | null }) {
  const [cursor, setCursor] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const owner = useRef({ active: true, busy: false })
  useEffect(() => { const current = { active: true, busy: false }; owner.current = current; return () => { current.active = false } }, [])
  const load = useCallback(async () => NotificationsPageSchema.parse(await (await apiFetch('/notifications' + (cursor ? '?cursor=' + cursor : ''), undefined, uid)).json()), [cursor, uid])
  const query = useLiveOrderQuery(uid + ':' + role + ':notifications:' + (cursor ?? 'recent'), load)
  const validId = selectedId && NotificationIdSchema.safeParse(selectedId).success ? selectedId : null
  const loadDestination = useCallback(async () => NotificationDestinationSchema.parse(await (await apiFetch('/notifications/' + validId + '/destination', undefined, uid)).json()), [validId, uid])
  const destination = useLiveOrderQuery(validId ? uid + ':' + role + ':notification:' + validId : null, loadDestination, false)
  const markRead = async (id: string) => {
    const current = owner.current
    if (!current.active || current.busy) return
    current.busy = true; setPending(id); setFeedback(null)
    try {
      const receipt = NotificationReadSchema.parse(await (await apiFetch('/notifications/' + id + '/read', { method: 'PATCH' }, uid)).json())
      if (receipt.id !== id) throw new Error('Unexpected receipt')
      if (current.active) await query.refresh(true)
    } catch {
      if (current.active) setFeedback('Não foi possível confirmar a leitura. Atualize os avisos para conferir o estado ou tente novamente.')
    } finally {
      current.busy = false
      if (current.active) setPending(null)
    }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-2xl font-extrabold text-brand-text">Meus avisos</h1>
        <p className="text-sm text-brand-muted">Atualizações da sua conta. Compra, pagamento e entrega continuam simulados.</p></div>
      <Button type="button" variant="outline" disabled={query.refreshing || Boolean(pending)} onClick={() => { setFeedback(null); void query.refresh() }}>Atualizar avisos</Button>
    </div>
    <p className="text-sm text-brand-muted">Atualiza ao abrir, ao retomar a página e a cada 30 segundos enquanto visível.</p>
    {query.loading && <p role="status">Carregando avisos...</p>}
    {query.error != null && <p role="alert" className="text-red-700">Não foi possível atualizar os avisos. {query.data ? 'Os últimos dados foram preservados.' : 'Tente atualizar novamente.'}</p>}
    {feedback && <p role="alert" className="text-red-700">{feedback}</p>}
    {query.data && <>
      <p className="font-semibold" aria-live="polite">{query.data.unreadCount} aviso(s) não lido(s)</p>
      {query.data.items.length === 0 && <p>Nenhum aviso nesta página.</p>}
      <ul className="space-y-3" aria-label="Avisos da sua conta">
        {query.data.items.map(item => <li key={item.id} data-testid={'notification-' + item.id} className="rounded-card border border-primary/20 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1"><p className="font-semibold text-brand-text">{item.message}</p>
              <p className="text-xs text-brand-muted"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('pt-BR')}</time></p>
              <p className="text-xs font-semibold">{item.readAt ? 'Lido' : 'Não lido'}</p></div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={'/avisos?notification=' + item.id} className="text-sm font-semibold text-primary-dark underline">Ver atualização</Link>
              {!item.readAt && <Button type="button" size="sm" variant="outline" disabled={Boolean(pending)} onClick={() => void markRead(item.id)}>{pending === item.id ? 'Confirmando leitura...' : 'Marcar como lido'}</Button>}
            </div>
          </div>
        </li>)}
      </ul>
      <div className="flex flex-wrap gap-3">
        {cursor && <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={() => setCursor(null)}>Voltar aos recentes</Button>}
        {query.data.nextCursor && <Button type="button" variant="outline" disabled={query.refreshing || Boolean(pending)} onClick={() => { setFeedback(null); setCursor(query.data!.nextCursor) }}>Mais antigos</Button>}
      </div>
    </>}
    {selectedId && <section className="rounded-card border border-primary/30 bg-white p-4 sm:p-6 space-y-4 [overflow-wrap:anywhere]" aria-label="Destino do aviso">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-bold">Atualização selecionada</h2><Link href="/avisos" className="text-sm text-primary-dark underline">Fechar atualização</Link></div>
      {!validId && <p role="alert">Aviso inválido.</p>}
      {destination.loading && <p role="status">Verificando acesso à atualização...</p>}
      {destination.error != null && <div><p role="alert" className="text-red-700">Não foi possível abrir este destino. Seu acesso pode ter mudado ou a conexão falhou.</p><Button type="button" variant="outline" disabled={destination.refreshing} onClick={() => void destination.refresh()}>Tentar abrir novamente</Button></div>}
      {destination.data?.type === 'order' && <OrderTracking orderId={destination.data.orderId} scope={destination.data.scope} />}
      {destination.data?.type === 'occurrence' && <OrderOccurrences orderId={destination.data.orderId} initialReportId={destination.data.reportId} />}
      {destination.data?.type === 'supplier' && <Link href={destination.data.href} className="font-semibold text-primary-dark underline">Consultar situação do cadastro</Link>}
    </section>}
  </div>
}
