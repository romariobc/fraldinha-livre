'use client'

import { useState } from 'react'
import type { OfferStatus } from '@/lib/supplier-mock'
import { timeAgo } from '@/lib/supplier-mock'
import { formatPrice } from '@/lib/utils'
import { formatDeliveryType } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'

type Filter = 'todas' | 'aguardando' | 'aceitas' | 'recusadas' | 'expiradas'

const STATUS_MAP: Record<Exclude<Filter, 'todas'>, OfferStatus> = {
  aguardando: 'enviada',
  aceitas:    'aceita',
  recusadas:  'recusada',
  expiradas:  'expirada',
}

const STATUS_LABELS: Record<OfferStatus, string> = {
  enviada:  'Aguardando',
  aceita:   'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

const STATUS_COLORS: Record<OfferStatus, string> = {
  enviada:  'bg-blue-100 text-blue-700',
  aceita:   'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-600',
  expirada: 'bg-slate-100 text-slate-500',
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'todas',      label: 'Todas' },
  { key: 'aguardando', label: 'Aguardando' },
  { key: 'aceitas',    label: 'Aceitas' },
  { key: 'recusadas',  label: 'Recusadas' },
  { key: 'expiradas',  label: 'Expiradas' },
]

export default function OfertasMercadoTab() {
  const { offers } = useMarket()
  const [filter, setFilter] = useState<Filter>('todas')

  const filtered =
    filter === 'todas'
      ? offers
      : offers.filter((o) => o.status === STATUS_MAP[filter as Exclude<Filter, 'todas'>])

  const counts: Record<Filter, number> = {
    todas:      offers.length,
    aguardando: offers.filter((o) => o.status === 'enviada').length,
    aceitas:    offers.filter((o) => o.status === 'aceita').length,
    recusadas:  offers.filter((o) => o.status === 'recusada').length,
    expiradas:  offers.filter((o) => o.status === 'expirada').length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === key
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted text-sm">
          Nenhuma oferta encontrada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-primary-dark bg-[#EBF7FE] px-1.5 py-0.5 rounded">
                      {offer.orderId}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_COLORS[offer.status]}`}
                    >
                      {STATUS_LABELS[offer.status]}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-brand-text">{offer.product}</div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {offer.quantity} {offer.unit}
                  </div>
                  <div className="text-xs text-brand-muted mt-1">
                    {offer.buyerName} · {offer.buyerCity} · {offer.buyerState}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-black text-base text-brand-text">
                    {formatPrice(offer.price)}
                  </div>
                  <div className="text-[10px] text-brand-muted">
                    {formatDeliveryType(offer.deliveryType)}
                  </div>
                  <div
                    className="text-[10px] text-brand-muted mt-1"
                    suppressHydrationWarning
                  >
                    {timeAgo(offer.createdAt)}
                  </div>
                </div>
              </div>
              {offer.note && (
                <div className="mt-2 text-xs text-brand-muted bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {offer.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
