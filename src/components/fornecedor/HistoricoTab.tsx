// src/components/fornecedor/HistoricoTab.tsx
import { useState } from 'react'
import { History, MapPin } from 'lucide-react'
import {
  DirectOrder,
  SupplierOffer,
  formatPrice,
  formatDate,
} from '@/lib/supplier-mock'

interface HistoricoEntry {
  id: string
  source: 'cotacao' | 'compra-direta'
  product: string
  quantity: number
  unit: string
  city: string
  state: string
  price?: number
  date: string
  finalStatus: 'concluido' | 'cancelado'
}

type Filter = 'todos' | 'concluidos' | 'cancelados'

interface HistoricoTabProps {
  directOrders: DirectOrder[]
  offers: SupplierOffer[]
}

export default function HistoricoTab({ directOrders, offers }: HistoricoTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  const fromDirect: HistoricoEntry[] = directOrders
    .filter((o) => o.status === 'confirmado' || o.status === 'cancelado')
    .map((o) => ({
      id: o.id,
      source: 'compra-direta',
      product: o.product,
      quantity: o.quantity,
      unit: o.unit,
      city: o.buyerCity,
      state: o.buyerState,
      price: o.price,
      date: o.createdAt,
      finalStatus: o.status === 'confirmado' ? 'concluido' : 'cancelado',
    }))

  const fromOffers: HistoricoEntry[] = offers
    .filter((o) => o.status === 'aceita' || o.status === 'recusada' || o.status === 'expirada')
    .map((o) => ({
      id: o.id,
      source: 'cotacao',
      product: o.product,
      quantity: o.quantity,
      unit: o.unit,
      city: o.buyerCity,
      state: o.buyerState,
      price: o.status === 'aceita' ? o.price : undefined,
      date: o.createdAt,
      finalStatus: o.status === 'aceita' ? 'concluido' : 'cancelado',
    }))

  const all = [...fromDirect, ...fromOffers].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const filtered = all.filter((e) => {
    if (filter === 'concluidos') return e.finalStatus === 'concluido'
    if (filter === 'cancelados') return e.finalStatus === 'cancelado'
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'concluidos', 'cancelados'] as Filter[]).map((f) => (
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
            {f === 'todos' ? 'Todos' : f === 'concluidos' ? 'Concluídos' : 'Cancelados'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido no histórico ainda</p>
          <p className="text-xs mt-1">Pedidos concluídos e cancelados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-2 border border-slate-100 ${
                entry.finalStatus === 'cancelado' ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    entry.source === 'cotacao'
                      ? 'bg-primary-light text-primary-dark'
                      : 'bg-accent/10 text-accent-dark'
                  }`}
                >
                  {entry.source === 'cotacao' ? 'COTAÇÃO' : 'COMPRA DIRETA'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    entry.finalStatus === 'concluido'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {entry.finalStatus === 'concluido' ? 'Concluído' : 'Cancelado'}
                </span>
              </div>

              <p className="font-display font-extrabold text-sm text-brand-text">
                {entry.product}
              </p>
              <p className="text-xs text-brand-muted">
                {entry.quantity} {entry.unit}
              </p>

              <div className="flex items-center justify-between text-xs text-brand-muted mt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {entry.city}, {entry.state}
                </span>
                <div className="flex items-center gap-2">
                  {entry.price != null && (
                    <span className="font-black text-brand-text">{formatPrice(entry.price)}</span>
                  )}
                  <span>{formatDate(entry.date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
