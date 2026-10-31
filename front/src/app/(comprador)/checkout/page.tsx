'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'
import { useProducts } from '@/contexts/products-context'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import type { Address, Order } from '@/lib/domain/account'
import type { PaymentMethod } from '@/lib/ports/payment'
import { ShoppingBag } from 'lucide-react'
import { useState, useEffect, useRef, Suspense } from 'react'
import { MockPaymentGateway } from '@/lib/adapters/mock-payment-gateway'
import { MockFulfillmentService } from '@/lib/adapters/mock-fulfillment-service'
import { orderToDirectOrder } from '@/lib/order-adapters'
import { InsufficientStockError } from '@/lib/ports/order-repository'
import { toast } from 'sonner'
import { showErrorToast, diagnoseError, logFrontendDiagnostic } from '@/lib/frontend-diagnostics'
import { CheckoutAddressStep } from '@/components/checkout/CheckoutAddressStep'
import { CheckoutReviewStep } from '@/components/checkout/CheckoutReviewStep'
import { CheckoutPaymentStep } from '@/components/checkout/CheckoutPaymentStep'
import { CheckoutConfirmationStep } from '@/components/checkout/CheckoutConfirmationStep'

type CheckoutStep = 'endereco' | 'revisao' | 'pagamento' | 'confirmacao'

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function CheckoutContent() {
  const { items, subtotal, bySupplier, clear, addItem } = useCart()
  const { products, loading: productsLoading } = useProducts()
  const { profile, updateProfile } = useAuth()
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

  const [customAddress, setCustomAddress] = useState<Address>(() => {
    if (urlCep && urlLogradouro && urlNumero) {
      return {
        logradouro: urlLogradouro,
        numero: urlNumero,
        complemento: urlComplemento || '',
        bairro: urlBairro || '',
        cidade: urlCidade || '',
        estado: urlEstado || '',
        cep: urlCep,
      }
    }
    return {
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    }
  })
  const [useCustomAddress, setUseCustomAddress] = useState(() => Boolean(urlCep && urlLogradouro && urlNumero))
  const [step, setStep] = useState<CheckoutStep>(() => (urlCep && urlLogradouro && urlNumero) ? 'revisao' : 'endereco')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    if (urlPaymentMethod === 'cartao' || urlPaymentMethod === 'card') return 'card'
    return 'pix'
  })

  useEffect(() => {
    // Add item to cart if product ID is provided
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
  }, [urlProductId, urlQuantity, productsLoading, products, addItem, router])

  const [createdOrders, setCreatedOrders] = useState<Order[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [simulationOutcome, setSimulationOutcome] = useState<'approved' | 'declined'>('approved')
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'approved' | 'declined'>('idle')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [completedPayment, setCompletedPayment] = useState<{ transactionId: string; method: PaymentMethod } | null>(null)
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey())

  // Endereço ausente nunca recebe dados de demonstração.
  const defaultAddress: Address = profile?.address ?? { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' }
  const deliveryAddress = useCustomAddress ? customAddress : defaultAddress

  const isAddressValid = Boolean(
    deliveryAddress.logradouro.trim() && deliveryAddress.numero.trim() &&
    deliveryAddress.cep.trim() && deliveryAddress.cidade.trim() && deliveryAddress.estado.trim()
  )

  // Handler: Pagar (pagamento simulado primeiro, pedido apenas se aprovado — MVP-03)
  const handlePagar = async () => {
    if (!isAddressValid) {
      setStep('endereco')
      toast.error('Informe um endereço de entrega completo antes de finalizar.')
      return
    }
    // Guard: already submitted
    if (submitting) {
      return
    }
    setSubmitting(true)
    setPaymentState('processing')
    setPaymentError(null)

    try {
      // 1. Processar cobrança simulada ANTES de criar pedidos
      let txnIdCounter = 0
      const payment = new MockPaymentGateway({
        now: () => new Date().toISOString(),
        idFactory: () => `txn-sim-${Date.now()}-${++txnIdCounter}`,
        outcome: simulationOutcome,
      })

      const paymentResult = await payment.charge({
        amount: subtotal,
        method: paymentMethod,
        simulationOutcome,
      })

      // Se recusado: não cria pedidos e não limpa o carrinho
      if (paymentResult.status === 'declined') {
        setPaymentState('declined')
        const refusalMsg = paymentResult.refusalReason || 'Pagamento simulado recusado pela operadora.'
        setPaymentError(refusalMsg)
        toast.error(refusalMsg, { duration: 5000 })
        setSubmitting(false)
        return
      }

      setPaymentState('approved')
      setCompletedPayment({
        transactionId: paymentResult.transactionId,
        method: paymentMethod,
      })

      // 2. Pagamento simulado aprovado: criar pedidos no D1 com metadados do pagamento
      const orders = await createOrdersFromCart(
        items,
        deliveryAddress,
        idempotencyKeyRef.current,
        {
          paymentMethod,
          paymentTransactionId: paymentResult.transactionId,
          paymentStatus: 'approved',
        }
      )

      // 3. Agendar fulfillment (STUB)
      let trackingIdCounter = 0
      const fulfillment = new MockFulfillmentService({
        idFactory: () => `trk-${Date.now()}-${++trackingIdCounter}`,
        outcome: 'scheduled',
      })

      for (const order of orders) {
        await fulfillment.schedule({
          orderId: order.id,
          address: deliveryAddress,
          items: order.items!,
        })

        if (order.supplierId === 'sup-001') {
          const directOrder = orderToDirectOrder(order)
          if (directOrder) {
            addDirectOrder(directOrder)
          }
        }
      }

      // 4. Salvar última compra no perfil
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

      // 5. Salva pedidos criados, limpa o carrinho e vai para confirmacao
      setCreatedOrders(orders)
      clear()
      idempotencyKeyRef.current = generateIdempotencyKey()
      setStep('confirmacao')
    } catch (err) {
      setPaymentState('idle')
      const isInsufficientStock =
        err instanceof InsufficientStockError ||
        (err instanceof Error && err.name === 'InsufficientStockError')

      if (isInsufficientStock) {
        const diag = diagnoseError(err, { operation: 'checkout.create_order' })
        logFrontendDiagnostic(diag, { operation: 'checkout.create_order' })
        const errorMsg =
          err instanceof Error && err.message
            ? err.message
            : 'Outro cliente finalizou a compra deste item antes. Por favor, revise sua sacola.'
        toast.error(errorMsg, {
          duration: 6000,
        })
        router.push('/sacola')
      } else {
        showErrorToast(err, {
          operation: 'checkout.create_order',
          customMessage: 'Não foi possível finalizar a compra. Tente novamente.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Guarda de login (D-024): finalizar compra e interacao de compra — so logado.
  // A validação de autênticação (loading, user) agora é responsabilidade do (comprador)/layout.tsx

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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/catalogo"
                  className="inline-block py-2.5 px-6 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
                >
                  Explorar catálogo
                </Link>
                <Link
                  href="/"
                  className="inline-block py-2.5 px-6 rounded-full font-display font-semibold text-sm transition-colors border-2 border-primary/30 text-primary-dark hover:bg-primary-light"
                >
                  Voltar ao início
                </Link>
              </div>
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
        {step === 'endereco' && <CheckoutAddressStep
          useCustomAddress={useCustomAddress}
          setUseCustomAddress={setUseCustomAddress}
          isAddressValid={isAddressValid}
          defaultAddress={defaultAddress}
          customAddress={customAddress}
          setCustomAddress={setCustomAddress}
          onContinue={() => setStep('revisao')}
        />}

        {/* Step: Revisao */}
        {step === 'revisao' && <CheckoutReviewStep
          bySupplier={bySupplier}
          deliveryAddress={deliveryAddress}
          subtotal={subtotal}
          onBack={() => setStep('endereco')}
          onContinue={() => setStep('pagamento')}
        />}

        {/* Step: Pagamento */}
        {step === 'pagamento' && <CheckoutPaymentStep
          paymentState={paymentState}
          paymentError={paymentError}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          simulationOutcome={simulationOutcome}
          setSimulationOutcome={setSimulationOutcome}
          setPaymentState={setPaymentState}
          setPaymentError={setPaymentError}
          submitting={submitting}
          onBack={() => setStep('revisao')}
          onPay={handlePagar}
        />}

        {/* Step: Confirmacao */}
        {step === 'confirmacao' && <CheckoutConfirmationStep createdOrders={createdOrders} completedPayment={completedPayment} />}
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
