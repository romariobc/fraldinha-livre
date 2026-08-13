'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'
import { useProducts } from '@/contexts/products-context'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { MOCK_USER } from '@/lib/account-mock'
import type { Address, Order } from '@/lib/account-mock'
import type { PaymentMethod } from '@/lib/ports/payment'
import { lineTotal, cartSubtotal } from '@/lib/domain/cart'
import { formatPrice } from '@/lib/utils'
import { ShoppingBag } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { MockPaymentGateway } from '@/lib/adapters/mock-payment-gateway'
import { MockFulfillmentService } from '@/lib/adapters/mock-fulfillment-service'
import { orderToDirectOrder } from '@/lib/order-adapters'
import { toast } from 'sonner'

type CheckoutStep = 'endereco' | 'revisao' | 'pagamento' | 'confirmacao'

function CheckoutContent() {
  const { items, subtotal, bySupplier, clear, addItem } = useCart()
  const { products, loading: productsLoading } = useProducts()
  const { user, loading, profile, updateProfile } = useAuth()
  const { createOrdersFromCart } = useOrders()
  const { addDirectOrder } = useMarket()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlProductId = searchParams.get('productId')
  const urlQuantity = parseInt(searchParams.get('quantity') || '0', 10)
  const urlPaymentMethod = searchParams.get('paymentMethod')
  const urlCep = searchParams.get('cep')
  const urlLogradouro = searchParams.get('logradouro')
  const urlNumero = searchParams.get('numero')
  const urlComplemento = searchParams.get('complemento')
  const urlBairro = searchParams.get('bairro')
  const urlCidade = searchParams.get('cidade')
  const urlEstado = searchParams.get('estado')

  const [step, setStep] = useState<CheckoutStep>('endereco')
  const [useCustomAddress, setUseCustomAddress] = useState(false)
  const [customAddress, setCustomAddress] = useState<Address>({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')

  useEffect(() => {
    // 1. Process custom address if provided in URL
    if (urlCep && urlLogradouro && urlNumero) {
      setCustomAddress({
        logradouro: urlLogradouro,
        numero: urlNumero,
        complemento: urlComplemento || '',
        bairro: urlBairro || '',
        cidade: urlCidade || '',
        estado: urlEstado || '',
        cep: urlCep,
      })
      setUseCustomAddress(true)
      setStep('revisao')
    }

    // 2. Process payment method if provided in URL
    if (urlPaymentMethod) {
      if (urlPaymentMethod === 'cartao' || urlPaymentMethod === 'card') {
        setPaymentMethod('card')
      } else if (urlPaymentMethod === 'pix') {
        setPaymentMethod('pix')
      }
    }

    // 3. Add item to cart if product ID is provided
    if (urlProductId && urlQuantity > 0 && !productsLoading && products.length > 0) {
      const product = products.find((p) => p.id === urlProductId)
      if (product) {
        const supplier = STORE_SUPPLIERS.find((s) => s.id === product.supplierId)
        addItem({
          productId: product.id,
          productName: `${product.name} ${product.size}`,
          supplierId: product.supplierId,
          supplierName: supplier?.name || 'Fornecedor desconhecido',
          unitPrice: product.priceInCents,
          quantity: urlQuantity,
          unit: 'un',
        })
        router.replace('/checkout')
      }
    }
  }, [
    urlProductId,
    urlQuantity,
    urlPaymentMethod,
    urlCep,
    urlLogradouro,
    urlNumero,
    urlComplemento,
    urlBairro,
    urlCidade,
    urlEstado,
    products,
    productsLoading,
    addItem,
    router,
  ])
  const [createdOrders, setCreatedOrders] = useState<Order[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Determine default address: profile.address or MOCK_USER.address
  const defaultAddress = profile?.address || MOCK_USER.address
  const deliveryAddress = useCustomAddress ? customAddress : defaultAddress

  // Validation: custom address requires logradouro, numero, cep, cidade, estado (trimmed)
  const isAddressValid =
    !useCustomAddress ||
    (customAddress.logradouro.trim() &&
      customAddress.numero.trim() &&
      customAddress.cep.trim() &&
      customAddress.cidade.trim() &&
      customAddress.estado.trim())

  // Handler: Pagar (idempotent payment + order creation + fulfillment)
  const handlePagar = async () => {
    // Guard: already submitted
    if (submitting) {
      return
    }
    setSubmitting(true)

    try {
      // 1. Create orders from cart
      const orders = await createOrdersFromCart(items, deliveryAddress)

      // 2. Instantiate adapters (STUB)
      let txnIdCounter = 0
      const payment = new MockPaymentGateway({
        now: () => new Date().toISOString(),
        idFactory: () => `txn-${Date.now()}-${++txnIdCounter}`,
        outcome: 'approved',
      })

      let trackingIdCounter = 0
      const fulfillment = new MockFulfillmentService({
        idFactory: () => `trk-${Date.now()}-${++trackingIdCounter}`,
        outcome: 'scheduled',
      })

      // 3. Process payment and fulfillment for each order
      for (const order of orders) {
        // Charge payment
        await payment.charge({
          orderId: order.id,
          amount: order.price!,
          method: paymentMethod,
        })

        // Schedule fulfillment
        await fulfillment.schedule({
          orderId: order.id,
          address: deliveryAddress,
          items: order.items!,
        })

        // 4. Materialize in supplier panel for sup-001
        if (order.supplierId === 'sup-001') {
          const directOrder = orderToDirectOrder(order)
          if (directOrder) {
            addDirectOrder(directOrder)
          }
        }
      }

      // Record last purchase in profile
      if (items.length > 0) {
        const firstItem = items[0]
        updateProfile({
          lastPurchase: {
            productId: firstItem.productId,
            productName: firstItem.productName,
            quantity: firstItem.quantity,
          }
        }).catch((err) => {
          console.error('Erro ao salvar última compra:', err)
        })
      }

      // 5. Save created orders, clear cart, and move to confirmacao
      setCreatedOrders(orders)
      clear()
      setStep('confirmacao')
    } catch (err) {
      console.error('Erro ao finalizar compra:', err)
      toast.error('Não foi possível finalizar a compra. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Guarda de login (D-024): finalizar compra e interacao de compra — so logado.
  // Guarda client-side, mesmo padrao de /minha-conta (endurecimento SSR fica para 006 — D-010).
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/checkout')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null // Redirecionamento em progresso
  }

  // Guard: empty cart (but not when viewing confirmacao)
  if (items.length === 0 && step !== 'confirmacao') {
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
    <section className="bg-brand-bg min-h-[60vh] py-8">
      <div className="container-fl">
        {/* Step: Endereco */}
        {step === 'endereco' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="font-display font-black text-2xl text-brand-text mb-8">
              Endereço de entrega
            </h1>

            <div className="bg-white rounded-card shadow-card p-6 space-y-6">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={!useCustomAddress}
                    onChange={() => setUseCustomAddress(false)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">
                    Usar endereço do cadastro
                  </span>
                </label>
                {!useCustomAddress && (
                  <div className="mt-3 ml-7 p-3 bg-slate-50 rounded text-xs text-brand-muted">
                    <p>
                      {defaultAddress.logradouro}, {defaultAddress.numero}
                      {defaultAddress.complemento && ` — ${defaultAddress.complemento}`}
                    </p>
                    <p>
                      {defaultAddress.bairro}, {defaultAddress.cidade}/{defaultAddress.estado}
                    </p>
                    <p>{defaultAddress.cep}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={useCustomAddress}
                    onChange={() => setUseCustomAddress(true)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">Outro endereço</span>
                </label>

                {useCustomAddress && (
                  <div className="mt-3 ml-7 space-y-3">
                    <input
                      type="text"
                      placeholder="Logradouro *"
                      value={customAddress.logradouro}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, logradouro: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Número *"
                      value={customAddress.numero}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, numero: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Complemento"
                      value={customAddress.complemento || ''}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, complemento: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Bairro"
                      value={customAddress.bairro}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, bairro: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="CEP *"
                        value={customAddress.cep}
                        onChange={(e) =>
                          setCustomAddress({ ...customAddress, cep: e.target.value })
                        }
                        className="px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Cidade *"
                        value={customAddress.cidade}
                        onChange={(e) =>
                          setCustomAddress({ ...customAddress, cidade: e.target.value })
                        }
                        className="px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="UF (ex: SP) *"
                      value={customAddress.estado}
                      onChange={(e) =>
                        setCustomAddress({
                          ...customAddress,
                          estado: e.target.value.toUpperCase(),
                        })
                      }
                      maxLength={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    {!isAddressValid && (
                      <p className="text-xs text-red-600">
                        Preencha todos os campos obrigatórios (*)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3">
                <button
                  disabled
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm opacity-50 cursor-not-allowed"
                >
                  Voltar
                </button>
                <button
                  onClick={() => setStep('revisao')}
                  disabled={!isAddressValid}
                  className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Revisao */}
        {step === 'revisao' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="font-display font-black text-2xl text-brand-text mb-8">
              Revisão do pedido
            </h1>

            <div className="bg-white rounded-card shadow-card overflow-hidden mb-6">
              {/* Itens agrupados por fornecedor */}
              <div className="divide-y divide-slate-100">
                {Array.from(bySupplier.entries()).map(([supplierId, supplierItems]) => {
                  const supplierName = supplierItems[0]?.supplierName || 'Fornecedor'
                  const supplierSubtotal = cartSubtotal(supplierItems)

                  return (
                    <div key={supplierId} className="p-6">
                      <h2 className="font-display font-bold text-base text-brand-text mb-4">
                        {supplierName}
                      </h2>

                      <div className="space-y-2 mb-4">
                        {supplierItems.map((item) => (
                          <div
                            key={`${item.productId}-${item.supplierId}`}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-brand-text">
                              {item.productName} × {item.quantity}
                            </span>
                            <span className="font-semibold text-brand-text">
                              {formatPrice(lineTotal(item))}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-brand-muted">
                          Subtotal
                        </span>
                        <span className="font-display font-bold text-base text-brand-text">
                          {formatPrice(supplierSubtotal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Endereço de entrega */}
              <div className="border-t border-slate-100 p-6 bg-slate-50">
                <p className="text-xs font-semibold text-brand-muted uppercase mb-2">
                  Entrega em
                </p>
                <p className="text-sm text-brand-text">
                  {deliveryAddress.logradouro}, {deliveryAddress.numero}
                  {deliveryAddress.complemento && ` — ${deliveryAddress.complemento}`}
                </p>
                <p className="text-sm text-brand-text">
                  {deliveryAddress.bairro}, {deliveryAddress.cidade}/{deliveryAddress.estado}
                </p>
                <p className="text-sm text-brand-text">{deliveryAddress.cep}</p>
              </div>

              {/* Total */}
              <div className="p-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base text-brand-text">Total</span>
                  <span className="font-display font-black text-2xl text-brand-text">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('endereco')}
                className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm hover:bg-slate-50 transition-colors text-brand-text"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('pagamento')}
                className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step: Pagamento (STUB) */}
        {step === 'pagamento' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="font-display font-black text-2xl text-brand-text mb-8">
              Forma de pagamento
            </h1>

            <div className="bg-white rounded-card shadow-card p-6 space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Pagamento simulado</strong> — nenhuma cobrança real será realizada.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="pix"
                    checked={paymentMethod === 'pix'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">Pix</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">Cartão de crédito</span>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3">
                <button
                  onClick={() => setStep('revisao')}
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm hover:bg-slate-50 transition-colors text-brand-text"
                >
                  Voltar
                </button>
                <button
                  onClick={handlePagar}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Pagar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Confirmacao */}
        {step === 'confirmacao' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-card shadow-card p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h1 className="font-display font-black text-2xl text-brand-text mb-4">
                Pedido confirmado!
              </h1>

              <p className="text-sm text-brand-muted mb-2">
                {createdOrders.length} pedido{createdOrders.length !== 1 ? 's' : ''} criado{createdOrders.length !== 1 ? 's' : ''} com sucesso.
              </p>

              <p className="text-sm text-brand-muted mb-8">
                Acompanhe seu pedido em Minha Conta.
              </p>

              <Link
                href="/minha-conta"
                className="inline-block py-3 px-6 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
              >
                Ver meus pedidos
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
