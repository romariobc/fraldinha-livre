// src/components/minha-conta/PedidosTab.tsx
import { ShoppingCart } from 'lucide-react'
import { Order } from '@/lib/account-mock'
import { LEILAO_ATIVO } from '@/lib/feature-flags'
import OrderCard from './OrderCard'

interface PedidosTabProps {
  orders: Order[]
  onNovoPedido: () => void
}

export default function PedidosTab({ orders, onNovoPedido }: PedidosTabProps) {
  const active = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full lg:w-auto lg:self-end">
        <button
          onClick={onNovoPedido}
          disabled={!LEILAO_ATIVO}
          aria-disabled={!LEILAO_ATIVO}
          className={`w-full lg:w-auto flex items-center justify-center gap-2 font-display font-bold text-sm py-3 px-6 rounded-xl transition-colors shadow-sm ${
            LEILAO_ATIVO
              ? 'bg-accent text-white hover:bg-accent-dark'
              : 'bg-accent text-white opacity-50 cursor-not-allowed'
          }`}
        >
          ＋ Novo Pedido de Cotação
        </button>
        {!LEILAO_ATIVO && (
          <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-brand-muted text-white px-1.5 py-0.5 rounded-full">
            Em breve
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido ativo</p>
          <p className="text-xs mt-1">Clique em &quot;Novo Pedido&quot; para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode="pedidos"
            />
          ))}
        </div>
      )}
    </div>
  )
}
