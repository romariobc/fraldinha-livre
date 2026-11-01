'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCheckoutCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useProducts } from '@/contexts/products-context'
import { useCheckoutSession } from '@/hooks/use-checkout-session'
import { supplierLabel } from '@/lib/supplier-label'
import type { Address } from '@/lib/domain/account'
import { CheckoutAddressSchema } from '@contracts'
import { useState, useEffect, useRef, Suspense } from 'react'
import { CheckoutAddressStep } from '@/components/checkout/CheckoutAddressStep'
import { CheckoutReviewStep } from '@/components/checkout/CheckoutReviewStep'
import { CheckoutPaymentStep } from '@/components/checkout/CheckoutPaymentStep'
import { CheckoutConfirmationStep } from '@/components/checkout/CheckoutConfirmationStep'

const emptyAddress: Address = { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' }
function CheckoutContent() {
  const cart = useCheckoutCart()
  const { ready: cartReady, addItem } = cart
  const { user, profile } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const session = useCheckoutSession(user?.uid)
  const router = useRouter()
  const params = useSearchParams()
  const [customAddress, setCustomAddress] = useState<Address>(() => ({
    logradouro: params.get('logradouro') ?? '', numero: params.get('numero') ?? '',
    complemento: params.get('complemento') ?? '', bairro: params.get('bairro') ?? '',
    cidade: params.get('cidade') ?? '', estado: params.get('estado') ?? '', cep: params.get('cep') ?? '',
  }))
  const [useCustomAddress, setUseCustomAddress] = useState(() => Boolean(params.get('logradouro')))
  const [step, setStep] = useState<'endereco' | 'revisao' | 'pagamento'>('endereco')
  const [method, setMethod] = useState<'pix' | 'card'>(() => ['card', 'cartao'].includes(params.get('paymentMethod') ?? '') ? 'card' : 'pix')
  const [outcome, setOutcome] = useState<'approved' | 'declined'>('approved')
  const imported = useRef(new Set<string>())
  const urlProductId = params.get('productId')
  const urlQuantity = Number(params.get('quantity') ?? 0)
  const defaultAddress = profile?.address ?? emptyAddress
  const address = useCustomAddress ? customAddress : defaultAddress
  const isAddressValid = CheckoutAddressSchema.safeParse(address).success

  useEffect(() => {
    if (!cartReady || !session.ready || session.attempt || productsLoading || !urlProductId || !Number.isSafeInteger(urlQuantity) || urlQuantity <= 0) return
    const key = urlProductId + ':' + urlQuantity
    if (imported.current.has(key)) return
    const product = products.find(item => item.id === urlProductId)
    if (!product) return
    imported.current.add(key)
    addItem({ productId: product.id, productName: product.name + ' ' + product.size,
      supplierId: product.supplierId, supplierName: supplierLabel(product.supplierId),
      quantity: urlQuantity, unitPrice: product.priceInCents, unit: 'un' })
    router.replace('/checkout')
  }, [cartReady, addItem, session.ready, session.attempt, productsLoading, products, urlProductId, urlQuantity, router])

  const pay = async () => {
    if (!user) return
    if (!session.attempt && !isAddressValid) { setStep('endereco'); return }
    await session.submit({ userId: user.uid, items: cart.items, address, method, outcome })
  }
  const restart = async () => {
    if (await session.restart()) { setStep('endereco'); router.push('/sacola') }
  }
  if (!cart.ready || !session.ready) return <p role="status" className="container-fl py-12">Recuperando sua sacola...</p>
  if (!user) return null
  return (
    <section className="bg-brand-bg min-h-[60vh] py-8">
      <div className="container-fl">
        {session.attempt ? <CheckoutConfirmationStep attempt={session.attempt} submitting={session.submitting}
          error={session.error} onRecover={pay} onRestart={restart} /> : <>
          {(session.error || cart.storageError) && <p role="alert" className="text-red-800 bg-red-50 p-4 rounded-lg mb-4">{session.error || cart.storageError}</p>}
          {!cart.items.length ? <div className="py-16 text-center space-y-4">
            <h1 className="font-display font-black text-2xl">Sua sacola está vazia</h1>
            <Link className="text-primary-dark underline" href="/catalogo">Explorar catálogo</Link>
          </div> : <>
            {step === 'endereco' && <CheckoutAddressStep useCustomAddress={useCustomAddress} setUseCustomAddress={setUseCustomAddress}
              isAddressValid={isAddressValid} defaultAddress={defaultAddress} customAddress={customAddress}
              setCustomAddress={setCustomAddress} onContinue={() => { if (isAddressValid) setStep('revisao') }} />}
            {step === 'revisao' && <CheckoutReviewStep bySupplier={cart.bySupplier} deliveryAddress={address}
              subtotal={cart.subtotal} onBack={() => setStep('endereco')} onContinue={() => setStep('pagamento')} />}
            {step === 'pagamento' && <CheckoutPaymentStep method={method} setMethod={setMethod} outcome={outcome}
              setOutcome={setOutcome} submitting={session.submitting} onBack={() => setStep('revisao')} onPay={pay} />}
          </>}
        </>}
      </div>
    </section>
  )
}
export default function CheckoutPage() {
  return <Suspense fallback={<p role="status">Carregando checkout...</p>}><CheckoutContent /></Suspense>
}
