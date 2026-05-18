'use client'

import { useState } from 'react'
import type { GeoScope, DeliveryType, MarketOrder } from '@/lib/supplier-mock'
import { maskCnpj, timeAgo } from '@/lib/supplier-mock'
import InlineOfferForm from './InlineOfferForm'

interface MarketRowProps {
  order: MarketOrder
  isExpanded: boolean
  supplierNeighborhood: string
  scope: GeoScope
  onToggle: () => void
  onOfferSubmit: (price: number, deliveryType: DeliveryType, note?: string) => void
  onDecline: () => void
}

export default function MarketRow({
  order,
  isExpanded,
  supplierNeighborhood,
  scope,
  onToggle,
  onOfferSubmit,
  onDecline,
}: MarketRowProps) {
  const [pendingDecline, setPendingDecline] = useState(false)

  const isSameNeighborhood = order.buyerNeighborhood === supplierNeighborhood
  const isOffered = order.offeredByMe

  function handleDeclineClick() {
    setPendingDecline(true)
    setTimeout(() => onDecline(), 300)
  }

  const rowBg = isOffered
    ? 'bg-[#f0fdf4]'
    : isExpanded
    ? 'bg-[#EBF7FE]'
    : 'bg-white hover:bg-slate-50'

  return (
    <div className={`border-b border-slate-100 transition-colors ${pendingDecline ? 'slide-out' : ''} ${rowBg}`}>
      {/* Main row */}
      <div
        role={isOffered ? undefined : 'button'}
        tabIndex={isOffered ? undefined : 0}
        onClick={isOffered ? undefined : onToggle}
        onKeyDown={isOffered ? undefined : (e) => e.key === 'Enter' && onToggle()}
        className={`grid items-center gap-2 px-4 py-3 ${isOffered ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ gridTemplateColumns: '88px 1.4fr 1.3fr 1.8fr 70px 36px' }}
      >
        {/* Col 1: ID */}
        <div
          className={`font-mono text-[10px] font-bold text-primary-dark px-1.5 py-0.5 rounded whitespace-nowrap border ${
            isExpanded
              ? 'bg-white border-[#BAE0F7]'
              : 'bg-[#EBF7FE] border-primary/20'
          }`}
        >
          {order.id}
        </div>

        {/* Col 2: Product / Qty */}
        <div>
          <div className="font-bold text-xs text-brand-text">{order.product}</div>
          <div className="text-[10px] text-brand-muted mt-0.5">
            {order.quantity} {order.unit}
          </div>
        </div>

        {/* Col 3: Buyer */}
        <div>
          <div className="font-semibold text-[11px] text-brand-text">{order.buyerName}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{maskCnpj(order.buyerCnpj)}</div>
        </div>

        {/* Col 4: Address */}
        <div>
          <div className="text-[11px] text-brand-text font-medium">
            {order.buyerStreet} — {order.buyerNeighborhood}
          </div>
          <div className="text-[10px] text-brand-muted mt-0.5">
            {order.buyerCity} · {order.buyerState} · {order.buyerZip}
          </div>
          {isSameNeighborhood && (
            <span className="inline-flex items-center gap-1 mt-1 bg-yellow-50 border border-yellow-300 rounded px-1.5 py-0.5">
              <span className="text-[9px] font-extrabold text-yellow-800">⚡ Mesmo bairro</span>
            </span>
          )}
        </div>

        {/* Col 5: Time */}
        <span className="text-[11px] text-brand-muted" suppressHydrationWarning>
          {timeAgo(order.createdAt)}
        </span>

        {/* Col 6: Chevron or offered badge */}
        <div className="flex justify-center">
          {isOffered ? (
            <span className="text-[9px] font-extrabold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
              ✓ OFERTADO
            </span>
          ) : (
            <span className="text-primary-dark font-bold text-sm">
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {/* Inline form — only when expanded and not yet offered */}
      {isExpanded && !isOffered && (
        <InlineOfferForm
          order={order}
          scope={scope}
          onSubmit={onOfferSubmit}
          onDecline={handleDeclineClick}
        />
      )}
    </div>
  )
}
