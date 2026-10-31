import type { PaymentMethod } from '@/lib/ports/payment'
import type { Dispatch, SetStateAction } from 'react'

interface Props {
paymentState: 'idle' | 'processing' | 'approved' | 'declined'
paymentError: string | null
paymentMethod: PaymentMethod
setPaymentMethod: Dispatch<SetStateAction<PaymentMethod>>
simulationOutcome: 'approved' | 'declined'
setSimulationOutcome: Dispatch<SetStateAction<'approved' | 'declined'>>
setPaymentState: Dispatch<SetStateAction<'idle' | 'processing' | 'approved' | 'declined'>>
setPaymentError: Dispatch<SetStateAction<string | null>>
submitting: boolean
onBack(): void
onPay(): Promise<void>
}

export function CheckoutPaymentStep({ paymentState, paymentError, paymentMethod, setPaymentMethod, simulationOutcome, setSimulationOutcome, setPaymentState, setPaymentError, submitting, onBack, onPay }: Props) {
 return (
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
                  onClick={() => onBack()}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm hover:bg-slate-50 transition-colors text-brand-text disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={onPay}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {paymentState === 'processing' ? 'Processando pagamento...' : 'Pagar'}
                </button>
              </div>
            </div>
          </div>
        )
}
