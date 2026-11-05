'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CreateOccurrenceSchema, ReplyOccurrenceSchema, OccurrencesSchema, OccurrenceCreatedSchema, OccurrenceRepliedSchema, type Occurrence } from '@contracts'
import { apiFetch, isApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/auth-context'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const labels = { aberta: 'Aberta', em_atendimento: 'Em atendimento', resolvida: 'Resolvida' }

/** A remount per account/order clears private drafts and suppresses late results. */
export default function OrderOccurrences({ orderId, initialReportId }: { orderId: string; initialReportId?: string }) {
  const { user, role } = useAuth()
  if (!user?.uid) return <p role="alert">Entre na sua conta para consultar ocorrências.</p>
  return <OccurrencePanel key={user.uid + ':' + orderId + ':' + (initialReportId ?? '')} uid={user.uid} orderId={orderId} initialReportId={initialReportId} canOpen={role === 'comprador' || role === 'fornecedor'} />
}

function OccurrencePanel({ uid, orderId, canOpen, initialReportId }: { uid: string; orderId: string; canOpen: boolean; initialReportId?: string }) {
  const base = '/orders/' + encodeURIComponent(orderId) + '/occurrences'
  const load = useCallback(async () => OccurrencesSchema.parse(await (await apiFetch(base, undefined, uid)).json()), [base, uid])
  const query = useLiveOrderQuery(uid + ':' + orderId + ':occurrences', load)
  const [selected, setSelected] = useState<string | null>(initialReportId ?? null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const owner = useRef({ active: true, busy: false })
  // Retain the exact request after an uncertain response; retry cannot create a second message.
  const attempt = useRef<{ path: string; body: unknown } | null>(null)
  const [uncertain, setUncertain] = useState(false)
  useEffect(() => { const current = { active: true, busy: false }; owner.current = current; return () => { current.active = false } }, [])
  const occurrence = query.data?.find(item => item.id === selected)
  const submit = async (resolve: boolean) => {
    const current = owner.current
    if (current.busy || !current.active) return
    const parsed = selected
      ? ReplyOccurrenceSchema.safeParse({ message, requestId: crypto.randomUUID(), expectedVersion: occurrence?.version, status: resolve ? 'resolvida' : 'em_atendimento' })
      : CreateOccurrenceSchema.safeParse({ message, requestId: crypto.randomUUID() })
    if (!attempt.current && !parsed.success) { setFeedback({ error: true, text: 'Escreva de 5 a 4.000 caracteres. A resolução exige uma resposta.' }); return }
    if (!attempt.current) attempt.current = { path: selected ? base + '/' + encodeURIComponent(selected) + '/messages' : base, body: parsed.data }
    const request = attempt.current
    current.busy = true; setPending(true); setFeedback(null)
    try {
      const response = await apiFetch(request.path, { method: 'POST', body: JSON.stringify(request.body) }, uid)
      const receipt = request.path === base ? OccurrenceCreatedSchema.parse(await response.json()) : OccurrenceRepliedSchema.parse(await response.json())
      if (current.active) { if ('reportId' in receipt) setSelected(receipt.reportId); attempt.current = null; setUncertain(false); setMessage(''); setFeedback({ error: false, text: 'Envio registrado. Acompanhe as respostas nesta conversa.' }) }
    } catch (error) {
      if (current.active) {
        const definite = isApiError(error) && error.status >= 400 && error.status < 500
        if (definite) attempt.current = null
        setUncertain(!definite)
        const text = isApiError(error) && error.code === 'OCCURRENCE_CONFLICT' ? 'A ocorrência mudou ou foi resolvida. Confira a conversa atualizada antes de responder.'
          : definite ? 'Envio recusado. Confira sua permissão e os dados antes de tentar novamente.' : 'Não foi possível confirmar o envio. Use Repetir envio para conferir a mesma solicitação antes de continuar.'
        setFeedback({ error: true, text: text + (isApiError(error) ? ' Código de suporte: ' + error.requestId : '') })
      }
    } finally {
      if (current.active) { await query.refresh(true); if (current.active) setPending(false) }
      current.busy = false
    }
  }
  const choose = (id: string | null) => { if (pending || uncertain) return; setSelected(id); setMessage(''); setFeedback(null) }
  const unavailable = selected !== null && !occurrence
  const readOnly = occurrence?.status === 'resolvida'
  return <section aria-label="Ocorrências do pedido" className="min-w-0 space-y-4 text-sm">
    <p className="break-all">Pedido: {orderId}</p>
    <p>Conversa entre comprador, fornecedor e administração. Uma ocorrência não cancela o pedido nem altera o estoque. Sem anexos ou reabertura nesta versão.</p>
    <Button type="button" variant="outline" size="sm" disabled={query.loading || query.refreshing || pending} onClick={() => void query.refresh()}>Atualizar ocorrências</Button>
    {query.loading && <p role="status">Carregando ocorrências...</p>}
    {query.error != null && <p role="alert">Não foi possível atualizar as ocorrências. {query.data ? 'Os últimos dados foram preservados.' : 'Tente atualizar novamente.'}</p>}
    {query.data?.length === 0 && <p>Nenhuma ocorrência registrada para este pedido.</p>}
    <div className="flex flex-wrap gap-2">
      {query.data?.map((item, index) => <Button type="button" key={item.id} variant={selected === item.id ? 'default' : 'outline'} size="sm" disabled={pending || uncertain} onClick={() => choose(item.id)}>Ocorrência {index + 1} · {labels[item.status]}</Button>)}
      {canOpen && <Button type="button" variant="outline" size="sm" disabled={pending || uncertain} onClick={() => choose(null)}>Nova ocorrência</Button>}
    </div>
    {occurrence && <Conversation occurrence={occurrence} />}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-red-700' : 'text-emerald-700'}>{feedback.text}</p>}
    {unavailable && !query.loading && <p>Atualize as ocorrências para carregar esta conversa.</p>}
    {(uncertain || (!readOnly && !unavailable && (selected !== null || canOpen))) && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit(false) }}>
      <Label htmlFor={'occurrence-message-' + orderId}>{selected ? 'Sua resposta' : 'Descreva o problema'}</Label>
      <Textarea id={'occurrence-message-' + orderId} value={message} onChange={event => setMessage(event.target.value)} disabled={pending || uncertain} maxLength={4000} className="min-h-24" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || (!uncertain && message.trim().length < 5)}>{pending ? 'Registrando...' : uncertain ? 'Repetir envio' : selected ? 'Enviar resposta' : 'Abrir ocorrência'}</Button>
        {selected && !uncertain && !readOnly && <Button type="button" variant="outline" disabled={pending || message.trim().length < 5} onClick={() => void submit(true)}>Resolver com esta resposta</Button>}
      </div>
    </form>}
    {readOnly && !uncertain && <p>Ocorrência resolvida: conversa disponível para consulta, sem reabertura.</p>}
  </section>
}

function Conversation({ occurrence }: { occurrence: Occurrence }) {
  return <div className="space-y-3">
    <h3 className="font-semibold">{labels[occurrence.status]}</h3>
    {occurrence.legacy && <p>Registro anterior preservado. Não há respostas anteriores registradas.</p>}
    <ol className="space-y-3">{occurrence.messages.map((item, index) => <li key={index + ':' + item.id} className="rounded-lg border p-3">
      <p className="font-semibold">{item.actorRole}{item.resolution ? ' · Resposta de resolução' : ''}</p>
      <p className="break-all text-xs">Ator: {item.actorId} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('pt-BR')}</time></p>
      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.message}</p>
    </li>)}</ol>
    {occurrence.resolvedAt && <p className="break-all">Resolvida por {occurrence.resolvedBy} em {new Date(occurrence.resolvedAt).toLocaleString('pt-BR')}.</p>}
  </div>
}
