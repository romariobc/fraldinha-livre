'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Product } from '@contracts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { showErrorToast } from '@/lib/frontend-diagnostics'

export default function AdminProductsTab() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch('/products?scope=admin')
      .then(async (res) => {
        if (!res.ok) throw new Error('nao ok')
        setProducts((await res.json()) as Product[])
      })
      .catch(() => setError('Erro ao carregar produtos.'))
  }, [])

  const moderateProduct = async () => {
    if (!selectedProduct || reason.trim().length < 5 || submitting) return
    setSubmitting(true)
    try {
      const response = await apiFetch(`/admin/products/${selectedProduct.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !selectedProduct.active, reason: reason.trim() }),
      })
      const body = await response.json() as { product: Product }
      setProducts((current) => current?.map((product) => product.id === body.product.id ? body.product : product) ?? current)
      setSelectedProduct(null)
      setReason('')
    } catch (cause) {
      showErrorToast(cause, { operation: 'admin.products.moderate' })
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
  if (!products) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

  return (
    <div>
      <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Nome</th>
          <th className="py-2">Marca</th>
          <th className="py-2">Fornecedor</th>
          <th className="py-2">Preço</th>
          <th className="py-2">Ativo</th>
          <th className="py-2">Ações</th>
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
            <td className="py-2">
              <Button type="button" size="sm" variant={p.active ? 'destructive' : 'outline'} onClick={() => setSelectedProduct(p)}>
                {p.active ? 'Desativar' : 'Ativar'}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
      </table>
      <Dialog open={selectedProduct !== null} onOpenChange={(open) => { if (!open) { setSelectedProduct(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProduct?.active ? 'Desativar produto' : 'Ativar produto'}</DialogTitle>
            <DialogDescription>Informe uma justificativa para registrar esta ação administrativa.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Justificativa (mínimo de 5 caracteres)" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setSelectedProduct(null); setReason('') }}>Cancelar</Button>
            <Button type="button" disabled={reason.trim().length < 5 || submitting} onClick={() => void moderateProduct()}>
              {submitting ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
