import Link from 'next/link'
import type { Order } from '@/lib/domain/account'
import type { PaymentMethod } from '@/lib/ports/payment'

interface Props {
createdOrders: Order[]
completedPayment: { transactionId: string; method: PaymentMethod } | null
}

export function CheckoutConfirmationStep({ createdOrders, completedPayment }: Props) {
 return (
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
        )
}
