// src/components/fornecedor/OfertaCard.tsx
import { MapPin } from 'lucide-react'
import { SupplierOffer, OfferStatus, formatPrice, formatDate } from '@/lib/supplier-mock'

interface OfertaCardProps {
  offer: SupplierOffer
}

const STATUS_CONFIG: Record<OfferStatus, { label: string; badgeClass: string; msgClass: string; message?: string }> = {
  enviada:  {
    label: '⏳ Pendente',
    badgeClass: 'bg-amber-100 text-amber-800',
    msgClass: 'text-brand-muted',
    message: undefined,
  },
  aceita:   {
    label: '✓ Aceita',
    badgeClass: 'bg-green-100 text-green-700',
    msgClass: 'text-green-700 bg-green-50 rounded-lg px-3 py-2',
    message: 'Comprador aceitou sua oferta — pedido confirmado!',
  },
  recusada: {
    label: '✕ Recusada',
    badgeClass: 'bg-red-100 text-red-600',
    msgClass: 'text-brand-muted',
    message: 'Comprador escolheu outra oferta.',
  },
  expirada: {
    label: 'Expirada',
    badgeClass: 'bg-slate-100 text-slate-500',
    msgClass: 'text-brand-muted',
    message: 'O pedido foi encerrado sem aceite.',
  },
}

export default function OfertaCard({ offer }: OfertaCardProps) {
  const cfg = STATUS_CONFIG[offer.status]
  const faded = offer.status === 'recusada' || offer.status === 'expirada'

  return (
    <div
      className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-3 border border-slate-100 ${
        faded ? 'opacity-70' : ''
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
            {offer.product}
          </p>
          <p className="text-xs text-brand-muted mt-0.5">
            {offer.quantity} {offer.unit}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* Localização */}
      <div className="flex items-center gap-1 text-xs text-brand-muted">
        <MapPin size={11} className="flex-shrink-0" />
        {offer.buyerCity}, {offer.buyerState}
      </div>

      {/* Valor e prazo */}
      <div className="flex items-center justify-between">
        <span className="font-black text-base text-primary-dark">
          {formatPrice(offer.price)}
        </span>
        <span className="text-xs text-brand-muted">
          {offer.deliveryDays} dia{offer.deliveryDays !== 1 ? 's' : ''} úteis · {formatDate(offer.createdAt)}
        </span>
      </div>

      {/* Mensagem contextual */}
      {cfg.message && (
        <p className={`text-xs ${cfg.msgClass}`}>{cfg.message}</p>
      )}
    </div>
  )
}
