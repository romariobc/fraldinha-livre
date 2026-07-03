'use client'

import { useRouter } from 'next/navigation'
import { Product, Badge } from '@/lib/products'
import { LEILAO_ATIVO } from '@/lib/feature-flags'
import { formatPrice } from '@/lib/utils'
import { STORE_SUPPLIERS } from '@/lib/suppliers'

const BADGE_STYLES: Record<Badge, string> = {
  'Mais vendido': 'bg-primary-dark text-white',
  'Oferta':       'bg-accent text-white',
  'Novidade':     'bg-brand-muted text-white',
}

interface ProductCardProps {
  product: Product
  onRequestOffer: (product: Product) => void
  onBuy: (product: Product) => void
  isLoggedIn: boolean
}

export default function ProductCard({ product, onRequestOffer, onBuy, isLoggedIn }: ProductCardProps) {
  const router = useRouter()

  // Buscar fornecedor
  const supplier = STORE_SUPPLIERS.find(s => s.id === product.supplierId)
  const supplierName = supplier?.name || 'Fornecedor desconhecido'
  const supplierRating = supplier?.rating || 0

  function handleBuy() {
    if (!isLoggedIn) {
      router.push('/login?redirect=/catalogo')
      return
    }
    onBuy(product)
  }

  function handleOffer() {
    if (!LEILAO_ATIVO) return
    if (!isLoggedIn) {
      router.push('/login?redirect=/catalogo')
      return
    }
    onRequestOffer(product)
  }

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden hover:-translate-y-1.5 hover:shadow-card-hover transition-all flex flex-col">
      {/* Imagem / placeholder */}
      <div className="aspect-square bg-primary-light flex items-center justify-center text-4xl sm:text-5xl relative">
        <span aria-hidden="true">🧷</span>
        {product.badge && (
          <span
            className={`absolute top-2.5 left-2.5 text-[10px] font-bold rounded-full px-2.5 py-0.5 ${BADGE_STYLES[product.badge]}`}
          >
            {product.badge}
          </span>
        )}
      </div>

      {/* Informações */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary-dark mb-0.5">
          {product.brand}
        </span>
        <p className="font-display font-extrabold text-sm text-brand-text mb-0.5">
          {product.name}
        </p>
        <p className="text-[11px] text-brand-muted mb-2">
          Tam. {product.size} · {product.quantity} un.
        </p>

        {/* Fornecedor com rating */}
        <p className="text-[10px] text-brand-muted mb-3">
          <span className="font-semibold">{supplierName}</span>
          {' '}
          <span className="text-accent">{'★'.repeat(supplierRating)}{'☆'.repeat(5 - supplierRating)}</span>
        </p>

        <div className="mt-auto">
          <p className="font-display font-black text-base sm:text-lg text-brand-text mb-3">
            {formatPrice(product.priceInCents)}
            <span className="text-[11px] font-medium text-brand-muted font-body"> / pct</span>
          </p>
          <div className="flex flex-col gap-2">
            {/* CTA primário: Comprar */}
            <button
              onClick={handleBuy}
              aria-label={`Comprar ${product.name}`}
              className="w-full py-2 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
            >
              Comprar
            </button>

            {/* CTA secundário: Pedir oferta (inativo) */}
            <div className="relative">
              <button
                onClick={handleOffer}
                disabled={!LEILAO_ATIVO}
                aria-disabled={!LEILAO_ATIVO}
                aria-label={`Pedir oferta de ${product.name}`}
                className={`w-full py-2 rounded-full font-display font-bold text-sm transition-colors ${
                  LEILAO_ATIVO
                    ? 'bg-accent text-white hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
                    : 'bg-accent text-white opacity-50 cursor-not-allowed'
                }`}
              >
                Pedir oferta →
              </button>
              {!LEILAO_ATIVO && (
                <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-brand-muted text-white px-1.5 py-0.5 rounded-full">
                  Em breve
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
