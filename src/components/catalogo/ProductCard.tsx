'use client'

import { useRouter } from 'next/navigation'
import { Product, Badge } from '@/lib/products'

const BADGE_STYLES: Record<Badge, string> = {
  'Mais vendido': 'bg-primary-dark text-white',
  'Oferta':       'bg-accent text-white',
  'Novidade':     'bg-brand-muted text-white',
}

interface ProductCardProps {
  product: Product
  onRequestOffer: (product: Product) => void
  isLoggedIn: boolean
}

export default function ProductCard({ product, onRequestOffer, isLoggedIn }: ProductCardProps) {
  const router = useRouter()

  function handleOffer() {
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
        <p className="text-[11px] text-brand-muted mb-3">
          Tam. {product.size} · {product.quantity} un.
        </p>

        <div className="mt-auto">
          <p className="font-display font-black text-base sm:text-lg text-brand-text mb-3">
            R$&nbsp;{product.price.toFixed(2).replace('.', ',')}
            <span className="text-[11px] font-medium text-brand-muted font-body"> / pct</span>
          </p>
          <button
            onClick={handleOffer}
            aria-label={`Pedir oferta de ${product.name}`}
            className="w-full py-2 rounded-full bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
          >
            Pedir oferta →
          </button>
        </div>
      </div>
    </div>
  )
}
