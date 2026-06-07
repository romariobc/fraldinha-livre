'use client'

import type { DispatchStatus, SupplierOffer, DirectOrder } from '@/lib/supplier-mock'
import { formatPrice, timeAgo } from '@/lib/supplier-mock'
import { formatDeliveryType } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'

type LogisticaItem =
  | { type: 'market'; data: SupplierOffer }
  | { type: 'direct'; data: DirectOrder }

type Stage = { status: DispatchStatus | null; label: string }

const ALL_STAGES: Stage[] = [
  { status: null,         label: 'Aceito' },
  { status: 'em_preparo', label: 'Em preparo' },
  { status: 'despachado', label: 'Despachado' },
  { status: 'entregue',   label: 'Entregue' },
]

function nextStatus(current: DispatchStatus | undefined, skipPreparo: boolean): DispatchStatus | null {
  if (!current) return skipPreparo ? 'despachado' : 'em_preparo'
  if (current === 'em_preparo') return 'despachado'
  if (current === 'despachado') return 'entregue'
  return null
}

function StepperBar({ current, skipPreparo }: { current?: DispatchStatus; skipPreparo: boolean }) {
  const stages = skipPreparo ? ALL_STAGES.filter((s) => s.status !== 'em_preparo') : ALL_STAGES
  const currentIdx = stages.findIndex((s) => s.status === (current ?? null))

  return (
    <div className="flex items-start gap-0 mt-4">
      {stages.map((stage, idx) => {
        const isPast    = idx < currentIdx
        const isCurrent = idx === currentIdx
        return (
          <div key={stage.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                  isPast
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary-dark border-primary-dark text-white'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isPast ? '✓' : idx + 1}
              </div>
              <div
                className={`text-[9px] mt-1 font-semibold text-center whitespace-nowrap ${
                  isCurrent ? 'text-primary-dark' : isPast ? 'text-green-600' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </div>
            </div>
            {idx < stages.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${isPast ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function LogisticaTab() {
  const { offers, directOrders, handleAtualizarDespacho } = useMarket()

  const items: LogisticaItem[] = [
    ...offers.filter((o) => o.status === 'aceita').map((data) => ({ type: 'market' as const, data })),
    ...directOrders.filter((o) => o.status === 'confirmado').map((data) => ({ type: 'direct' as const, data })),
  ]

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-brand-muted text-sm">
        Nenhum pedido em andamento no momento.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const isMarket        = item.type === 'market'
        const dispatchId      = isMarket ? (item.data as SupplierOffer).orderId : item.data.id
        const product         = item.data.product
        const quantity        = item.data.quantity
        const unit            = item.data.unit
        const price           = item.data.price
        const buyerCity       = item.data.buyerCity
        const buyerState      = item.data.buyerState
        const createdAt       = item.data.createdAt
        const dispatchStatus  = item.data.dispatchStatus
        const isDelivery      = isMarket && (item.data as SupplierOffer).deliveryType.kind === 'delivery'
        const next            = nextStatus(dispatchStatus, isDelivery)
        const nextLabel       = next ? ALL_STAGES.find((s) => s.status === next)?.label : null

        return (
          <div
            key={`${item.type}-${dispatchId}`}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-primary-dark bg-[#EBF7FE] px-1.5 py-0.5 rounded">
                    {dispatchId}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {isMarket ? 'Mercado' : 'Direto'}
                  </span>
                </div>
                <div className="font-bold text-sm text-brand-text">{product}</div>
                <div className="text-xs text-brand-muted">
                  {quantity} {unit} · {buyerCity}, {buyerState}
                </div>
                {isMarket && (
                  <div className="text-xs text-brand-muted">
                    {formatDeliveryType((item.data as SupplierOffer).deliveryType)}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-black text-base text-brand-text">
                  {formatPrice(price)}
                </div>
                <div className="text-[10px] text-brand-muted" suppressHydrationWarning>
                  {timeAgo(createdAt)}
                </div>
              </div>
            </div>

            <StepperBar current={dispatchStatus} skipPreparo={isDelivery} />

            {next && nextLabel && (
              <button
                type="button"
                onClick={() =>
                  handleAtualizarDespacho(
                    dispatchId,
                    isMarket ? 'market' : 'direct',
                    next
                  )
                }
                className="mt-3 bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary transition-colors"
              >
                Avançar: {nextLabel} →
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
