// src/app/catalogo/page.tsx
'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PRODUCTS, filterProducts, Product, ProductFilters } from '@/lib/products'
import { useAuth } from '@/contexts/auth-context'
import ProductCard from '@/components/catalogo/ProductCard'
import CatalogFilters from '@/components/catalogo/CatalogFilters'
import Pagination from '@/components/catalogo/Pagination'
import OfferModal from '@/components/catalogo/OfferModal'

function useFilters(): [ProductFilters, (key: keyof ProductFilters, value: string) => void, () => void] {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters: ProductFilters = {
    search: searchParams.get('search') ?? '',
    brand:  searchParams.get('marca')  ?? 'todos',
    size:   searchParams.get('tam')    ?? 'todos',
    sort:   searchParams.get('sort')   ?? '',
    page:   Number(searchParams.get('page') ?? '1'),
  }

  const updateFilter = useCallback(
    (key: keyof ProductFilters, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const paramKey = key === 'brand' ? 'marca' : key === 'size' ? 'tam' : key
      if (value && value !== 'todos') {
        params.set(paramKey, value)
      } else {
        params.delete(paramKey)
      }
      params.delete('page')
      router.replace(`/catalogo?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.replace('/catalogo')
  }, [router])

  return [filters, updateFilter, clearFilters]
}

function CatalogoContent() {
  const [filters, updateFilter, clearFilters] = useFilters()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const { items, total, totalPages } = filterProducts(PRODUCTS, filters)

  const start = (filters.page - 1) * 12 + 1
  const end = Math.min(filters.page * 12, total)

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/catalogo?${params.toString()}`)
  }

  return (
    <>
      <div className="bg-brand-bg min-h-screen py-10">
        <div className="container-fl">

          {/* Page header */}
          <div className="flex flex-col gap-1 mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Fraldinha Livre
              </p>
              <h1 className="font-display font-black text-brand-text"
                  style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}>
                Catálogo de Produtos
              </h1>
            </div>
            {total > 0 && (
              <p className="text-sm text-brand-muted">
                Mostrando <strong>{start}–{end}</strong> de <strong>{total}</strong> produtos
              </p>
            )}
          </div>

          {/* Mobile: filtrar button acima do grid */}
          <div className="lg:hidden mb-4">
            <CatalogFilters
              filters={filters}
              onChange={updateFilter}
              onClear={clearFilters}
            />
          </div>

          {/* Layout: sidebar + grid */}
          <div className="flex gap-8 items-start">

            {/* Sidebar desktop */}
            <CatalogFilters
              filters={filters}
              onChange={updateFilter}
              onClear={clearFilters}
            />

            {/* Grid */}
            <div className="flex-1 min-w-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <span className="text-5xl mb-4">🔍</span>
                  <p className="font-display font-extrabold text-lg text-brand-text mb-2">
                    Nenhum produto encontrado
                  </p>
                  <p className="text-sm text-brand-muted mb-6">
                    Tente ajustar os filtros ou limpar a busca.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="px-5 py-2.5 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isLoggedIn={user !== null}
                        onRequestOffer={setSelectedProduct}
                      />
                    ))}
                  </div>

                  <Pagination
                    currentPage={filters.page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de oferta */}
      <OfferModal
        key={selectedProduct?.id ?? ''}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  )
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={null}>
      <CatalogoContent />
    </Suspense>
  )
}
