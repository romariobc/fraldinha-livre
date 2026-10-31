import type { Address } from '@/lib/domain/account'
import { lineTotal, cartSubtotal } from '@/lib/domain/cart'
import { formatPrice } from '@/lib/utils'
import type { CartItem } from '@/lib/domain/cart'

interface Props {
bySupplier: Map<string, CartItem[]>
deliveryAddress: Address
subtotal: number
onBack(): void
onContinue(): void
}

export function CheckoutReviewStep({ bySupplier, deliveryAddress, subtotal, onBack, onContinue }: Props) {
 return (
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
                onClick={() => onBack()}
                className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm hover:bg-slate-50 transition-colors text-brand-text"
              >
                Voltar
              </button>
              <button
                onClick={() => onContinue()}
                className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )
}
