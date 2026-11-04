'use client'

import { contractProductToCatalogProduct } from '@/lib/product-adapters'

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import type { Product as CatalogProduct } from '@/lib/products'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import { diagnoseError, logFrontendDiagnostic } from '@/lib/frontend-diagnostics'



interface ProductsContextType {
  products: CatalogProduct[]
  loading: boolean
  error: string | null
  refetch?: () => Promise<void>
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo: ProductRepository = useMemo(() => {
    return new HttpProductRepository()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await repo.list()
      setProducts(result.map(contractProductToCatalogProduct))
    } catch (err) {
      const diag = diagnoseError(err, { operation: 'products.load_list' })
      logFrontendDiagnostic(diag, { operation: 'products.load_list' })
      setError(diag.message || 'Não foi possível carregar o catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [repo])

  useEffect(() => {
    let cancelled = false

    const runInitialLoad = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const result = await repo.list()
        if (cancelled) return
        setProducts(result.map(contractProductToCatalogProduct))
      } catch (err) {
        if (cancelled) return
        const diag = diagnoseError(err, { operation: 'products.load_list' })
        logFrontendDiagnostic(diag, { operation: 'products.load_list' })
        setError(diag.message || 'Não foi possível carregar o catálogo. Tente novamente.')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    // list() e rota publica - nunca exige auth, carrega direto (diferente de OrdersProvider).
    runInitialLoad()
    return () => { cancelled = true }
  }, [repo])

  return (
    <ProductsContext.Provider value={{ products, loading, error, refetch: load }}>
      {children}
    </ProductsContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductsContext)
  if (!context) {
    throw new Error('useProducts deve ser usado dentro de ProductsProvider')
  }
  return context
}
