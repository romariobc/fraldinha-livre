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
import { useState, useEffect, useRef, Suspense } from 'react'
import { MockPaymentGateway } from '@/lib/adapters/mock-payment-gateway'
import { MockFulfillmentService } from '@/lib/adapters/mock-fulfillment-service'
import { orderToDirectOrder } from '@/lib/order-adapters'
import { InsufficientStockError } from '@/lib/ports/order-repository'
import { toast } from 'sonner'
import { showErrorToast, diagnoseError, logFrontendDiagnostic } from '@/lib/frontend-diagnostics'

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

  // Handler: Pagar (pagamento simulado primeiro, pedido apenas se aprovado — MVP-03)
  const handlePagar = async () => {
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

        {/* Step: Pagamento */}
        {step === 'pagamento' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="font-display font-black text-2xl text-brand-text mb-8">
              Forma de pagamento
            </h1>

            <div className="bg-white rounded-card shadow-card p-6 space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-bold text-amber-900 mb-1">
                  Pagamento simulado
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Ambiente de demonstração — nenhuma cobrança real será realizada. Esta etapa valida os contratos de pagamento e a criação de pedidos no sistema.
                </p>
              </div>

              {/* Erro de pagamento recusado */}
              {paymentState === 'declined' && paymentError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1"
                >
                  <p className="font-bold">Pagamento simulado recusado</p>
                  <p className="text-xs text-red-700">{paymentError}</p>
                  <p className="text-xs text-brand-muted mt-2">
                    Nenhum pedido foi gerado e sua sacola continua intacta. Para prosseguir no teste, selecione &quot;Aprovar simulação&quot; abaixo.
                  </p>
                </div>
              )}

              {/* Forma de pagamento */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                  Método de pagamento
                </p>
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:border-primary-dark/40 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="pix"
                    checked={paymentMethod === 'pix'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4 text-primary-dark"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-brand-text">Pix</span>
                    <span className="text-xs text-brand-muted">Aprovação instantânea na simulação</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:border-primary-dark/40 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4 text-primary-dark"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-brand-text">Cartão de crédito</span>
                    <span className="text-xs text-brand-muted">Simulação sem coleta de dados do cartão (RN de segurança)</span>
                  </div>
                </label>
              </div>

              {/* Controle de Simulação para QA / Teste */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <p className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                  Cenário de teste da simulação
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    simulationOutcome === 'approved'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="simulationOutcome"
                      value="approved"
                      checked={simulationOutcome === 'approved'}
                      onChange={() => {
                        setSimulationOutcome('approved')
                        if (paymentState === 'declined') {
                          setPaymentState('idle')
                          setPaymentError(null)
                        }
                      }}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-emerald-900">Aprovar simulação</p>
                      <p className="text-emerald-700">Cria o pedido e conclui a compra</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    simulationOutcome === 'declined'
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="simulationOutcome"
                      value="declined"
                      checked={simulationOutcome === 'declined'}
                      onChange={() => setSimulationOutcome('declined')}
                      className="w-4 h-4 text-rose-600"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-rose-900">Recusar simulação</p>
                      <p className="text-rose-700">Testa recusa sem gerar pedido</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3">
                <button
                  onClick={() => setStep('revisao')}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm hover:bg-slate-50 transition-colors text-brand-text disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handlePagar}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {paymentState === 'processing' ? 'Processando pagamento...' : 'Pagar'}
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

              {completedPayment && (
                <div className="my-6 p-4 bg-slate-50 rounded-lg text-xs text-brand-text inline-block text-left border border-slate-200">
                  <p className="font-bold text-brand-text mb-1">Comprovante de pagamento simulado</p>
                  <p className="text-brand-muted">
                    Método: <span className="font-medium text-brand-text">{completedPayment.method === 'pix' ? 'Pix' : 'Cartão de crédito'}</span>
                  </p>
                  <p className="text-brand-muted">
                    Transação: <span className="font-mono text-brand-text">{completedPayment.transactionId}</span>
                  </p>
                  <p className="text-emerald-700 font-semibold mt-1">Status: Simulado e Aprovado</p>
                </div>
              )}

              <p className="text-sm text-brand-muted mb-8">
                Acompanhe seu pedido em Minha Conta.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/minha-conta"
                  className="inline-block py-3 px-6 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
                >
                  Ver meus pedidos
                </Link>
                <Link
                  href="/catalogo"
                  className="inline-block py-3 px-6 rounded-full font-display font-semibold text-sm transition-colors border-2 border-primary/30 text-primary-dark hover:bg-primary-light"
                >
                  Continuar comprando
                </Link>
              </div>
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
