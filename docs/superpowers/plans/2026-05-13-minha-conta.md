# Área do Cliente (/minha-conta) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/minha-conta` com 4 abas (Pedidos, Ofertas, Histórico, Perfil), modal de novo pedido de cotação e dados mock completos.

**Architecture:** Single-page Client Component com `useState` para a aba ativa e a lista de pedidos. Estado global de `Order[]` vive em `page.tsx` e desce via props. Sem Context, sem chamadas de rede.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v3 (tokens customizados), shadcn/base-ui (Tabs, Dialog, Select, Avatar, Separator), Sonner (toast).

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/account-mock.ts` | Criar | Tipos TypeScript + dados mock de usuário e pedidos |
| `src/components/minha-conta/OrderCard.tsx` | Criar | Card reutilizável de pedido (Pedidos e Histórico) |
| `src/components/minha-conta/PedidosTab.tsx` | Criar | Lista de pedidos ativos + botão novo pedido |
| `src/components/minha-conta/NovoPedidoModal.tsx` | Criar | Modal com formulário de cotação + endereço |
| `src/components/minha-conta/OfertasTab.tsx` | Criar | Ofertas agrupadas por pedido + aceitar |
| `src/components/minha-conta/HistoricoTab.tsx` | Criar | Pedidos concluídos/cancelados |
| `src/components/minha-conta/PerfilTab.tsx` | Criar | Dados do usuário (read-only) |
| `src/app/(main)/minha-conta/page.tsx` | Criar | Controller: tab state + orders state + handlers |
| `src/components/Header.tsx` | Modificar | Adicionar link "Minha Conta" no NAV_LINKS |

---

## Tokens Tailwind disponíveis (referência rápida)

```
primary          → #5BBFEA     primary-dark  → #2A9FD4     primary-light → #E8F6FD
accent           → #F5A623     accent-dark   → #D4891A
brand-text       → #1A2E3B     brand-muted   → #5A7385     brand-bg      → #F0F8FD
rounded-card     → 16px        shadow-card   → 0 4px 20px rgba(91,191,234,0.12)
font-display     → Nunito      container-fl  → (classe utilitária de largura máxima)
```

---

## Task 1: account-mock.ts — tipos e dados mock

**Files:**
- Create: `src/lib/account-mock.ts`

- [ ] **Step 1: Criar o arquivo com tipos e dados**

```typescript
// src/lib/account-mock.ts

export type OrderType = 'cotacao' | 'compra-direta'

export type OrderStatus =
  | 'aguardando'
  | 'ofertas-recebidas'
  | 'aceito'
  | 'confirmado'
  | 'a-caminho'
  | 'entregue'
  | 'cancelado'

export interface Address {
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export interface MockUser {
  name: string
  email: string
  cpf: string
  address: Address
}

export interface Offer {
  id: string
  supplier: string
  price: number       // em centavos
  deliveryDays: number
  rating: number      // 1–5
}

export interface Order {
  id: string
  type: OrderType
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  deliveryAddress: Address
  status: OrderStatus
  createdAt: string   // ISO 8601
  price?: number      // em centavos — compra-direta ou oferta aceita
  offers?: Offer[]    // presente apenas em cotacao
}

const SP_ADDRESS: Address = {
  logradouro: 'Av. Paulista',
  numero: '1374',
  complemento: 'Apto 52',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01310-100',
}

export const MOCK_USER: MockUser = {
  name: 'Ana Lima',
  email: 'ana.lima@email.com',
  cpf: '123.456.789-00',
  address: SP_ADDRESS,
}

export const INITIAL_ORDERS: Order[] = [
  // Pedido ativo — cotação com 2 ofertas recebidas
  {
    id: 'ord-001',
    type: 'cotacao',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'ofertas-recebidas',
    createdAt: '2026-05-12T10:00:00Z',
    offers: [
      { id: 'off-001', supplier: 'Distribuidora Sul', price: 8700, deliveryDays: 2, rating: 4 },
      { id: 'off-002', supplier: 'Baby Stock SP',     price: 9200, deliveryDays: 1, rating: 5 },
    ],
  },
  // Pedido ativo — cotação aguardando fornecedores
  {
    id: 'ord-002',
    type: 'cotacao',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'aguardando',
    createdAt: '2026-05-13T08:30:00Z',
    offers: [],
  },
  // Pedido ativo — compra direta confirmada
  {
    id: 'ord-003',
    type: 'compra-direta',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    deliveryAddress: SP_ADDRESS,
    status: 'confirmado',
    createdAt: '2026-05-11T15:00:00Z',
    price: 13400,
  },
  // Histórico — entregue
  {
    id: 'ord-004',
    type: 'compra-direta',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'entregue',
    createdAt: '2026-04-20T09:00:00Z',
    price: 10500,
  },
  // Histórico — cancelado
  {
    id: 'ord-005',
    type: 'cotacao',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'cancelado',
    createdAt: '2026-04-10T11:00:00Z',
    offers: [],
  },
]
```

- [ ] **Step 2: Verificar compilação TypeScript**

```bash
cd C:/Users/romar/Documents/dev/financeiro/fraldinha-livre
npx tsc --noEmit
```

Expected: sem erros. Se houver algum erro de módulo, é problema de path — revisar o alias `@/lib/account-mock`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/account-mock.ts
git commit -m "feat(minha-conta): add account-mock types and initial orders data"
```

---

## Task 2: OrderCard.tsx — card reutilizável de pedido

**Files:**
- Create: `src/components/minha-conta/OrderCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/minha-conta/OrderCard.tsx
import { Package2, MapPin } from 'lucide-react'
import { Order, OrderStatus } from '@/lib/account-mock'

interface OrderCardProps {
  order: Order
  mode: 'pedidos' | 'historico'
  onVerOfertas?: (orderId: string) => void
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  aguardando:          { label: 'Aguardando ofertas', className: 'bg-slate-100 text-slate-600' },
  'ofertas-recebidas': { label: 'Ofertas recebidas',  className: 'bg-accent/10 text-accent-dark' },
  aceito:              { label: 'Oferta aceita',       className: 'bg-primary-light text-primary-dark' },
  confirmado:          { label: 'Confirmado',          className: 'bg-primary-light text-primary-dark' },
  'a-caminho':         { label: 'A caminho',           className: 'bg-purple-100 text-purple-700' },
  entregue:            { label: 'Entregue',            className: 'bg-green-100 text-green-700' },
  cancelado:           { label: 'Cancelado',           className: 'bg-red-100 text-red-600' },
}

function formatAddress(addr: Order['deliveryAddress']): string {
  return `${addr.logradouro}, ${addr.numero} — ${addr.cidade}/${addr.estado}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export default function OrderCard({ order, mode, onVerOfertas }: OrderCardProps) {
  const statusCfg = STATUS_CONFIG[order.status]
  const offerCount = order.offers?.length ?? 0

  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
      {/* Linha superior: ícone + produto + badge de tipo */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <Package2 size={16} className="text-primary-dark" />
          </div>
          <div>
            <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
              {order.product}
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              {order.quantity} {order.unit}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
            order.type === 'cotacao'
              ? 'bg-primary-light text-primary-dark'
              : 'bg-accent/10 text-accent-dark'
          }`}
        >
          {order.type === 'cotacao' ? 'Cotação' : 'Compra direta'}
        </span>
      </div>

      {/* Endereço resumido */}
      <div className="flex items-center gap-1.5 text-xs text-brand-muted">
        <MapPin size={12} className="flex-shrink-0" />
        <span>{formatAddress(order.deliveryAddress)}</span>
      </div>

      {/* Rodapé: status + ações */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusCfg.className}`}>
          {statusCfg.label}
        </span>

        <div className="flex items-center gap-2">
          {/* Histórico: data e valor */}
          {mode === 'historico' && (
            <>
              {order.price != null && (
                <span className="text-sm font-black text-brand-text">
                  {formatPrice(order.price)}
                </span>
              )}
              <span className="text-xs text-brand-muted">{formatDate(order.createdAt)}</span>
            </>
          )}
          {/* Pedidos: botão ver ofertas para cotações com resposta */}
          {mode === 'pedidos' &&
            order.status === 'ofertas-recebidas' &&
            offerCount > 0 && (
              <button
                onClick={() => onVerOfertas?.(order.id)}
                className="text-[11px] font-bold bg-accent text-white px-3 py-1 rounded-full hover:bg-accent-dark transition-colors"
              >
                {offerCount} {offerCount === 1 ? 'oferta' : 'ofertas'} →
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/OrderCard.tsx
git commit -m "feat(minha-conta): add OrderCard reusable component"
```

---

## Task 3: PedidosTab.tsx — lista de pedidos ativos

**Files:**
- Create: `src/components/minha-conta/PedidosTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/minha-conta/PedidosTab.tsx
import { ShoppingCart } from 'lucide-react'
import { Order } from '@/lib/account-mock'
import OrderCard from './OrderCard'

interface PedidosTabProps {
  orders: Order[]
  onNovoPedido: () => void
  onVerOfertas: (orderId: string) => void
}

export default function PedidosTab({ orders, onNovoPedido, onVerOfertas }: PedidosTabProps) {
  const active = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  )

  return (
    <div className="flex flex-col gap-4">
      {/* CTA novo pedido */}
      <button
        onClick={onNovoPedido}
        className="w-full flex items-center justify-center gap-2 bg-accent text-white font-display font-bold text-sm py-3 rounded-xl hover:bg-accent-dark transition-colors shadow-sm"
      >
        ＋ Novo Pedido de Cotação
      </button>

      {/* Lista ou empty state */}
      {active.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido ativo</p>
          <p className="text-xs mt-1">Clique em "Novo Pedido" para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode="pedidos"
              onVerOfertas={onVerOfertas}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/PedidosTab.tsx
git commit -m "feat(minha-conta): add PedidosTab component"
```

---

## Task 4: NovoPedidoModal.tsx — modal de cotação com seleção de endereço

**Files:**
- Create: `src/components/minha-conta/NovoPedidoModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
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
import { Address, MockUser, Order } from '@/lib/account-mock'

interface NovoPedidoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: MockUser
  onSubmit: (order: Omit<Order, 'id' | 'createdAt'>) => void
}

// Mock de preenchimento automático por CEP (sem API real)
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
  user,
  onSubmit,
}: NovoPedidoModalProps) {
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
      deliveryAddress: useOther ? (other as Address) : user.address,
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
                  {user.address.logradouro}, {user.address.numero} — {user.address.bairro}
                </p>
                <p className="text-[10px] text-brand-muted">
                  {user.address.cidade}/{user.address.estado} · {user.address.cep}
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
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/NovoPedidoModal.tsx
git commit -m "feat(minha-conta): add NovoPedidoModal with address selector"
```

---

## Task 5: OfertasTab.tsx — ofertas agrupadas por pedido

**Files:**
- Create: `src/components/minha-conta/OfertasTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/minha-conta/OfertasTab.tsx
import { Tag } from 'lucide-react'
import { Order, Offer } from '@/lib/account-mock'

interface OfertasTabProps {
  orders: Order[]
  onAceitarOferta: (orderId: string, offer: Offer) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs text-accent" aria-label={`${rating} de 5 estrelas`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export default function OfertasTab({ orders, onAceitarOferta }: OfertasTabProps) {
  const withOffers = orders.filter((o) => o.status === 'ofertas-recebidas')

  if (withOffers.length === 0) {
    return (
      <div className="text-center py-12 text-brand-muted">
        <Tag size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-sm">Nenhuma oferta pendente</p>
        <p className="text-xs mt-1">
          Quando fornecedores responderem, as ofertas aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {withOffers.map((order) => (
        <div key={order.id} className="flex flex-col gap-3">
          {/* Cabeçalho do grupo */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold text-brand-muted px-2 whitespace-nowrap">
              {order.product} · {order.quantity} {order.unit}
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Cards de oferta — primeiro card (melhor preço) tem borda azul */}
          {order.offers?.map((offer, i) => (
            <div
              key={offer.id}
              className={`bg-white rounded-card shadow-card p-4 flex items-center justify-between gap-3 ${
                i === 0 ? 'border-2 border-primary' : 'border border-slate-100'
              }`}
            >
              <div className="flex flex-col gap-1">
                {i === 0 && (
                  <span className="text-[9px] font-bold text-primary-dark uppercase tracking-wider">
                    Melhor preço
                  </span>
                )}
                <p className="font-display font-extrabold text-sm text-brand-text">
                  {offer.supplier}
                </p>
                <StarRating rating={offer.rating} />
                <p className="text-xs text-brand-muted">
                  {offer.deliveryDays} dia{offer.deliveryDays !== 1 ? 's' : ''} de entrega
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="font-black text-lg text-primary-dark">
                  {formatPrice(offer.price)}
                </p>
                <button
                  onClick={() => onAceitarOferta(order.id, offer)}
                  className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                    i === 0
                      ? 'bg-accent text-white hover:bg-accent-dark'
                      : 'bg-slate-100 text-brand-muted hover:bg-primary-light hover:text-primary-dark'
                  }`}
                >
                  ✓ Aceitar
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/OfertasTab.tsx
git commit -m "feat(minha-conta): add OfertasTab with offer cards and accept handler"
```

---

## Task 6: HistoricoTab.tsx — pedidos concluídos e cancelados

**Files:**
- Create: `src/components/minha-conta/HistoricoTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
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
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/HistoricoTab.tsx
git commit -m "feat(minha-conta): add HistoricoTab component"
```

---

## Task 7: PerfilTab.tsx — dados do usuário (read-only)

**Files:**
- Create: `src/components/minha-conta/PerfilTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/minha-conta/PerfilTab.tsx
'use client'

import { Mail, MapPin, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MockUser } from '@/lib/account-mock'

interface PerfilTabProps {
  user: MockUser
}

function maskCpf(cpf: string): string {
  // Mantém apenas os 5 últimos caracteres visíveis: "789-00"
  return cpf.replace(/^\d{3}\.\d{3}\.(\d{3}-\d{2})$/, (_, last) => `***.***.${last}`)
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-primary-dark" />
      </div>
      <div>
        <p className="text-xs text-brand-muted font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-brand-text">{value}</p>
      </div>
    </div>
  )
}

export default function PerfilTab({ user }: PerfilTabProps) {
  const fullAddress = [
    `${user.address.logradouro}, ${user.address.numero}${user.address.complemento ? ` — ${user.address.complemento}` : ''}`,
    `${user.address.bairro}, ${user.address.cidade} — ${user.address.estado}`,
    user.address.cep,
  ].join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-card shadow-card p-6">
        {/* Avatar + nome */}
        <div className="flex items-center gap-4 mb-5">
          <Avatar
            size="lg"
            className="w-14 h-14"
          >
            <AvatarFallback className="bg-primary text-white font-display font-black text-xl">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display font-black text-lg text-brand-text">{user.name}</p>
            <p className="text-xs text-brand-muted">Membro desde jan/2026</p>
          </div>
        </div>

        <Separator />
        <InfoRow icon={Mail}       label="E-mail"               value={user.email} />
        <Separator />
        <InfoRow icon={CreditCard} label="CPF"                  value={maskCpf(user.cpf)} />
        <Separator />
        <InfoRow icon={MapPin}     label="Endereço de cadastro" value={fullAddress} />
      </div>

      <button
        onClick={() => toast.info('Edição de perfil em breve.')}
        className="w-full py-3 rounded-xl border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
      >
        Editar perfil
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/minha-conta/PerfilTab.tsx
git commit -m "feat(minha-conta): add PerfilTab with masked CPF and full address"
```

---

## Task 8: page.tsx — controller da /minha-conta

**Files:**
- Create: `src/app/(main)/minha-conta/page.tsx`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
mkdir -p src/app/(main)/minha-conta
```

- [ ] **Step 2: Criar a página**

```tsx
// src/app/(main)/minha-conta/page.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MOCK_USER, INITIAL_ORDERS, Order, Offer } from '@/lib/account-mock'
import PedidosTab from '@/components/minha-conta/PedidosTab'
import OfertasTab from '@/components/minha-conta/OfertasTab'
import HistoricoTab from '@/components/minha-conta/HistoricoTab'
import PerfilTab from '@/components/minha-conta/PerfilTab'
import NovoPedidoModal from '@/components/minha-conta/NovoPedidoModal'

type TabKey = 'pedidos' | 'ofertas' | 'historico' | 'perfil'

export default function MinhaContaPage() {
  const [activeTab, setActiveTab]   = useState<TabKey>('pedidos')
  const [orders, setOrders]         = useState<Order[]>(INITIAL_ORDERS)
  const [modalOpen, setModalOpen]   = useState(false)

  // Número total de ofertas pendentes para o badge
  const pendingOffersCount = orders
    .filter((o) => o.status === 'ofertas-recebidas')
    .reduce((sum, o) => sum + (o.offers?.length ?? 0), 0)

  function handleNovoPedido(partial: Omit<Order, 'id' | 'createdAt'>) {
    const newOrder: Order = {
      ...partial,
      id: `ord-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setOrders((prev) => [newOrder, ...prev])
    toast.success('Pedido criado! Fornecedores serão notificados em breve.')
    setActiveTab('pedidos')
  }

  function handleAceitarOferta(orderId: string, offer: Offer) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'aceito' as const, price: offer.price } : o
      )
    )
    toast.success(`Oferta da ${offer.supplier} aceita! Seu pedido está confirmado.`)
    setActiveTab('pedidos')
  }

  function handleVerOfertas(_orderId: string) {
    setActiveTab('ofertas')
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-6">
        <div className="container-fl">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
            Área do cliente
          </p>
          <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
            Olá, {MOCK_USER.name.split(' ')[0]} 👋
          </h1>
        </div>
      </section>

      {/* Conteúdo com tabs */}
      <section className="bg-brand-bg min-h-[60vh] py-6">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
          >
            {/* Barra de tabs */}
            <TabsList
              variant="line"
              className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent mb-6"
            >
              <TabsTrigger
                value="pedidos"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                📦 Pedidos
              </TabsTrigger>

              <TabsTrigger
                value="ofertas"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                🏷️ Ofertas
                {pendingOffersCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                    {pendingOffersCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="historico"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                📋 Histórico
              </TabsTrigger>

              <TabsTrigger
                value="perfil"
                className="rounded-none px-4 py-2.5 text-sm font-semibold flex-none"
              >
                👤 Perfil
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pedidos">
              <PedidosTab
                orders={orders}
                onNovoPedido={() => setModalOpen(true)}
                onVerOfertas={handleVerOfertas}
              />
            </TabsContent>

            <TabsContent value="ofertas">
              <OfertasTab orders={orders} onAceitarOferta={handleAceitarOferta} />
            </TabsContent>

            <TabsContent value="historico">
              <HistoricoTab orders={orders} />
            </TabsContent>

            <TabsContent value="perfil">
              <PerfilTab user={MOCK_USER} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Modal fora das tabs para não herdar seu contexto */}
      <NovoPedidoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={MOCK_USER}
        onSubmit={handleNovoPedido}
      />
    </>
  )
}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Verificar visualmente no dev server**

```bash
npm run dev
```

Abrir `http://localhost:3000/minha-conta` e verificar:
- [ ] Hero aparece com "Olá, Ana 👋"
- [ ] 4 abas visíveis, "Pedidos" ativa por padrão
- [ ] Badge "2" visível na aba Ofertas
- [ ] 3 cards na aba Pedidos (Pampers Supersec, Huggies, Turma da Mônica)
- [ ] Botão "2 ofertas →" no card do Pampers
- [ ] Clicar "2 ofertas →" navega para aba Ofertas
- [ ] Aba Ofertas mostra 2 cards com botão "Aceitar"
- [ ] Aceitar oferta → toast + pedido some das Ofertas + status muda em Pedidos
- [ ] Aba Histórico mostra 2 pedidos (MamyPoko entregue, Cremer cancelado)
- [ ] Aba Perfil mostra avatar "A", CPF mascarado, endereço completo
- [ ] Botão "Novo Pedido" abre modal
- [ ] Modal: preencher produto + quantidade → botão habilitado
- [ ] Modal: toggle "Usar outro endereço" expande formulário
- [ ] Digitar CEP "01310100" → cidade/UF preenchido automaticamente com "São Paulo/SP"
- [ ] Submeter modal → novo pedido aparece no topo da lista + toast

- [ ] **Step 5: Commit**

```bash
git add src/app/(main)/minha-conta/page.tsx
git commit -m "feat(minha-conta): add page controller with tab state and order mutations"
```

---

## Task 9: Header.tsx — adicionar link "Minha Conta"

**Files:**
- Modify: `src/components/Header.tsx` (linha 9–17, array `NAV_LINKS`)

- [ ] **Step 1: Adicionar o link ao NAV_LINKS**

Localizar o array `NAV_LINKS` em `src/components/Header.tsx` e adicionar `{ href: '/minha-conta', label: 'Minha Conta' }` **antes** do link de Contato:

```typescript
const NAV_LINKS = [
  { href: '/',             label: 'Início' },
  { href: '/catalogo',     label: 'Catálogo' },
  { href: '/#sobre',       label: 'Sobre Nós' },
  { href: '/#produtos',    label: 'Produtos' },
  { href: '/#depoimentos', label: 'Depoimentos' },
  { href: '/#faq',         label: 'FAQ' },
  { href: '/minha-conta',  label: 'Minha Conta' },
  { href: '/contato',      label: 'Contato' },
]
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Verificar no browser**

Com `npm run dev` ainda rodando:
- [ ] Header desktop mostra "Minha Conta" entre os links
- [ ] Menu mobile mostra "Minha Conta" na lista
- [ ] Clicar leva para `/minha-conta`

- [ ] **Step 4: Commit final**

```bash
git add src/components/Header.tsx
git commit -m "feat(minha-conta): add Minha Conta link to header navigation"
```

---

## Self-Review — Cobertura do spec

| Requisito do spec | Task que implementa |
|---|---|
| Tabs horizontais: Pedidos, Ofertas, Histórico, Perfil | Task 8 — page.tsx |
| Badge contador de ofertas na aba Ofertas | Task 8 — `pendingOffersCount` |
| Lista de pedidos ativos com badge de tipo e status | Tasks 2 + 3 |
| Botão "Novo Pedido de Cotação" → modal | Tasks 3 + 4 |
| Modal: produto, quantidade, unidade, endereço | Task 4 |
| Endereço padrão = cadastro, toggle para outro | Task 4 |
| CEP com preenchimento automático (mock) | Task 4 — `MOCK_CEP_LOOKUP` |
| Botão "X ofertas →" no card → navega para Ofertas | Tasks 2 + 3 + 8 |
| Aba Ofertas agrupada por pedido, melhor preço em destaque | Task 5 |
| Aceitar oferta → muda status + toast + vai para Pedidos | Tasks 5 + 8 |
| Aba Histórico com data, valor, status | Tasks 2 + 6 |
| Aba Perfil com CPF mascarado, endereço completo, avatar | Task 7 |
| "Editar perfil" → toast "em breve" | Task 7 |
| Dois tipos de pedido: Cotação / Compra direta (badge) | Task 2 |
| Dados mock: 2 cotações ativas, 1 compra direta, 2 histórico | Task 1 |
| Link "Minha Conta" no Header | Task 9 |
