'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getProductBySlug } from '@/lib/products'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { formatPrice, isProfileComplete } from '@/lib/utils'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { type CartItem } from '@/lib/domain/cart'
import { toast } from 'sonner'
import { Minus, Plus } from 'lucide-react'

export default function ProductPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug as string
  const product = getProductBySlug(slug)
  const [quantity, setQuantity] = useState(1)
  const router = useRouter()
  const cart = useCart()
  const { user, profile } = useAuth()

  if (!product) {
    return (
      <div className="container-fl py-16 text-center">
        <div className="max-w-md mx-auto">
          <h1 className="font-display font-black text-2xl text-brand-text mb-2">
            Produto não encontrado
          </h1>
          <p className="text-brand-muted mb-6">
            Desculpe, o produto que você buscava não existe ou foi removido.
          </p>
          <Link
            href="/catalogo"
            className="inline-block px-6 py-3 rounded-full bg-primary-dark text-white font-display font-bold hover:bg-primary transition-colors"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    )
  }

  // Type guard: product é garantidamente definido após o early return
  const definiteProduct = product

  // Supplier info
  const supplier = STORE_SUPPLIERS.find(s => s.id === definiteProduct.supplierId)
  const supplierName = supplier?.name || 'Fornecedor desconhecido'
  const supplierRating = supplier?.rating || 0

  const isLoggedIn = user !== null

  function handleAddToCart() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/produto/${slug}`)
      return
    }

    const cartItem: CartItem = {
      productId: definiteProduct.id,
      productName: `${definiteProduct.name} ${definiteProduct.size}`,
      supplierId: definiteProduct.supplierId,
      supplierName,
      unitPrice: definiteProduct.priceInCents,
      quantity,
      unit: 'un',
    }
    cart.addItem(cartItem)
    toast.success('Adicionado à sacola', {
      action: {
        label: 'Ver sacola',
        onClick: () => router.push('/sacola'),
      },
    })
    setQuantity(1)
  }

  function handleBuyNow() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/produto/${slug}`)
      return
    }

    if (!isProfileComplete(profile)) {
      router.push(`/minha-conta?tab=perfil&returnTo=/produto/${slug}`)
      return
    }

    const cartItem: CartItem = {
      productId: definiteProduct.id,
      productName: `${definiteProduct.name} ${definiteProduct.size}`,
      supplierId: definiteProduct.supplierId,
      supplierName,
      unitPrice: definiteProduct.priceInCents,
      quantity,
      unit: 'un',
    }
    cart.addItem(cartItem)
    router.push('/checkout')
  }

  return (
    <div className="container-fl py-8 sm:py-12">
      {/* Breadcrumb */}
      <div className="mb-8 text-sm text-brand-muted">
        <Link href="/catalogo" className="hover:text-primary-dark transition-colors">
          Catálogo
        </Link>
        {' / '}
        <span className="text-brand-text">{definiteProduct.name}</span>
      </div>

      {/* Main content: image + info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Image column */}
        <div className="flex items-center justify-center">
          <div className="w-full aspect-square bg-primary-light rounded-card shadow-card flex items-center justify-center text-6xl sm:text-7xl">
            <span aria-hidden="true">🧷</span>
          </div>
        </div>

        {/* Info column */}
        <div className="flex flex-col">
          {/* Brand */}
          <span className="text-xs font-bold uppercase tracking-wide text-primary-dark mb-2">
            {definiteProduct.brand}
          </span>

          {/* Name */}
          <h1 className="font-display font-black text-2xl sm:text-3xl text-brand-text mb-2">
            {definiteProduct.name}
          </h1>

          {/* Size & Quantity */}
          <p className="text-sm text-brand-muted mb-4">
            Tam. {definiteProduct.size} · {definiteProduct.quantity} un.
          </p>

          {/* Supplier & Rating */}
          <p className="text-xs text-brand-muted mb-6">
            <span className="font-semibold">{supplierName}</span>
            {' '}
            <span className="text-accent">
              {'★'.repeat(supplierRating)}{'☆'.repeat(5 - supplierRating)}
            </span>
          </p>

          {/* Price */}
          <p className="font-display font-black text-xl sm:text-2xl text-brand-text mb-6">
            {formatPrice(definiteProduct.priceInCents)}
            <span className="text-xs font-medium text-brand-muted font-body"> / pct</span>
          </p>

          {/* Description */}
          <p className="text-sm text-brand-text mb-8 leading-relaxed">
            {definiteProduct.descricao}
          </p>

          {/* Attributes */}
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wide text-primary-dark mb-4">
              Especificações
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-muted">Faixa de peso:</span>
                <span className="font-semibold text-brand-text">
                  {definiteProduct.atributos.faixaPeso}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Gênero:</span>
                <span className="font-semibold text-brand-text capitalize">
                  {definiteProduct.atributos.genero}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Absorção:</span>
                <span className="font-semibold text-brand-text">
                  {definiteProduct.atributos.absorcao}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Tecnologia:</span>
                <span className="font-semibold text-brand-text">
                  {definiteProduct.atributos.tecnologia}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Unidades por pacote:</span>
                <span className="font-semibold text-brand-text">{definiteProduct.quantity} un</span>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wide text-primary-dark mb-3">
              Quantidade
            </label>
            <div className="flex items-center gap-1 bg-slate-100 rounded-full px-2 py-1 w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity === 1}
                aria-label="Diminuir quantidade"
                className="p-1 rounded-full hover:bg-slate-200 transition-colors text-brand-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="w-8 text-center font-bold text-sm text-brand-text"
                aria-live="polite"
                aria-label={`Quantidade: ${quantity}`}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Aumentar quantidade"
                className="p-1 rounded-full hover:bg-slate-200 transition-colors text-brand-text"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:gap-2">
            {/* Adicionar à sacola */}
            <button
              onClick={handleAddToCart}
              aria-label={`Adicionar ${definiteProduct.name} ${definiteProduct.size} à sacola`}
              className="w-full py-3 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
            >
              Adicionar à sacola
            </button>

            {/* Comprar agora */}
            <button
              onClick={handleBuyNow}
              aria-label="Comprar agora"
              className="w-full py-3 rounded-full font-display font-bold text-sm transition-colors border-2 border-primary-dark text-primary-dark hover:bg-primary-dark hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
            >
              Comprar agora
            </button>
          </div>

          {/* TODO(T4.1): extrair hook compartilhado de compra com ProductCard (evitar drift do gate/quantidade) */}
        </div>
      </div>
    </div>
  )
}
