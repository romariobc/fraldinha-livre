'use client'

import { useState } from 'react'
import { CreateProductRequestSchema, type Product } from '@contracts'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange(open: boolean): void
  repo: ProductRepository
  onSuccess(product: Product): void
}
const fields = [
  { name: 'name', label: 'Nome do produto', max: 200 },
  { name: 'brand', label: 'Marca', max: 100 },
  { name: 'size', label: 'Tamanho', max: 40 },
  { name: 'slug', label: 'Identificador na URL', max: 200 },
  { name: 'categoria', label: 'Categoria', max: 100 },
] as const

// Standalone creation also works when the public catalog has no available offers.
export function CreateOfferDialog({ open, onOpenChange, repo, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '')
    const parsed = CreateProductRequestSchema.safeParse({
      ...Object.fromEntries(fields.map(field => [field.name, value(field.name)])),
      descricao: value('descricao'), priceCents: Math.round(Number(value('price')) * 100),
      quantity: Number(value('stock')), atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' },
    })
    if (!parsed.success || !value('price').trim() || !value('stock').trim()) {
      setError('Confira os campos: preço positivo em reais e estoque inteiro maior ou igual a zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSuccess(await repo.create(parsed.data))
      onOpenChange(false)
    } catch {
      setError('Não foi possível cadastrar a oferta. Confira sua habilitação e tente novamente.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) { setError(null); onOpenChange(value) } }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar nova oferta</DialogTitle>
          <DialogDescription>Crie seu produto, preço e estoque para compras simuladas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {fields.map(field => (
            <div key={field.name} className="space-y-1">
              <Label htmlFor={'new-offer-' + field.name}>{field.label}</Label>
              <Input id={'new-offer-' + field.name} name={field.name} maxLength={field.max} required disabled={saving} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-offer-price">Preço (R$)</Label>
              <Input id="new-offer-price" name="price" type="number" min="0.01" step="0.01" required disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-offer-stock">Estoque inicial</Label>
              <Input id="new-offer-stock" name="stock" type="number" min="0" step="1" required disabled={saving} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-offer-description">Descrição</Label>
            <Input id="new-offer-description" name="descricao" disabled={saving} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Cadastrando...' : 'Cadastrar oferta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
