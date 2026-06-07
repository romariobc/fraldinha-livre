'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeoScope, DeliveryType } from '@/lib/supplier-mock'
import { MOCK_SUPPLIER } from '@/lib/supplier-mock'
import { geoMatch } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'
import MarketRow from './MarketRow'

interface MarketTableProps {
  scope: GeoScope
  onExpandScope: () => void
}

const INITIAL_COUNT = 10
const PAGE_SIZE = 10

export default function MarketTable({ scope, onExpandScope }: MarketTableProps) {
  const { marketOrders, declinedIds, handleEnviarOferta, handleDeclineMercado } = useMarket()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const activeOrders = marketOrders.filter(
    (o) => !declinedIds.has(o.id) && o.status !== 'encerrado'
  )
  const filteredOrders = activeOrders.filter((o) => geoMatch(o, MOCK_SUPPLIER, scope))
  const visibleOrders = filteredOrders.slice(0, visibleCount)
  const hasMore = filteredOrders.length > visibleCount
  const nationalCount = activeOrders.length
  const showExpandCta = filteredOrders.length < 3 && nationalCount > filteredOrders.length

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT)
    setExpandedId(null)
  }, [scope])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => prev + PAGE_SIZE)
        }
      },
      { threshold: 0.1 }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore])

  function handleToggle(orderId: string) {
    setExpandedId((prev) => (prev === orderId ? null : orderId))
  }

  function handleOffer(orderId: string, price: number, deliveryType: DeliveryType, note?: string) {
    handleEnviarOferta(orderId, price, deliveryType, note)
    setExpandedId(null)
  }

  const scopeLabel =
    scope.type === 'neighborhood'
      ? `📍 ${MOCK_SUPPLIER.neighborhood} · ${MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo'}`
      : scope.type === 'radius'
      ? `🔵 Raio ${scope.km}km`
      : scope.type === 'city'
      ? `🏙️ ${scope.city}${scope.state ? ` · ${scope.state}` : ''}`
      : '🇧🇷 Brasil inteiro'

  return (
    <div className="px-4 sm:px-8 lg:px-20">
      {/* Result summary */}
      <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold text-brand-muted">
        <span className="bg-[#EBF7FE] text-primary-dark px-2 py-0.5 rounded text-[9px]">
          {scopeLabel}
        </span>
        <span>
          {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''} encontrado
          {filteredOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div
          className="grid gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[9.5px] font-bold text-slate-500 uppercase tracking-[.06em]"
          style={{ gridTemplateColumns: '88px 1.4fr 1.3fr 1.8fr 70px 36px' }}
        >
          <span>ID Pedido</span>
          <span>Produto / Qtd</span>
          <span>Comprador</span>
          <span>Endereço</span>
          <span>Postado</span>
          <span />
        </div>

        {/* Rows */}
        {visibleOrders.length === 0 ? (
          <div className="py-12 text-center text-brand-muted text-sm">
            Nenhum pedido neste raio no momento.
          </div>
        ) : (
          visibleOrders.map((order) => (
            <MarketRow
              key={order.id}
              order={order}
              isExpanded={expandedId === order.id}
              supplierNeighborhood={MOCK_SUPPLIER.neighborhood}
              scope={scope}
              onToggle={() => handleToggle(order.id)}
              onOfferSubmit={(price, deliveryType, note) =>
                handleOffer(order.id, price, deliveryType, note)
              }
              onDecline={() => handleDeclineMercado(order.id)}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>

      {/* Expand radius CTA */}
      {showExpandCta && (
        <div className="mt-3 p-4 bg-white border-2 border-dashed border-primary/30 rounded-xl flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-brand-text">Quer ver mais pedidos?</div>
            <div className="text-[11px] text-brand-muted mt-1">
              {nationalCount} pedido{nationalCount !== 1 ? 's' : ''} disponíve
              {nationalCount !== 1 ? 'is' : 'l'} no Brasil inteiro
            </div>
          </div>
          <button
            type="button"
            onClick={onExpandScope}
            className="bg-[#EBF7FE] text-primary-dark text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap hover:bg-primary/20 transition-colors"
          >
            Ampliar raio →
          </button>
        </div>
      )}
    </div>
  )
}
