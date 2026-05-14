// src/components/fornecedor/PedidosDiretosTab.tsx
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { DirectOrder } from '@/lib/supplier-mock'
import DirectOrderCard from './DirectOrderCard'

type Filter = 'todos' | 'aguardando' | 'confirmados'

interface PedidosDiretosTabProps {
  orders: DirectOrder[]
  onConfirmar: (orderId: string) => void
  onRecusar: (orderId: string) => void
}

export default function PedidosDiretosTab({
  orders,
  onConfirmar,
  onRecusar,
}: PedidosDiretosTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  const active = orders.filter((o) => o.status !== 'cancelado')

  const filtered = active.filter((o) => {
    if (filter === 'aguardando') return o.status === 'aguardando'
    if (filter === 'confirmados') return o.status === 'confirmado'
    return true
  })

  const counts = {
    todos: active.length,
    aguardando: active.filter((o) => o.status === 'aguardando').length,
    confirmados: active.filter((o) => o.status === 'confirmado').length,
  }

  const filterLabels: Record<Filter, string> = {
    todos:       `Todos (${counts.todos})`,
    aguardando:  `Aguardando (${counts.aguardando})`,
    confirmados: `Confirmados (${counts.confirmados})`,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'aguardando', 'confirmados'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-accent text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-accent/40'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido direto no momento</p>
          <p className="text-xs mt-1">Pedidos do catálogo vinculados à sua loja aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((order) => (
            <DirectOrderCard
              key={order.id}
              order={order}
              onConfirmar={onConfirmar}
              onRecusar={onRecusar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
