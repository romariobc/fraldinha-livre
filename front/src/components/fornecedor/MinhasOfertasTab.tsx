// src/components/fornecedor/MinhasOfertasTab.tsx
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { SupplierOffer } from '@/lib/supplier-mock'
import OfertaCard from './OfertaCard'

type Filter = 'todas' | 'pendentes' | 'aceitas' | 'recusadas'

interface MinhasOfertasTabProps {
  offers: SupplierOffer[]
}

export default function MinhasOfertasTab({ offers }: MinhasOfertasTabProps) {
  const [filter, setFilter] = useState<Filter>('todas')

  const filtered = offers.filter((o) => {
    if (filter === 'pendentes') return o.status === 'enviada'
    if (filter === 'aceitas')   return o.status === 'aceita'
    if (filter === 'recusadas') return o.status === 'recusada' || o.status === 'expirada'
    return true
  })

  const counts = {
    todas:     offers.length,
    pendentes: offers.filter((o) => o.status === 'enviada').length,
    aceitas:   offers.filter((o) => o.status === 'aceita').length,
    recusadas: offers.filter((o) => o.status === 'recusada' || o.status === 'expirada').length,
  }

  const filterLabels: Record<Filter, string> = {
    todas:     `Todas (${counts.todas})`,
    pendentes: `Pendentes (${counts.pendentes})`,
    aceitas:   `Aceitas (${counts.aceitas})`,
    recusadas: `Recusadas (${counts.recusadas})`,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todas', 'pendentes', 'aceitas', 'recusadas'] as Filter[]).map((f) => (
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
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Você ainda não enviou ofertas</p>
          <p className="text-xs mt-1">Acesse a aba Mercado para responder cotações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((offer) => (
            <OfertaCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}
