// src/components/fornecedor/DirectOrderCard.tsx
import { Package2, MapPin } from 'lucide-react'
import { DirectOrder, DirectOrderStatus, timeAgo } from '@/lib/supplier-mock'
import { formatPrice } from '@/lib/utils'

interface DirectOrderCardProps {
  order: DirectOrder
  onConfirmar: (orderId: string) => void
  onRecusar: (orderId: string) => void
}

const STATUS_CONFIG: Record<DirectOrderStatus, { label: string; className: string }> = {
  aguardando: { label: 'Aguardando',  className: 'bg-amber-100 text-amber-800' },
  confirmado: { label: 'Confirmado',  className: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',   className: 'bg-red-100 text-red-600' },
}

export default function DirectOrderCard({
  order,
  onConfirmar,
  onRecusar,
}: DirectOrderCardProps) {
  const cfg = STATUS_CONFIG[order.status]

  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3 border border-slate-100">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Package2 size={16} className="text-accent-dark" />
          </div>
          <div>
            <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
              {order.product}
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              {order.quantity} {order.unit} · {formatPrice(order.price)}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.className}`}>
          {cfg.label}
        </span>
      </div>

      {/* Localização + tempo */}
      <div className="flex items-center justify-between text-xs text-brand-muted">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="flex-shrink-0" />
          {order.buyerCity}, {order.buyerState}
        </span>
        <span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
      </div>

      {/* Badge tipo */}
      <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent-dark">
        COMPRA DIRETA
      </span>

      {/* Ações — só quando aguardando */}
      {order.status === 'aguardando' && (
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Confirmar este pedido direto"
            onClick={() => onConfirmar(order.id)}
            className="flex-1 bg-green-600 text-white font-display font-bold text-xs py-2 rounded-xl hover:bg-green-700 transition-colors"
          >
            ✓ Confirmar pedido
          </button>
          <button
            type="button"
            aria-label="Recusar este pedido direto"
            onClick={() => onRecusar(order.id)}
            className="flex-none w-24 bg-slate-100 text-brand-muted font-bold text-xs py-2 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Recusar
          </button>
        </div>
      )}
    </div>
  )
}
