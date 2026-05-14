// src/components/fornecedor/MercadoTab.tsx
import { useState } from 'react'
import { Tag } from 'lucide-react'
import { MarketOrder } from '@/lib/supplier-mock'
import MarketOrderCard from './MarketOrderCard'

type Filter = 'todos' | 'ofertei'

interface MercadoTabProps {
  orders: MarketOrder[]
  declinedIds: Set<string>
  onEnviarOferta: (order: MarketOrder) => void
  onDecline: (orderId: string) => void
}

export default function MercadoTab({
  orders,
  declinedIds,
  onEnviarOferta,
  onDecline,
}: MercadoTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  const visible = orders
    .filter((o) => o.status !== 'encerrado')
    .filter((o) => !declinedIds.has(o.id))
    .filter((o) => filter === 'todos' || o.offeredByMe)

  const oferteiCount = orders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id) && o.offeredByMe
  ).length

  const totalCount = orders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id)
  ).length

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2">
        {(['todos', 'ofertei'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {f === 'todos' ? `Todos (${totalCount})` : `Já ofertei (${oferteiCount})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhuma cotação aberta no momento</p>
          <p className="text-xs mt-1">Novos pedidos aparecerão aqui assim que forem criados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((order) => (
            <MarketOrderCard
              key={order.id}
              order={order}
              onEnviarOferta={onEnviarOferta}
              onDecline={onDecline}
            />
          ))}
        </div>
      )}
    </div>
  )
}
