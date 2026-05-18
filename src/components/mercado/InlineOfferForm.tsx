'use client'

import { useState } from 'react'
import type { GeoScope, DeliveryType, MarketOrder } from '@/lib/supplier-mock'
import { parsePriceToCents } from '@/lib/market-utils'

interface InlineOfferFormProps {
  order: MarketOrder
  scope: GeoScope
  onSubmit: (price: number, deliveryType: DeliveryType, note?: string) => void
  onDecline: () => void
}

type DeliveryOption = { value: string; label: string; deliveryType: DeliveryType }

function getDeliveryOptions(scope: GeoScope): DeliveryOption[] {
  const opts: DeliveryOption[] = []
  const isNeighborhoodOrRadius5 =
    scope.type === 'neighborhood' || (scope.type === 'radius' && scope.km === 5)
  const isRadius10 = scope.type === 'radius' && scope.km === 10

  if (isNeighborhoodOrRadius5) {
    opts.push({ value: 'd1h', label: '⚡ Delivery local (até 1h)', deliveryType: { kind: 'delivery', maxHours: 1 } })
    opts.push({ value: 'd2h', label: '⚡ Delivery local (até 2h)', deliveryType: { kind: 'delivery', maxHours: 2 } })
    opts.push({ value: 'd4h', label: '⚡ Delivery local (até 4h)', deliveryType: { kind: 'delivery', maxHours: 4 } })
  } else if (isRadius10) {
    opts.push({ value: 'd2h', label: '⚡ Delivery local (até 2h)', deliveryType: { kind: 'delivery', maxHours: 2 } })
    opts.push({ value: 'd4h', label: '⚡ Delivery local (até 4h)', deliveryType: { kind: 'delivery', maxHours: 4 } })
  }

  opts.push(
    { value: '1d',  label: '1 dia útil',    deliveryType: { kind: 'days', count: 1 } },
    { value: '2d',  label: '2 dias úteis',  deliveryType: { kind: 'days', count: 2 } },
    { value: '3d',  label: '3 dias úteis',  deliveryType: { kind: 'days', count: 3 } },
    { value: '5d',  label: '5 dias úteis',  deliveryType: { kind: 'days', count: 5 } },
    { value: '7d',  label: '7 dias úteis',  deliveryType: { kind: 'days', count: 7 } },
    { value: 'arr', label: 'A combinar',    deliveryType: { kind: 'to_arrange' } },
  )
  return opts
}

export default function InlineOfferForm({ order, scope, onSubmit, onDecline }: InlineOfferFormProps) {
  const [priceRaw, setPriceRaw] = useState('')
  const [deliveryKey, setDeliveryKey] = useState('')
  const [note, setNote] = useState('')

  const options = getDeliveryOptions(scope)
  const priceCents = parsePriceToCents(priceRaw)
  const perUnit =
    priceCents !== null && order.quantity > 0
      ? (priceCents / order.quantity / 100).toFixed(2).replace('.', ',')
      : null

  function handleSubmit() {
    if (!priceCents || !deliveryKey) return
    const opt = options.find((o) => o.value === deliveryKey)
    if (!opt) return
    onSubmit(priceCents, opt.deliveryType, note.trim() || undefined)
  }

  return (
    <div className="px-4 py-4 bg-primary-light border-t border-dashed border-primary/30 flex flex-wrap gap-3 items-end">
      {/* Price */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Preço total (R$) *
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={priceRaw}
          onChange={(e) => setPriceRaw(e.target.value)}
          className="bg-white border-2 border-primary rounded-lg px-3 py-1.5 text-sm font-bold text-brand-text w-28 focus:outline-none"
        />
        {perUnit && (
          <div className="text-[9px] text-primary-dark font-semibold mt-1">
            ≈ R$ {perUnit} por {order.unit}
          </div>
        )}
      </div>

      {/* Delivery */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Modalidade *
        </div>
        <select
          value={deliveryKey}
          onChange={(e) => setDeliveryKey(e.target.value)}
          className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm text-brand-text w-52 focus:outline-none focus:border-primary"
        >
          <option value="" disabled>
            Selecionar...
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Nota (opcional)
        </div>
        <input
          type="text"
          placeholder="Ex: entrego via motoboy…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-brand-text w-44 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!priceCents || !deliveryKey}
          className="bg-accent text-white font-display font-black text-xs px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-accent-dark transition-colors"
        >
          ✏️ Enviar oferta
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="bg-white border border-slate-200 text-brand-muted font-bold text-xs px-3 py-2 rounded-lg hover:border-slate-300 transition-colors"
        >
          ✕ Não concorro
        </button>
      </div>
    </div>
  )
}
