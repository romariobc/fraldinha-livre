'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@contracts'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp } from 'lucide-react'

interface EditPriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  repo: ProductRepository
  onSuccess: (updatedProduct: Product) => void
}

export function EditPriceDialog({ open, onOpenChange, product, repo, onSuccess }: EditPriceDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [mode, setMode] = React.useState<'direct' | 'percentage'>('direct')
  const [inputValue, setInputValue] = React.useState('')
  const [discountPercent, setDiscountPercent] = React.useState('')

  React.useEffect(() => {
    if (open && product) {
      setMode('direct')
      setInputValue((product.priceCents / 100).toFixed(2))
      setDiscountPercent('10')
    }
  }, [open, product])

  if (!product) return null

  const basePriceCents = product.priceCents

  let previewNewPriceCents = 0
  if (mode === 'direct') {
    previewNewPriceCents = Math.round(parseFloat(inputValue.replace(',', '.')) * 100) || 0
  } else {
    const p = parseFloat(discountPercent.replace(',', '.')) || 0
    previewNewPriceCents = Math.round(basePriceCents * (1 - (p / 100)))
  }

  const isLower = previewNewPriceCents < basePriceCents && previewNewPriceCents > 0
  const isHigher = previewNewPriceCents > basePriceCents

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previewNewPriceCents <= 0) {
      toast.error('O novo preço deve ser maior que zero.')
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await repo.update(product.id, { priceCents: previewNewPriceCents })
      toast.success('Preço atualizado com sucesso!')
      onSuccess(updated)
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao editar preço', err)
      toast.error('Erro ao atualizar preço. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Preço de Venda</DialogTitle>
          <DialogDescription>
            {product.name} - Tam {product.size}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'direct' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('direct')}
            >
              Valor Fixo
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'percentage' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('percentage')}
            >
              Desconto %
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Preço Atual:</span>
              <strong className="text-foreground text-lg">{formatPrice(basePriceCents)}</strong>
            </div>

            {mode === 'direct' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Novo Preço (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-base h-10"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Desconto (%)</label>
                <div className="flex gap-3 items-center">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="99"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="10"
                    className="font-mono text-base h-10"
                  />
                  <span className="text-lg font-bold text-primary-dark whitespace-nowrap">
                    {formatPrice(previewNewPriceCents)}
                  </span>
                </div>
              </div>
            )}

            {isLower && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-500/10 p-3 rounded-lg text-xs font-medium border border-emerald-200">
                <ArrowDown className="size-4 shrink-0" />
                Desconto visual será aplicado na vitrine automaticamente.
              </div>
            )}
            
            {isHigher && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-500/10 p-3 rounded-lg text-xs font-medium border border-amber-200">
                <ArrowUp className="size-4 shrink-0" />
                O preço será aumentado. O selo de desconto será removido se existir.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || previewNewPriceCents <= 0 || previewNewPriceCents === basePriceCents}>
              {isSubmitting ? 'Salvando...' : 'Salvar Preço'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
