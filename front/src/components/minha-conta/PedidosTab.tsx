// src/components/minha-conta/PedidosTab.tsx
import { ShoppingCart } from 'lucide-react'
import { Order } from '@/lib/account-mock'
import OrderCard from './OrderCard'

interface PedidosTabProps {
  orders: Order[]
  onNovoPedido: () => void
  onVerOfertas: (orderId: string) => void
}

export default function PedidosTab({ orders, onNovoPedido, onVerOfertas }: PedidosTabProps) {
  const active = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  )

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onNovoPedido}
        className="w-full lg:w-auto lg:self-end flex items-center justify-center gap-2 bg-accent text-white font-display font-bold text-sm py-3 px-6 rounded-xl hover:bg-accent-dark transition-colors shadow-sm"
      >
        ＋ Novo Pedido de Cotação
      </button>

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
              onVerOfertas={onVerOfertas}
            />
          ))}
        </div>
      )}
    </div>
  )
}
