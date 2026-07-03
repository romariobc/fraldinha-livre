// src/components/minha-conta/NovoPedidoModal.tsx
'use client'

import { useState } from 'react'
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react'
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
import { Address, MOCK_USER, Order } from '@/lib/account-mock'
import { useAuth } from '@/contexts/auth-context'

interface NovoPedidoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (order: Omit<Order, 'id' | 'createdAt'>) => void
}

const MOCK_CEP_LOOKUP: Record<
  string,
  Pick<Address, 'logradouro' | 'bairro' | 'cidade' | 'estado'>
> = {
  '01310-100': { logradouro: 'Av. Paulista',    bairro: 'Bela Vista', cidade: 'São Paulo',      estado: 'SP' },
  '20040-020': { logradouro: 'Av. Rio Branco',  bairro: 'Centro',     cidade: 'Rio de Janeiro', estado: 'RJ' },
  '30130-110': { logradouro: 'Av. Afonso Pena', bairro: 'Centro',     cidade: 'Belo Horizonte', estado: 'MG' },
}

function normalizeCep(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : raw
}

export default function NovoPedidoModal({
  open,
  onOpenChange,
  onSubmit,
}: NovoPedidoModalProps) {
  const { profile } = useAuth()
  // Usar profile.address se disponível, senão MOCK_USER.address
  const defaultAddress = profile?.address || MOCK_USER.address
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<'un' | 'cx' | 'kg'>('un')
  const [useOther, setUseOther] = useState(false)
  const [other, setOther] = useState<Partial<Address>>({})

  function handleCepChange(raw: string) {
    const cep = normalizeCep(raw)
    const lookup = MOCK_CEP_LOOKUP[cep]
    setOther((prev) => ({
      ...prev,
      cep,
      ...(lookup ?? {}),
    }))
  }

  function reset() {
    setProduct('')
    setQuantity('')
    setUnit('un')
    setUseOther(false)
    setOther({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      type: 'cotacao',
      product: product.trim(),
      quantity: Number(quantity),
      unit,
      deliveryAddress: useOther ? (other as Address) : defaultAddress,
      status: 'aguardando',
      offers: [],
    })
    reset()
    onOpenChange(false)
  }

  const canSubmit = product.trim().length > 0 && Number(quantity) >= 1

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-brand-text text-base">
            📦 Novo Pedido de Cotação
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          {/* Produto */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-produto" className="text-sm font-semibold text-brand-text">
              Produto
            </Label>
            <Input
              id="np-produto"
              placeholder="Ex: Pampers Supersec M"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              required
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
            />
          </div>

          {/* Quantidade + Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-qtd" className="text-sm font-semibold text-brand-text">
                Quantidade
              </Label>
              <Input
                id="np-qtd"
                type="number"
                min={1}
                placeholder="32"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold text-brand-text">Unidade</Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as 'un' | 'cx' | 'kg')}
              >
                <SelectTrigger className="border-2 border-slate-200 rounded-xl bg-slate-50 h-10 w-full text-brand-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidades (un)</SelectItem>
                  <SelectItem value="cx">Caixas (cx)</SelectItem>
                  <SelectItem value="kg">Quilos (kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Endereço de entrega */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-semibold text-brand-text">Endereço de entrega</Label>

            {/* Opção: endereço do cadastro */}
            <button
              type="button"
              onClick={() => setUseOther(false)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                !useOther
                  ? 'border-primary bg-primary-light'
                  : 'border-slate-200 bg-slate-50 hover:border-primary/50'
              }`}
            >
              <MapPin size={14} className="text-primary-dark flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-text truncate">
                  {defaultAddress.logradouro}, {defaultAddress.numero} — {defaultAddress.bairro}
                </p>
                <p className="text-[10px] text-brand-muted">
                  {defaultAddress.cidade}/{defaultAddress.estado} · {defaultAddress.cep}
                </p>
              </div>
              {!useOther && (
                <span className="text-[10px] font-bold text-primary-dark bg-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                  ✓ Usando
                </span>
              )}
            </button>

            {/* Toggle outro endereço */}
            <button
              type="button"
              onClick={() => setUseOther((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-muted hover:text-primary-dark transition-colors"
            >
              {useOther ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Usar outro endereço
            </button>

            {/* Formulário de outro endereço (expansível) */}
            {useOther && (
              <div className="flex flex-col gap-2 p-3 border-2 border-primary rounded-xl bg-primary-light/30">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-brand-text">Logradouro</Label>
                    <Input
                      placeholder="Rua/Av."
                      value={other.logradouro ?? ''}
                      onChange={(e) => setOther((p) => ({ ...p, logradouro: e.target.value }))}
                      required={useOther}
                      className="border border-slate-200 rounded-lg bg-white text-xs h-8 text-brand-text placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-brand-text">Número</Label>
                    <Input
                      placeholder="Nº"
                      value={other.numero ?? ''}
                      onChange={(e) => setOther((p) => ({ ...p, numero: e.target.value }))}
                      required={useOther}
                      className="border border-slate-200 rounded-lg bg-white text-xs h-8 text-brand-text placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-brand-text">CEP</Label>
                    <Input
                      placeholder="00000-000"
                      value={other.cep ?? ''}
                      onChange={(e) => handleCepChange(e.target.value)}
                      required={useOther}
                      className="border border-slate-200 rounded-lg bg-white text-xs h-8 text-brand-text placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-brand-text">Cidade/UF</Label>
                    <Input
                      readOnly
                      placeholder="Auto"
                      value={
                        other.cidade && other.estado
                          ? `${other.cidade}/${other.estado}`
                          : ''
                      }
                      className="border border-slate-200 rounded-lg bg-slate-100 text-xs h-8 text-brand-muted"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold text-brand-text">
                    Complemento <span className="font-normal text-brand-muted">(opcional)</span>
                  </Label>
                  <Input
                    placeholder="Apto, bloco..."
                    value={other.complemento ?? ''}
                    onChange={(e) => setOther((p) => ({ ...p, complemento: e.target.value }))}
                    className="border border-slate-200 rounded-lg bg-white text-xs h-8 text-brand-text placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="-mx-4 -mb-4 mt-1">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-none rounded-b-xl py-3 bg-accent hover:bg-accent-dark font-display font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buscar fornecedores →
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
