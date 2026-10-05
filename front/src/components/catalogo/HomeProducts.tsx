'use client'

import { useRouter } from 'next/navigation'
import { useProducts } from '@/contexts/products-context'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { isProfileComplete } from '@/lib/utils'
import type { Product } from '@/lib/products'
import ProductCard from './ProductCard'

export default function HomeProducts() {
  const { products, loading, error, refetch } = useProducts()
  const { user, profile } = useAuth()
  const { addItem } = useCart()
  const router = useRouter()

  function buy(product: Product, quantity: number) {
    if (!isProfileComplete(profile)) {
      router.push('/minha-conta?tab=perfil&returnTo=%2F')
      return
    }
    addItem({ productId: product.id, productName: `${product.name} ${product.size}`,
      supplierId: product.supplierId, supplierName: 'Fornecedor parceiro',
      unitPrice: product.priceInCents, quantity, unit: 'un' })
    router.push('/checkout')
  }

  if (loading) return <p role="status">Carregando produtos...</p>
  if (error) return (
    <div role="alert">
      <p>Não foi possível carregar os produtos.</p>
      <button onClick={() => refetch?.()} className="mt-3 text-primary-dark font-bold">Tentar novamente</button>
    </div>
  )
  if (products.length === 0) return <p>Nenhum produto disponível no momento.</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.slice(0, 4).map(product => (
        <ProductCard key={product.id} product={product} isLoggedIn={user !== null}
          onBuy={buy} onRequestOffer={() => router.push('/catalogo')} />
      ))}
    </div>
  )
}
