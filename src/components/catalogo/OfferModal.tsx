// src/components/catalogo/OfferModal.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Product } from '@/lib/products'

interface OfferModalProps {
  product: Product | null
  onClose: () => void
}

const SIZE_OPTIONS = ['P', 'M', 'G', 'GG'] as const
type ModalSize = (typeof SIZE_OPTIONS)[number]

export default function OfferModal({ product, onClose }: OfferModalProps) {
  const [quantity, setQuantity] = useState('1')
  const initialSize: ModalSize =
    product?.size && (SIZE_OPTIONS as readonly string[]).includes(product.size)
      ? (product.size as ModalSize)
      : 'M'
  const [size, setSize] = useState<ModalSize>(initialSize)
  const [cep, setCep] = useState('')
  const [notes, setNotes] = useState('')

  if (!product) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onClose()
    toast.success('Pedido enviado! Aguarde as ofertas dos fornecedores.', {
      description: `${product!.brand} ${product!.name} — Tam. ${size} · ${quantity} pct(s)`,
      duration: 5000,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Image
              src="/assets/img/Logo_simples_sem_fundo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-auto"
            />
            <span className="font-display font-extrabold text-base text-brand-text">
              Pedir oferta
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-brand-muted transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Produto selecionado */}
          <div className="flex items-center gap-2.5 bg-primary-light rounded-xl px-4 py-2.5">
            <span className="text-xl" aria-hidden="true">🧷</span>
            <div>
              <p className="font-display font-extrabold text-sm text-primary-dark leading-none">
                {product.name}
              </p>
              <p className="text-[11px] text-brand-muted mt-0.5">{product.brand}</p>
            </div>
          </div>

          {/* Tamanho */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-semibold text-brand-text">Tamanho preferido</Label>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`w-12 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                    size === s
                      ? 'border-primary bg-primary text-white'
                      : 'border-slate-200 text-brand-muted hover:border-primary hover:text-primary-dark'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantidade */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qty" className="text-sm font-semibold text-brand-text">
              Quantidade (pacotes)
            </Label>
            <Input
              id="qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text"
            />
          </div>

          {/* CEP */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cep" className="text-sm font-semibold text-brand-text">
              CEP de entrega
            </Label>
            <Input
              id="cep"
              type="text"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
            />
          </div>

          {/* Observações */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className="text-sm font-semibold text-brand-text">
              Observações <span className="font-normal text-brand-muted">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Ex: prefiro entrega pela manhã, aceito similar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400 resize-none"
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl py-6 bg-accent hover:bg-accent-dark font-display font-bold text-base text-white transition-colors mt-1"
          >
            ✨ Enviar pedido de oferta
          </Button>
        </form>
      </div>
    </div>
  )
}
