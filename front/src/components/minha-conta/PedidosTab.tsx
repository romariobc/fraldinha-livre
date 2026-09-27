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
        <div className="text-center py-12 px-4 text-brand-muted">
          <ShoppingCart size={36} className="mx-auto mb-3 opacity-30 text-primary-dark" />
          <p className="font-display font-extrabold text-base text-brand-text">Nenhum pedido ativo</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            Explore o nosso catálogo e garanta as fraldas para o seu bebê com os melhores preços.
          </p>
          <div className="mt-5">
            <Link
              href="/catalogo"
              className="inline-block py-2.5 px-6 rounded-full font-display font-bold text-sm transition-colors bg-primary-dark text-white hover:bg-primary"
            >
              Explorar catálogo
            </Link>
          </div>
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
