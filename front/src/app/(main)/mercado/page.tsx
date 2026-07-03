'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GeoScope } from '@/lib/supplier-mock'
import { MOCK_SUPPLIER } from '@/lib/supplier-mock'
import { geoMatch } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'
import { LEILAO_ATIVO } from '@/lib/feature-flags'
import GeoScopeSelector from '@/components/mercado/GeoScopeSelector'
import MarketTable from '@/components/mercado/MarketTable'

export default function MercadoPage() {
  const [scope, setScope] = useState<GeoScope>({ type: 'neighborhood' })
  const { marketOrders, declinedIds } = useMarket()

  const activeOrders = marketOrders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id)
  )
  const neighborhoodCount = activeOrders.filter((o) =>
    geoMatch(o, MOCK_SUPPLIER, { type: 'neighborhood' })
  ).length
  const cityCount = activeOrders.filter((o) =>
    geoMatch(o, MOCK_SUPPLIER, {
      type: 'city',
      city: MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo',
      state: MOCK_SUPPLIER.states[0],
    })
  ).length
  const nationalCount = activeOrders.length

  if (!LEILAO_ATIVO) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <section className="container-fl py-20 flex flex-col items-center text-center">
          <div className="mb-6 text-6xl">🎯</div>
          <h1 className="font-display font-black text-brand-text text-3xl mb-3">
            Em breve
          </h1>
          <p className="text-brand-muted text-sm max-w-md mb-2">
            O Leilão Reverso está chegando! Aqui você poderá visualizar pedidos de
            cotações abertas de outros compradores e enviar suas ofertas em tempo real.
          </p>
          <p className="text-brand-muted text-sm max-w-md mb-6">
            Enquanto isso, continue navegando nosso catálogo de produtos.
          </p>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 bg-accent text-white font-display font-bold text-sm py-3 px-6 rounded-xl hover:bg-accent-dark transition-colors"
          >
            ← Voltar ao Catálogo
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#EBF7FE] via-brand-bg to-white border-b border-primary/10">
        <div className="container-fl pt-10 pb-6">
          <p className="text-[9px] font-extrabold uppercase tracking-[.15em] text-primary-dark mb-1">
            Mercado de Cotações
          </p>
          <h1 className="font-display font-black text-brand-text text-2xl">
            Pedidos abertos de fraldas
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Sua localização:{' '}
            <strong>
              {MOCK_SUPPLIER.neighborhood}, {MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo'} ·{' '}
              {MOCK_SUPPLIER.states[0]}
            </strong>
          </p>
          <div className="flex gap-3 mt-4">
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-primary-dark block leading-none">
                {neighborhoodCount}
              </span>
              <span className="text-brand-muted">No bairro</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-green-600 block leading-none">
                {cityCount}
              </span>
              <span className="text-brand-muted">
                Em {MOCK_SUPPLIER.cities?.[0] ?? 'SP'}
              </span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-accent block leading-none">
                {nationalCount}
              </span>
              <span className="text-brand-muted">No Brasil</span>
            </div>
          </div>
        </div>
        <GeoScopeSelector value={scope} onChange={setScope} />
      </section>

      {/* Table */}
      <section className="py-5">
        <MarketTable key={JSON.stringify(scope)} scope={scope} onExpandScope={() => setScope({ type: 'national' })} />
      </section>
    </div>
  )
}
