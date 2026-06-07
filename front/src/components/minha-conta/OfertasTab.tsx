// src/components/minha-conta/OfertasTab.tsx
import { Tag } from 'lucide-react'
import { Order, Offer } from '@/lib/account-mock'

interface OfertasTabProps {
  orders: Order[]
  onAceitarOferta: (orderId: string, offer: Offer) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs text-accent" aria-label={`${rating} de 5 estrelas`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export default function OfertasTab({ orders, onAceitarOferta }: OfertasTabProps) {
  const withOffers = orders.filter((o) => o.status === 'ofertas-recebidas')

  if (withOffers.length === 0) {
    return (
      <div className="text-center py-12 text-brand-muted">
        <Tag size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-sm">Nenhuma oferta pendente</p>
        <p className="text-xs mt-1">
          Quando fornecedores responderem, as ofertas aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {withOffers.map((order) => (
        <div key={order.id} className="flex flex-col gap-3">
          {/* Cabeçalho do grupo */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold text-brand-muted px-2 whitespace-nowrap">
              {order.product} · {order.quantity} {order.unit}
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Cards de oferta — grid 1 col mobile / 2 col lg+ para comparação lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {order.offers?.map((offer, i) => (
            <div
              key={offer.id}
              className={`bg-white rounded-card shadow-card p-4 flex items-center justify-between gap-3 ${
                i === 0 ? 'border-2 border-primary' : 'border border-slate-100'
              }`}
            >
              <div className="flex flex-col gap-1">
                {i === 0 && (
                  <span className="text-[9px] font-bold text-primary-dark uppercase tracking-wider">
                    Melhor preço
                  </span>
                )}
                <p className="font-display font-extrabold text-sm text-brand-text">
                  {offer.supplier}
                </p>
                <StarRating rating={offer.rating} />
                <p className="text-xs text-brand-muted">
                  {offer.deliveryDays} dia{offer.deliveryDays !== 1 ? 's' : ''} de entrega
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="font-black text-lg text-primary-dark">
                  {formatPrice(offer.price)}
                </p>
                <button
                  onClick={() => onAceitarOferta(order.id, offer)}
                  className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                    i === 0
                      ? 'bg-accent text-white hover:bg-accent-dark'
                      : 'bg-slate-100 text-brand-muted hover:bg-primary-light hover:text-primary-dark'
                  }`}
                >
                  ✓ Aceitar
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      ))}
    </div>
  )
}
