'use client'

import { useCallback, useEffect, useRef } from 'react'
import { OrderDetailSchema } from '@contracts'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/contexts/auth-context'
import { useLiveOrderQuery } from '@/hooks/use-live-order-query'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'

const labels: Record<string, string> = { aguardando: 'Aguardando confirmação', confirmado: 'Confirmado', 'a-caminho': 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado', aceito: 'Aceito', 'ofertas-recebidas': 'Ofertas recebidas' }
export default function OrderTracking({ orderId, scope, refreshVersion }: { orderId: string; scope: 'comprador' | 'fornecedor' | 'admin'; refreshVersion?: string }) {
  const { user } = useAuth()
  const uid = user?.uid
  const load = useCallback(async () => {
    const response = await apiFetch('/orders/' + encodeURIComponent(orderId) + '?scope=' + scope, undefined, uid)
    return OrderDetailSchema.parse(await response.json())
  }, [orderId, scope, uid])
  const query = useLiveOrderQuery(uid ? uid + ':' + scope + ':' + orderId : null, load)
  const refreshDetail = query.refresh
  const lastVersion = useRef({ orderId, uid, refreshVersion })
  useEffect(() => {
    const previous = lastVersion.current
    lastVersion.current = { orderId, uid, refreshVersion }
    if (previous.orderId === orderId && previous.uid === uid && previous.refreshVersion !== refreshVersion) void refreshDetail(true)
  }, [orderId, uid, refreshVersion, refreshDetail])
  const detail = query.data
  return <section aria-label="Acompanhamento do pedido" className="space-y-3 border-t pt-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-display font-bold">Acompanhamento do pedido</h4>
      <Button type="button" variant="outline" size="sm" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-primary-dark hover:bg-primary-light" disabled={!uid || query.loading || query.refreshing} onClick={() => void query.refresh()}>Atualizar acompanhamento</Button>
    </div>
    <p className="text-xs text-brand-muted">Atualiza ao abrir, ao retomar a página e a cada 30 segundos enquanto visível.</p>
    {query.loading && <p role="status">Carregando acompanhamento...</p>}
    {query.error != null && <p role="alert" className="text-red-700">Não foi possível atualizar o acompanhamento.{detail ? ' Os últimos dados recebidos foram preservados.' : ' Tente atualizar novamente.'}</p>}
    {detail && <>
      <p><strong>Estado registrado:</strong> {labels[detail.order.status] ?? detail.order.status}</p>
      <p className="break-all text-xs text-brand-muted">Pedido: {detail.order.id}</p>
      <div className="space-y-1">
        <h5 className="font-semibold">Itens registrados na compra</h5>
        {detail.order.items.length ? detail.order.items.map(item => <p key={item.productId}>{item.productName} × {item.quantity} {item.unit} · {formatPrice(item.unitPrice * item.quantity)}</p>) : <p>{detail.order.product} · {detail.order.quantity} {detail.order.unit} (resumo legado, sem linhas de itens)</p>}
        <p>Total: {detail.order.price == null ? 'Não registrado' : formatPrice(detail.order.price)}</p>
        <p className="text-xs">Entrega: {detail.order.deliveryAddress.logradouro}, {detail.order.deliveryAddress.numero} · {detail.order.deliveryAddress.bairro} · {detail.order.deliveryAddress.cidade}/{detail.order.deliveryAddress.estado} · {detail.order.deliveryAddress.cep}{detail.order.deliveryAddress.complemento && ' · ' + detail.order.deliveryAddress.complemento}</p>
        {detail.order.paymentMode === 'simulated' && <p className="text-xs">Pagamento simulado · sem cobrança real</p>}
      </div>
      <h5 className="font-semibold">Linha do tempo</h5>
      {detail.historySource === 'legacy' && <p className="text-brand-muted">Registro legado: não há eventos históricos registrados. O estado atual foi preservado; autor e horário de mudanças anteriores são desconhecidos.</p>}
      {detail.historySource === 'partial' && <p className="text-brand-muted">Histórico parcial de um registro legado. Mudanças anteriores ao primeiro evento não têm autor ou horário registrados.</p>}
      <ol className="space-y-3 border-l-2 border-primary/30 pl-3">
        {detail.events.map(event => <li key={event.id} className="space-y-1">
          <p className="font-semibold">{event.fromStatus ? (labels[event.fromStatus] ?? event.fromStatus) + ' → ' : 'Pedido registrado · '}{labels[event.toStatus] ?? event.toStatus}</p>
          <p className="text-xs"><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('pt-BR')}</time></p>
          <p className="break-all text-xs text-brand-muted">Ator registrado: {event.actorId}</p>
          {event.reason && <p className="break-words text-xs">Motivo: {event.reason}</p>}
        </li>)}
      </ol>
    </>}
  </section>
}
