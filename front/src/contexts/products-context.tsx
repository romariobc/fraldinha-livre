'use client'

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import type { Product as LegacyProduct } from '@/lib/products'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import type { Product as ContractProduct } from '@contracts'

function contractProductToLegacyProduct(p: ContractProduct): LegacyProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    size: p.size,
    quantity: p.quantity,
    priceInCents: p.priceCents,
    oldPriceCents: p.oldPriceCents ?? undefined,
    supplierId: p.supplierId,
    slug: p.slug,
    categoria: p.categoria,
    descricao: p.descricao,
    atributos: p.atributos,
    badge: p.badge,
    imageUrl: p.imageUrl,
  }
}

interface ProductsContextType {
  products: LegacyProduct[]
  loading: boolean
  error: string | null
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<LegacyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo: ProductRepository = useMemo(() => {
    return new HttpProductRepository()
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const result = await repo.list()
        if (cancelled) return
        setProducts(result.map(contractProductToLegacyProduct))
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar produtos:', err)
        setError('Não foi possível carregar o catálogo. Tente novamente.')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    // list() e rota publica - nunca exige auth, carrega direto (diferente de OrdersProvider).
    load()
    return () => { cancelled = true }
  }, [repo])

  return (
    <ProductsContext.Provider value={{ products, loading, error }}>
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
