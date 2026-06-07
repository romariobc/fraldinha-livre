import { Package2, MapPin } from 'lucide-react'
import { Order, OrderStatus } from '@/lib/account-mock'

interface OrderCardProps {
  order: Order
  mode: 'pedidos' | 'historico'
  onVerOfertas?: (orderId: string) => void
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  aguardando:          { label: 'Aguardando ofertas', className: 'bg-slate-100 text-slate-600' },
  'ofertas-recebidas': { label: 'Ofertas recebidas',  className: 'bg-accent/10 text-accent-dark' },
  aceito:              { label: 'Oferta aceita',       className: 'bg-primary-light text-primary-dark' },
  confirmado:          { label: 'Confirmado',          className: 'bg-primary-light text-primary-dark' },
  'a-caminho':         { label: 'A caminho',           className: 'bg-purple-100 text-purple-700' },
  entregue:            { label: 'Entregue',            className: 'bg-green-100 text-green-700' },
  cancelado:           { label: 'Cancelado',           className: 'bg-red-100 text-red-600' },
}

function formatAddress(addr: Order['deliveryAddress']): string {
  return `${addr.logradouro}, ${addr.numero} — ${addr.cidade}/${addr.estado}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export default function OrderCard({ order, mode, onVerOfertas }: OrderCardProps) {
  const statusCfg = STATUS_CONFIG[order.status]
  const offerCount = order.offers?.length ?? 0

  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
      {/* Linha superior: ícone + produto + badge de tipo */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <Package2 size={16} className="text-primary-dark" />
          </div>
          <div>
            <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
              {order.product}
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              {order.quantity} {order.unit}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
            order.type === 'cotacao'
              ? 'bg-primary-light text-primary-dark'
              : 'bg-accent/10 text-accent-dark'
          }`}
        >
          {order.type === 'cotacao' ? 'Cotação' : 'Compra direta'}
        </span>
      </div>

      {/* Endereço resumido */}
      <div className="flex items-center gap-1.5 text-xs text-brand-muted">
        <MapPin size={12} className="flex-shrink-0" />
        <span>{formatAddress(order.deliveryAddress)}</span>
      </div>

      {/* Rodapé: status + ações */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusCfg.className}`}>
          {statusCfg.label}
        </span>

        <div className="flex items-center gap-2">
          {/* Histórico: data e valor */}
          {mode === 'historico' && (
            <>
              {order.price != null && (
                <span className="text-sm font-black text-brand-text">
                  {formatPrice(order.price)}
                </span>
              )}
              <span className="text-xs text-brand-muted">{formatDate(order.createdAt)}</span>
            </>
          )}
          {/* Pedidos: botão ver ofertas para cotações com resposta */}
          {mode === 'pedidos' &&
            order.status === 'ofertas-recebidas' &&
            offerCount > 0 && (
              <button
                onClick={() => onVerOfertas?.(order.id)}
                className="text-[11px] font-bold bg-accent text-white px-3 py-1 rounded-full hover:bg-accent-dark transition-colors"
              >
                {offerCount} {offerCount === 1 ? 'oferta' : 'ofertas'} →
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
