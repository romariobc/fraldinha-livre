// src/components/minha-conta/HistoricoTab.tsx
import { History } from 'lucide-react'
import { Order } from '@/lib/account-mock'
import OrderCard from './OrderCard'

interface HistoricoTabProps {
  orders: Order[]
}

export default function HistoricoTab({ orders }: HistoricoTabProps) {
  const done = orders
    .filter((o) => o.status === 'entregue' || o.status === 'cancelado')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (done.length === 0) {
    return (
      <div className="text-center py-12 text-brand-muted">
        <History size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-sm">Nenhum pedido no histórico</p>
        <p className="text-xs mt-1">Pedidos concluídos e cancelados aparecerão aqui.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {done.map((order) => (
        <OrderCard key={order.id} order={order} mode="historico" />
      ))}
    </div>
  )
}
