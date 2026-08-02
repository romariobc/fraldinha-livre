'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Product } from '../../../../packages/contracts/src/product'

export default function AdminProductsTab() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/products?scope=admin')
      .then(async (res) => {
        if (!res.ok) throw new Error('nao ok')
        setProducts((await res.json()) as Product[])
      })
      .catch(() => setError('Erro ao carregar produtos.'))
  }, [])

  if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
  if (!products) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Nome</th>
          <th className="py-2">Marca</th>
          <th className="py-2">Fornecedor</th>
          <th className="py-2">Preço</th>
          <th className="py-2">Ativo</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className="border-b">
            <td className="py-2">{p.name}</td>
            <td className="py-2">{p.brand}</td>
            <td className="py-2">{p.supplierId}</td>
            <td className="py-2">R$ {(p.priceCents / 100).toFixed(2)}</td>
            <td className="py-2">{p.active ? 'Sim' : 'Não'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
