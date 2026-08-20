// src/components/catalogo/CatalogoView.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation'
import { filterProducts, Product, ProductFilters } from '@/lib/products'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { useProducts } from '@/contexts/products-context'
import { isProfileComplete } from '@/lib/utils'
import ProductCard from '@/components/catalogo/ProductCard'
import { CatalogFiltersDesktopSidebar, CatalogFiltersMobileTrigger } from '@/components/catalogo/CatalogFilters'
import Pagination from '@/components/catalogo/Pagination'
import OfferModal from '@/components/catalogo/OfferModal'

export function useFilters(): [ProductFilters, (key: keyof ProductFilters, value: string) => void, () => void] {
  const router = useRouter()
  const rawPathname = usePathname()
  const pathname = rawPathname ?? '/catalogo'
  const searchParams = useSearchParams()
  const params = useParams()

  const pageStr = searchParams.get('page') ?? '1'
  const parsedPage = parseInt(pageStr, 10)
  const sanitizedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const rawFornecedorId = params?.fornecedorId
  const routeFornecedorId = Array.isArray(rawFornecedorId) ? rawFornecedorId[0] : (rawFornecedorId as string | undefined)

  const filters: ProductFilters = {
    search: searchParams.get('search') ?? '',
    brand:  searchParams.get('marca')  ?? 'todos',
    size:   searchParams.get('tam')    ?? 'todos',
    sort:   searchParams.get('sort')   ?? '',
    page:   sanitizedPage,
    supplierId: routeFornecedorId || (searchParams.get('fornecedor') ?? undefined),
  }

  const updateFilter = useCallback(
    (key: keyof ProductFilters, value: string) => {
      const urlParams = new URLSearchParams(searchParams.toString())
      const paramKey = key === 'brand' ? 'marca' : key === 'size' ? 'tam' : key === 'supplierId' ? 'fornecedor' : key
      // Sentinela 'todos' só vale para brand/size; search e sort gravam para qualquer valor não-vazio
      if ((key === 'brand' || key === 'size') && value === 'todos') {
        urlParams.delete(paramKey)
      } else if (value) {
        urlParams.set(paramKey, value)
      } else {
        urlParams.delete(paramKey)
      }
      urlParams.delete('page')
      const qs = urlParams.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const clearFilters = useCallback(() => {
    const urlParams = new URLSearchParams()
    const fornecedor = searchParams.get('fornecedor')
    if (fornecedor && !routeFornecedorId) {
      urlParams.set('fornecedor', fornecedor)
    }
    const qs = urlParams.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, routeFornecedorId, router, searchParams])

  return [filters, updateFilter, clearFilters]
}

export function CatalogoView() {
  const [filters, updateFilter, clearFilters] = useFilters()
  const [selectedProductForOffer, setSelectedProductForOffer] = useState<Product | null>(null)
  const router = useRouter()
  const rawPathname = usePathname()
  const pathname = rawPathname ?? '/catalogo'
  const searchParams = useSearchParams()
  const { user, profile } = useAuth()
  const { addItem } = useCart()
  const { products, loading, error } = useProducts()

  const { items, total, totalPages } = filterProducts(products, filters)

  // Clamp página ao range válido [1, totalPages] para coerência com itens exibidos
  const safePage = Math.max(1, Math.min(filters.page, totalPages || 1))
  const start = (safePage - 1) * 12 + 1
  const end = Math.min(safePage * 12, total)

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleBuy(product: Product, quantity: number) {
    // RN-06: trava de compra — se logado mas perfil incompleto, redirecionar para minha-conta
    if (user && !isProfileComplete(profile)) {
      router.push(`/minha-conta?tab=perfil&returnTo=${encodeURIComponent(pathname)}`)
      return
    }

    // Add to cart and navigate to checkout
    const supplier = STORE_SUPPLIERS.find((s) => s.id === product.supplierId)
    const supplierName = supplier?.name || (user?.uid === product.supplierId ? (user.displayName || user.email?.split('@')[0] || 'Fornecedor Parceiro') : 'Fornecedor desconhecido')

    addItem({
      productId: product.id,
      productName: `${product.name} ${product.size}`,
      supplierId: product.supplierId,
      supplierName,
      unitPrice: product.priceInCents,
      quantity,
      unit: 'un',
    })

    router.push('/checkout')
  }

  const supplierName = filters.supplierId 
    ? STORE_SUPPLIERS.find(s => s.id === filters.supplierId)?.name || 
      (user?.uid === filters.supplierId ? (user.displayName || user.email?.split('@')[0] || 'Fornecedor Parceiro') : 'Fornecedor Parceiro')
    : null

  return (
    <>
      <div className="bg-brand-bg min-h-screen py-10">
        <div className="container-fl">

          {/* Page header */}
          <div className="flex flex-col gap-1 mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                {supplierName ? 'Loja Exclusiva' : 'Fraldinha Livre'}
              </p>
              <h1 className="font-display font-black text-brand-text"
                  style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}>
                {supplierName ? `Catálogo: ${supplierName}` : 'Catálogo de Produtos'}
              </h1>
            </div>
            {total > 0 && (
              <p className="text-sm text-brand-muted">
                Mostrando <strong>{start}–{end}</strong> de <strong>{total}</strong> produtos
              </p>
            )}
          </div>

          {/* Mobile: filtrar button acima do grid */}
          <div className="mb-4">
            <CatalogFiltersMobileTrigger
              filters={filters}
              onChange={updateFilter}
              onClear={clearFilters}
            />
          </div>

          {/* Layout: sidebar + grid */}
          <div className="flex gap-8 items-start">

            {/* Sidebar desktop */}
            <CatalogFiltersDesktopSidebar
              filters={filters}
              onChange={updateFilter}
              onClear={clearFilters}
            />

            {/* Grid */}
            <div className="flex-1 min-w-0">
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-4 w-12 h-12 border-4 border-primary-light border-t-primary-dark rounded-full animate-spin"></div>
                  <p className="font-display font-extrabold text-lg text-brand-text">
                    Carregando catálogo...
                  </p>
                </div>
              )}
              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <span className="text-5xl mb-4">⚠️</span>
                  <p className="font-display font-extrabold text-lg text-brand-text mb-2">
                    Erro ao carregar catálogo
                  </p>
                  <p className="text-sm text-brand-muted mb-6">
                    {error}
                  </p>
                </div>
              )}
              {!loading && !error && items.length === 0 && (
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
              )}
              {!loading && !error && items.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isLoggedIn={user !== null}
                        onRequestOffer={setSelectedProductForOffer}
                        onBuy={handleBuy}
                      />
                    ))}
                  </div>

                  <Pagination
                    currentPage={safePage}
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
        key={selectedProductForOffer?.id ?? ''}
        product={selectedProductForOffer}
        onClose={() => setSelectedProductForOffer(null)}
      />
    </>
  )
}

export default CatalogoView
