'use client'

import Link from 'next/link'
import { ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react'
import { useCart } from '@/contexts/cart-context'
import { lineTotal, cartSubtotal } from '@/lib/domain/cart'
import { formatPrice } from '@/lib/utils'
import { LEILAO_ATIVO } from '@/lib/feature-flags'

export default function SacolaPage() {
  const { items, itemCount, subtotal, bySupplier, updateQty, removeItem } = useCart()

  if (items.length === 0) {
    return (
      <section className="bg-brand-bg min-h-[60vh] py-12">
        <div className="container-fl">
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            <ShoppingBag className="w-16 h-16 text-primary-dark opacity-30" />
            <div className="text-center">
              <h2 className="font-display font-black text-2xl text-brand-text mb-2">
                Sua sacola está vazia
              </h2>
              <p className="text-sm text-brand-muted mb-6">
                Comece a comprar para preencher sua sacola
              </p>
              <Link
                href="/catalogo"
                className="inline-block py-2 px-6 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
              >
                Explorar catálogo
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Cabeçalho */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
              Seu carrinho
            </p>
            <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
              Sua sacola
            </h1>
            <p className="text-sm text-brand-muted mt-1">
              {itemCount} item{itemCount !== 1 ? 'ns' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          {/* Grupos por fornecedor */}
          <div className="space-y-8 mb-12">
            {Array.from(bySupplier.entries()).map(([supplierId, supplierItems]) => {
              const supplierName = supplierItems[0]?.supplierName || 'Fornecedor'
              const supplierSubtotal = cartSubtotal(supplierItems)

              return (
                <div
                  key={supplierId}
                  className="bg-white rounded-card shadow-card overflow-hidden"
                >
                  {/* Cabeçalho do fornecedor */}
                  <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
                    <h2 className="font-display font-bold text-base text-brand-text">
                      {supplierName}
                    </h2>
                  </div>

                  {/* Items do fornecedor */}
                  <div className="divide-y divide-slate-100">
                    {supplierItems.map((item) => (
                      <div
                        key={`${item.productId}-${item.supplierId}`}
                        className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        {/* Info do item */}
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-extrabold text-sm text-brand-text truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-brand-muted">
                            {formatPrice(item.unitPrice)} / {item.unit}
                          </p>
                        </div>

                        {/* Quantidade + Remover */}
                        <div className="flex items-center gap-3">
                          {/* Stepper */}
                          <div className="flex items-center gap-1 bg-slate-100 rounded-full px-2 py-1">
                            <button
                              onClick={() =>
                                updateQty(
                                  item.productId,
                                  item.supplierId,
                                  item.quantity - 1
                                )
                              }
                              aria-label="Diminuir quantidade"
                              className="p-1 rounded-full hover:bg-slate-200 transition-colors text-brand-text"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-bold text-sm text-brand-text">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQty(
                                  item.productId,
                                  item.supplierId,
                                  item.quantity + 1
                                )
                              }
                              aria-label="Aumentar quantidade"
                              className="p-1 rounded-full hover:bg-slate-200 transition-colors text-brand-text"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Botão remover */}
                          <button
                            onClick={() => removeItem(item.productId, item.supplierId)}
                            aria-label={`Remover ${item.productName}`}
                            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors text-brand-muted hover:text-accent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Total da linha */}
                        <div className="text-right min-w-[80px]">
                          <p className="font-display font-black text-sm text-brand-text">
                            {formatPrice(lineTotal(item))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal do fornecedor */}
                  <div className="px-4 sm:px-6 py-3 bg-slate-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-brand-muted">
                      Subtotal (fornecedor)
                    </span>
                    <span className="font-display font-bold text-base text-brand-text">
                      {formatPrice(supplierSubtotal)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            {/* Total */}
            <div className="px-4 sm:px-6 py-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-bold text-base text-brand-text">
                  Total
                </span>
                <span className="font-display font-black text-2xl text-brand-text">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Frete a combinar com o fornecedor
              </p>
            </div>

            {/* CTAs */}
            <div className="px-4 sm:px-6 py-6 space-y-3">
              {/* CTA 1: Finalizar compra (desabilitada) */}
              <div className="relative">
                <button
                  disabled
                  aria-disabled
                  className="w-full py-3 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white opacity-50 cursor-not-allowed"
                >
                  Finalizar compra
                </button>
                <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-brand-muted text-white px-1.5 py-0.5 rounded-full">
                  Em breve
                </span>
              </div>

              {/* CTA 2: Buscar ofertas personalizadas (desabilitada quando !LEILAO_ATIVO) */}
              <div className="relative">
                <button
                  disabled={!LEILAO_ATIVO}
                  aria-disabled={!LEILAO_ATIVO}
                  className={`w-full py-3 rounded-full font-display font-bold text-sm transition-colors ${
                    LEILAO_ATIVO
                      ? 'bg-accent text-white hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
                      : 'bg-accent text-white opacity-50 cursor-not-allowed'
                  }`}
                >
                  Buscar ofertas personalizadas →
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
      </section>
    </>
  )
}
