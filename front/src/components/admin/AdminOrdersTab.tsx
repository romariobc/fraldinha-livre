'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Order } from '../../../../packages/contracts/src/order'

export default function AdminOrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/orders?scope=admin')
      .then(async (res) => {
        if (!res.ok) throw new Error('nao ok')
        setOrders((await res.json()) as Order[])
      })
      .catch(() => setError('Erro ao carregar pedidos.'))
  }, [])

  if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
  if (!orders) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">ID</th>
          <th className="py-2">Comprador</th>
          <th className="py-2">Produto</th>
          <th className="py-2">Status</th>
          <th className="py-2">Total</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b">
            <td className="py-2">{o.id}</td>
            <td className="py-2">{o.uid}</td>
            <td className="py-2">{o.product}</td>
            <td className="py-2">{o.status}</td>
            <td className="py-2">{o.price != null ? `R$ ${(o.price / 100).toFixed(2)}` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
