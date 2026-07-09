// src/components/minha-conta/PedidosTab.tsx
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { Order } from '@/lib/account-mock'
import OrderCard from './OrderCard'

interface PedidosTabProps {
  orders: Order[]
}

export default function PedidosTab({ orders }: PedidosTabProps) {
  const active = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  )

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido ativo</p>
          <p className="text-xs mt-1">
            Explore o{' '}
            <Link href="/catalogo" className="font-bold text-primary-dark hover:underline">
              catálogo
            </Link>{' '}
            para fazer seu primeiro pedido.
          </p>
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
