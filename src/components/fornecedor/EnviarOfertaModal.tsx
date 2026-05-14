// src/components/fornecedor/EnviarOfertaModal.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MarketOrder } from '@/lib/supplier-mock'

interface EnviarOfertaModalProps {
  order: MarketOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (orderId: string, price: number, deliveryDays: number, note?: string) => void
}

const DELIVERY_OPTIONS = [
  { value: '1', label: '1 dia útil' },
  { value: '2', label: '2 dias úteis' },
  { value: '3', label: '3 dias úteis' },
  { value: '5', label: '5 dias úteis' },
  { value: '7', label: '7 dias úteis' },
  { value: '0', label: 'A combinar' },
]

export default function EnviarOfertaModal({
  order,
  open,
  onOpenChange,
  onSubmit,
}: EnviarOfertaModalProps) {
  const [priceStr, setPriceStr] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [note, setNote] = useState('')

  const priceCents = Math.round(
    parseFloat(priceStr.replace(',', '.')) * 100
  )
  const priceValid = !isNaN(priceCents) && priceCents > 0
  const perUnit =
    priceValid && order && order.quantity > 0
      ? `≈ R$ ${((priceCents / order.quantity) / 100).toFixed(2).replace('.', ',')} por ${order.unit}`
      : ''

  const canSubmit = priceValid && deliveryDays !== ''

  function handleSubmit() {
    if (!order || !canSubmit) return
    onSubmit(order.id, priceCents, parseInt(deliveryDays), note.trim() || undefined)
    setPriceStr('')
    setDeliveryDays('')
    setNote('')
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setPriceStr('')
      setDeliveryDays('')
      setNote('')
    }
    onOpenChange(v)
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-brand-text">
            Enviar oferta
          </DialogTitle>
          <p className="text-sm text-brand-muted mt-1">
            {order.product} · {order.quantity} {order.unit} · {order.buyerCity}/{order.buyerState}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Preço */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price" className="text-xs font-bold text-brand-muted uppercase tracking-wide">
              Preço total (R$)
            </Label>
            <Input
              id="price"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              className="text-base font-bold"
            />
            {perUnit && (
              <p className="text-xs text-brand-muted">{perUnit}</p>
            )}
          </div>

          {/* Prazo */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
              Prazo de entrega
            </Label>
            <Select value={deliveryDays} onValueChange={(v) => setDeliveryDays(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o prazo" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note" className="text-xs font-bold text-brand-muted uppercase tracking-wide">
              Observação (opcional)
            </Label>
            <textarea
              id="note"
              rows={3}
              placeholder="Ex: inclui frete para SP capital…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-accent text-white font-display font-bold hover:bg-accent-dark disabled:opacity-40"
          >
            Enviar oferta →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
