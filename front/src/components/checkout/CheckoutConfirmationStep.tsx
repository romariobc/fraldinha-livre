import Link from 'next/link'
import { canRestart, type CheckoutAttempt } from '@/lib/checkout-attempt'
import { formatPrice } from '@/lib/utils'
import { supplierLabel } from '@/lib/supplier-label'

interface Props {
  attempt: CheckoutAttempt
  submitting: boolean
  error: string | null
  onRecover(): Promise<void>
  onRestart(): Promise<void>
}
const labels = { ready: 'Aguardando envio', unknown: 'Resultado desconhecido', confirmed: 'Pedido registrado', failed: 'Pedido não registrado', declined: 'Simulação recusada' }
export function CheckoutConfirmationStep({ attempt, submitting, error, onRecover, onRestart }: Props) {
  const complete = attempt.groups.every(group => group.status === 'confirmed')
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="font-display font-black text-2xl text-brand-text">{complete ? 'Pedidos registrados' : 'Resultado da tentativa'}</h1>
      <p className="text-sm text-brand-muted">Compra, pagamento e entrega simulados, sem cobrança real. Cada fornecedor gera um pedido independente; uma falha não desfaz pedidos já registrados.</p>
      <p className="text-sm">A recuperação mantém os itens, endereço e método desta tentativa. Somente quantidades confirmadas são retiradas da sacola.</p>
      {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</p>}
      {attempt.groups.map(group => (
        <section key={group.key} className="bg-white rounded-card shadow-card p-5 space-y-2" aria-label={supplierLabel(group.supplierId)}>
          <h2 className="font-display font-bold break-all">{supplierLabel(group.supplierId)}</h2>
          <p className="font-semibold" role="status">{labels[group.status]}</p>
          <p>{formatPrice(group.request.price ?? 0)} · {group.request.items.length} item(ns)</p>
          <ul className="text-sm text-brand-muted">{group.request.items.map(item => <li key={item.productId}>{item.productName} · {item.quantity} {item.unit}</li>)}</ul>
          <p className="text-xs text-brand-muted">Endereço: {group.request.deliveryAddress.logradouro}, {group.request.deliveryAddress.numero} · {group.request.deliveryAddress.cidade}/{group.request.deliveryAddress.estado}</p>
          {group.error && <p role="alert" className="text-sm text-red-800">{group.error}</p>}
          {group.requestId && <p className="text-xs break-all">Referência de suporte: {group.requestId}</p>}
          {group.order && <div className="text-xs space-y-1">
            <p className="break-all">Pedido: {group.order.id}</p>
            <p className="break-all">Simulação registrada pelo servidor: {group.order.paymentTransactionId}</p>
            <p>Nenhum valor foi cobrado.</p>
          </div>}
        </section>
      ))}
      <div className="flex flex-wrap gap-3">
        {(!complete || error) && <button type="button" disabled={submitting} onClick={onRecover} className="bg-primary-dark text-white rounded-full px-5 py-3 font-bold disabled:opacity-50">{submitting ? 'Recuperando...' : 'Recuperar tentativa'}</button>}
        {canRestart(attempt) && <button type="button" disabled={submitting} onClick={onRestart} className="border border-primary-dark text-primary-dark rounded-full px-5 py-3 font-bold disabled:opacity-50">{complete ? 'Nova compra' : 'Revisar sacola para nova tentativa'}</button>}
        <Link href="/minha-conta?tab=pedidos" className="text-primary-dark underline py-3">Ver meus pedidos</Link>
      </div>
      {!canRestart(attempt) && <p className="text-sm">Há resultado ainda desconhecido. Use Recuperar tentativa antes de iniciar outra compra.</p>}
    </div>
  )
}
