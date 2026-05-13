import { Package2, MapPin } from 'lucide-react'
import { MarketOrder, formatPrice, timeAgo } from '@/lib/supplier-mock'

interface MarketOrderCardProps {
  order: MarketOrder
  onEnviarOferta: (order: MarketOrder) => void
  onDecline: (orderId: string) => void
}

export default function MarketOrderCard({
  order,
  onEnviarOferta,
  onDecline,
}: MarketOrderCardProps) {
  return (
    <div
      className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-3 ${
        order.offeredByMe ? 'bg-primary-light border-2 border-primary/30' : 'border border-slate-100'
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <Package2 size={16} className="text-primary-dark" />
          </div>
          <div>
            <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
              {order.product}
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              {order.quantity} {order.unit}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-light text-primary-dark flex-shrink-0">
          COTAÇÃO
        </span>
      </div>

      {/* Localização + tempo */}
      <div className="flex items-center justify-between text-xs text-brand-muted">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="flex-shrink-0" />
          {order.buyerCity}, {order.buyerState}
        </span>
        <span>{timeAgo(order.createdAt)}</span>
      </div>

      {/* Contagem de ofertas */}
      <p className="text-xs text-brand-muted">
        {order.totalOffers === 0
          ? 'Nenhuma oferta enviada ainda'
          : `${order.totalOffers} oferta${order.totalOffers !== 1 ? 's' : ''} recebida${order.totalOffers !== 1 ? 's' : ''}`}
      </p>

      {/* Ações */}
      {order.offeredByMe ? (
        <div className="bg-white rounded-xl px-3 py-2 text-xs text-brand-muted border border-primary/20">
          <span className="font-bold text-primary-dark">✓ Oferta enviada</span>
          {' '}—{' '}
          {formatPrice(order.myOffer!.price)} · {order.myOffer!.deliveryDays} dia{order.myOffer!.deliveryDays !== 1 ? 's' : ''}
          <br />
          <span className="text-[11px]">Aguardando decisão do comprador…</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onEnviarOferta(order)}
            className="flex-1 bg-accent text-white font-display font-bold text-xs py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            ✏️ Enviar oferta
          </button>
          <button
            onClick={() => onDecline(order.id)}
            className="flex-none w-28 bg-slate-100 text-brand-muted font-bold text-xs py-2 rounded-xl hover:bg-slate-200 transition-colors"
          >
            ✕ Não concorro
          </button>
        </div>
      )}
    </div>
  )
}
