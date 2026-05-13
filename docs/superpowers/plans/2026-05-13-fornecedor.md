# Painel do Fornecedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a área privada do fornecedor em `/fornecedor` com 5 tabs: Pedidos Diretos, Mercado, Minhas Ofertas, Histórico e Perfil — usando dados mock, seguindo os padrões de `/minha-conta`.

**Architecture:** Controller em `page.tsx` com `useState`, componentes de tab isolados em `src/components/fornecedor/`, tipos e dados mock em `src/lib/supplier-mock.ts`. O Tabs usa o componente `@/components/ui/tabs` existente com `className="flex-col"` (fix do base-ui). Sem backend — tudo mock local.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS v3 com tokens do projeto, Sonner (toasts), Lucide icons, Dialog/Select/Input/Button/Tabs de `@/components/ui/`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/supplier-mock.ts` | Criar | Tipos TS + dados mock + helpers |
| `src/components/fornecedor/MarketOrderCard.tsx` | Criar | Card de cotação no Mercado |
| `src/components/fornecedor/DirectOrderCard.tsx` | Criar | Card de pedido direto |
| `src/components/fornecedor/OfertaCard.tsx` | Criar | Card de oferta enviada |
| `src/components/fornecedor/EnviarOfertaModal.tsx` | Criar | Modal enviar oferta |
| `src/components/fornecedor/MercadoTab.tsx` | Criar | Tab Mercado completa |
| `src/components/fornecedor/PedidosDiretosTab.tsx` | Criar | Tab Pedidos Diretos |
| `src/components/fornecedor/MinhasOfertasTab.tsx` | Criar | Tab Minhas Ofertas |
| `src/components/fornecedor/HistoricoTab.tsx` | Criar | Tab Histórico (cotações + diretos) |
| `src/components/fornecedor/PerfilTab.tsx` | Criar | Tab Perfil da empresa |
| `src/app/(main)/fornecedor/page.tsx` | Criar | Controller principal |

---

## Task 1: Tipos e dados mock (`supplier-mock.ts`)

**Files:**
- Create: `src/lib/supplier-mock.ts`

- [ ] **Step 1: Criar o arquivo com todos os tipos e helpers**

```typescript
// src/lib/supplier-mock.ts

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MockSupplier {
  name: string        // razão social
  cnpj: string        // ex: '12.456.789/0001-00'
  email: string
  phone: string
  brands: string[]    // marcas que trabalha
  states: string[]    // UFs cobertas
  cities?: string[]   // cidades opcionais
  ceps?: string[]     // CEPs específicos
  rating: number      // 1–5
  memberSince: string // ex: 'mar/2025'
}

export type MarketOrderStatus = 'aberto' | 'ofertado' | 'encerrado'

export interface MarketOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  buyerCity: string
  buyerState: string
  createdAt: string       // ISO 8601
  totalOffers: number     // total de ofertas recebidas (de todos os fornecedores)
  offeredByMe: boolean    // este fornecedor já enviou oferta?
  myOffer?: {
    price: number         // centavos
    deliveryDays: number
    note?: string
  }
  status: MarketOrderStatus
}

export type DirectOrderStatus = 'aguardando' | 'confirmado' | 'cancelado'

export interface DirectOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  price: number           // centavos — preço fixo do catálogo
  buyerCity: string
  buyerState: string
  createdAt: string
  status: DirectOrderStatus
}

export type OfferStatus = 'enviada' | 'aceita' | 'recusada' | 'expirada'

export interface SupplierOffer {
  id: string
  orderId: string
  product: string         // snapshot
  quantity: number
  unit: string
  buyerCity: string
  buyerState: string
  price: number           // centavos — total ofertado
  deliveryDays: number
  note?: string
  status: OfferStatus
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

export function maskCnpj(cnpj: string): string {
  // '12.456.789/0001-00' → '***.456.789/0001-**'
  return cnpj.replace(/^(\d{2})\.(\d{3}\.\d{3}\/\d{4})-(\d{2})$/, (_, _a, mid, _c) => `***.${mid}-**`)
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_SUPPLIER: MockSupplier = {
  name: 'Distribuidora Sul Ltda.',
  cnpj: '12.456.789/0001-00',
  email: 'contato@distribuidorasul.com.br',
  phone: '(11) 98765-4321',
  brands: ['Pampers', 'Huggies', 'Cremer'],
  states: ['SP', 'RJ'],
  cities: ['São Paulo', 'Campinas', 'Rio de Janeiro'],
  ceps: ['01310-100', '04538-133', '05422-000'],
  rating: 4,
  memberSince: 'mar/2025',
}

export const MOCK_MARKET_ORDERS: MarketOrder[] = [
  {
    id: 'mkt-001',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    totalOffers: 3,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-002',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: true,
    myOffer: { price: 24500, deliveryDays: 2 },
    status: 'ofertado',
  },
  {
    id: 'mkt-003',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-004',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerCity: 'Niterói',
    buyerState: 'RJ',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    totalOffers: 2,
    offeredByMe: true,
    myOffer: { price: 18900, deliveryDays: 3, note: 'Inclui frete' },
    status: 'ofertado',
  },
  {
    id: 'mkt-005',
    product: 'Babysec Premium M',
    quantity: 60,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    totalOffers: 5,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-006',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerCity: 'Santos',
    buyerState: 'SP',
    createdAt: '2026-04-30T10:00:00Z',
    totalOffers: 4,
    offeredByMe: true,
    myOffer: { price: 31200, deliveryDays: 2 },
    status: 'encerrado',
  },
]

export const MOCK_DIRECT_ORDERS: DirectOrder[] = [
  {
    id: 'dir-001',
    product: 'Pampers Supersec G',
    quantity: 48,
    unit: 'un',
    price: 31200,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    status: 'aguardando',
  },
  {
    id: 'dir-002',
    product: 'Huggies Mega Suave M',
    quantity: 1,
    unit: 'cx',
    price: 8990,
    buyerCity: 'Guarulhos',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'aguardando',
  },
  {
    id: 'dir-003',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    price: 10500,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    status: 'confirmado',
  },
  {
    id: 'dir-004',
    product: 'Cremer PP',
    quantity: 3,
    unit: 'cx',
    price: 22800,
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: '2026-04-28T09:00:00Z',
    status: 'cancelado',
  },
]

export const MOCK_OFFERS: SupplierOffer[] = [
  {
    id: 'sof-001',
    orderId: 'mkt-006',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerCity: 'Santos',
    buyerState: 'SP',
    price: 31200,
    deliveryDays: 2,
    status: 'aceita',
    createdAt: '2026-04-30T11:00:00Z',
  },
  {
    id: 'sof-002',
    orderId: 'mkt-002',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerCity: 'Campinas',
    buyerState: 'SP',
    price: 24500,
    deliveryDays: 2,
    status: 'enviada',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'sof-003',
    orderId: 'mkt-004',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerCity: 'Niterói',
    buyerState: 'RJ',
    price: 18900,
    deliveryDays: 3,
    note: 'Inclui frete',
    status: 'enviada',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
  {
    id: 'sof-004',
    orderId: 'mkt-099',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 15600,
    deliveryDays: 1,
    status: 'recusada',
    createdAt: '2026-05-10T14:00:00Z',
  },
  {
    id: 'sof-005',
    orderId: 'mkt-098',
    product: 'Turma da Mônica M',
    quantity: 50,
    unit: 'un',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    price: 42500,
    deliveryDays: 3,
    status: 'expirada',
    createdAt: '2026-05-05T10:00:00Z',
  },
]
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supplier-mock.ts
git commit -m "feat(fornecedor): add supplier mock types and data"
```

---

## Task 2: Card de cotação no Mercado (`MarketOrderCard`)

**Files:**
- Create: `src/components/fornecedor/MarketOrderCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/MarketOrderCard.tsx
import { Package2, MapPin } from 'lucide-react'
import { MarketOrder, formatPrice, timeAgo } from '@/lib/supplier-mock'

interface MarketOrderCardProps {
  order: MarketOrder
  onEnviarOferta: (order: MarketOrder) => void
  onDecline: (orderId: string) => void
}

export default function MarketOrderCard({
  order,
  onEnviarOferta,
  onDecline,
}: MarketOrderCardProps) {
  return (
    <div
      className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-3 ${
        order.offeredByMe ? 'bg-primary-light border-2 border-primary/30' : 'border border-slate-100'
      }`}
    >
      {/* Cabeçalho */}
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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-light text-primary-dark flex-shrink-0">
          COTAÇÃO
        </span>
      </div>

      {/* Localização + tempo */}
      <div className="flex items-center justify-between text-xs text-brand-muted">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="flex-shrink-0" />
          {order.buyerCity}, {order.buyerState}
        </span>
        <span>{timeAgo(order.createdAt)}</span>
      </div>

      {/* Contagem de ofertas */}
      <p className="text-xs text-brand-muted">
        {order.totalOffers === 0
          ? 'Nenhuma oferta enviada ainda'
          : `${order.totalOffers} oferta${order.totalOffers !== 1 ? 's' : ''} recebida${order.totalOffers !== 1 ? 's' : ''}`}
      </p>

      {/* Ações */}
      {order.offeredByMe ? (
        <div className="bg-white rounded-xl px-3 py-2 text-xs text-brand-muted border border-primary/20">
          <span className="font-bold text-primary-dark">✓ Oferta enviada</span>
          {' '}—{' '}
          {formatPrice(order.myOffer!.price)} · {order.myOffer!.deliveryDays} dia{order.myOffer!.deliveryDays !== 1 ? 's' : ''}
          <br />
          <span className="text-[11px]">Aguardando decisão do comprador…</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onEnviarOferta(order)}
            className="flex-1 bg-accent text-white font-display font-bold text-xs py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            ✏️ Enviar oferta
          </button>
          <button
            onClick={() => onDecline(order.id)}
            className="flex-none w-28 bg-slate-100 text-brand-muted font-bold text-xs py-2 rounded-xl hover:bg-slate-200 transition-colors"
          >
            ✕ Não concorro
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/MarketOrderCard.tsx
git commit -m "feat(fornecedor): add MarketOrderCard component"
```

---

## Task 3: Card de pedido direto (`DirectOrderCard`)

**Files:**
- Create: `src/components/fornecedor/DirectOrderCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/DirectOrderCard.tsx
import { Package2, MapPin } from 'lucide-react'
import { DirectOrder, DirectOrderStatus, formatPrice, timeAgo } from '@/lib/supplier-mock'

interface DirectOrderCardProps {
  order: DirectOrder
  onConfirmar: (orderId: string) => void
  onRecusar: (orderId: string) => void
}

const STATUS_CONFIG: Record<DirectOrderStatus, { label: string; className: string }> = {
  aguardando: { label: 'Aguardando',  className: 'bg-amber-100 text-amber-800' },
  confirmado: { label: 'Confirmado',  className: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',   className: 'bg-red-100 text-red-600' },
}

export default function DirectOrderCard({
  order,
  onConfirmar,
  onRecusar,
}: DirectOrderCardProps) {
  const cfg = STATUS_CONFIG[order.status]

  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3 border border-slate-100">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Package2 size={16} className="text-accent-dark" />
          </div>
          <div>
            <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
              {order.product}
            </p>
            <p className="text-xs text-brand-muted mt-0.5">
              {order.quantity} {order.unit} · {formatPrice(order.price)}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.className}`}>
          {cfg.label}
        </span>
      </div>

      {/* Localização + tempo */}
      <div className="flex items-center justify-between text-xs text-brand-muted">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="flex-shrink-0" />
          {order.buyerCity}, {order.buyerState}
        </span>
        <span>{timeAgo(order.createdAt)}</span>
      </div>

      {/* Badge tipo */}
      <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent-dark">
        COMPRA DIRETA
      </span>

      {/* Ações — só quando aguardando */}
      {order.status === 'aguardando' && (
        <div className="flex gap-2">
          <button
            onClick={() => onConfirmar(order.id)}
            className="flex-1 bg-green-600 text-white font-display font-bold text-xs py-2 rounded-xl hover:bg-green-700 transition-colors"
          >
            ✓ Confirmar pedido
          </button>
          <button
            onClick={() => onRecusar(order.id)}
            className="flex-none w-24 bg-slate-100 text-brand-muted font-bold text-xs py-2 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Recusar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/DirectOrderCard.tsx
git commit -m "feat(fornecedor): add DirectOrderCard component"
```

---

## Task 4: Card de oferta enviada (`OfertaCard`)

**Files:**
- Create: `src/components/fornecedor/OfertaCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/OfertaCard.tsx
import { MapPin } from 'lucide-react'
import { SupplierOffer, OfferStatus, formatPrice, formatDate } from '@/lib/supplier-mock'

interface OfertaCardProps {
  offer: SupplierOffer
}

const STATUS_CONFIG: Record<OfferStatus, { label: string; badgeClass: string; msgClass: string; message?: string }> = {
  enviada:  {
    label: '⏳ Pendente',
    badgeClass: 'bg-amber-100 text-amber-800',
    msgClass: 'text-brand-muted',
    message: undefined,
  },
  aceita:   {
    label: '✓ Aceita',
    badgeClass: 'bg-green-100 text-green-700',
    msgClass: 'text-green-700 bg-green-50 rounded-lg px-3 py-2',
    message: 'Comprador aceitou sua oferta — pedido confirmado!',
  },
  recusada: {
    label: '✕ Recusada',
    badgeClass: 'bg-red-100 text-red-600',
    msgClass: 'text-brand-muted',
    message: 'Comprador escolheu outra oferta.',
  },
  expirada: {
    label: 'Expirada',
    badgeClass: 'bg-slate-100 text-slate-500',
    msgClass: 'text-brand-muted',
    message: 'O pedido foi encerrado sem aceite.',
  },
}

export default function OfertaCard({ offer }: OfertaCardProps) {
  const cfg = STATUS_CONFIG[offer.status]
  const faded = offer.status === 'recusada' || offer.status === 'expirada'

  return (
    <div
      className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-3 border border-slate-100 ${
        faded ? 'opacity-70' : ''
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
            {offer.product}
          </p>
          <p className="text-xs text-brand-muted mt-0.5">
            {offer.quantity} {offer.unit}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* Localização */}
      <div className="flex items-center gap-1 text-xs text-brand-muted">
        <MapPin size={11} className="flex-shrink-0" />
        {offer.buyerCity}, {offer.buyerState}
      </div>

      {/* Valor e prazo */}
      <div className="flex items-center justify-between">
        <span className="font-black text-base text-primary-dark">
          {formatPrice(offer.price)}
        </span>
        <span className="text-xs text-brand-muted">
          {offer.deliveryDays} dia{offer.deliveryDays !== 1 ? 's' : ''} úteis · {formatDate(offer.createdAt)}
        </span>
      </div>

      {/* Mensagem contextual */}
      {cfg.message && (
        <p className={`text-xs ${cfg.msgClass}`}>{cfg.message}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/OfertaCard.tsx
git commit -m "feat(fornecedor): add OfertaCard component"
```

---

## Task 5: Modal de enviar oferta (`EnviarOfertaModal`)

**Files:**
- Create: `src/components/fornecedor/EnviarOfertaModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
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

  // Preço em reais (string) → centavos (number)
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
    // Reset
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
            <Select value={deliveryDays} onValueChange={setDeliveryDays}>
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

          {/* Observação opcional */}
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
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/EnviarOfertaModal.tsx
git commit -m "feat(fornecedor): add EnviarOfertaModal component"
```

---

## Task 6: Tab Mercado (`MercadoTab`)

**Files:**
- Create: `src/components/fornecedor/MercadoTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/MercadoTab.tsx
import { useState } from 'react'
import { Tag } from 'lucide-react'
import { MarketOrder } from '@/lib/supplier-mock'
import MarketOrderCard from './MarketOrderCard'

type Filter = 'todos' | 'ofertei'

interface MercadoTabProps {
  orders: MarketOrder[]
  declinedIds: Set<string>
  onEnviarOferta: (order: MarketOrder) => void
  onDecline: (orderId: string) => void
}

export default function MercadoTab({
  orders,
  declinedIds,
  onEnviarOferta,
  onDecline,
}: MercadoTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  const visible = orders
    .filter((o) => o.status !== 'encerrado')
    .filter((o) => !declinedIds.has(o.id))
    .filter((o) => filter === 'todos' || o.offeredByMe)

  const oferteiCount = orders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id) && o.offeredByMe
  ).length

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2">
        {(['todos', 'ofertei'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {f === 'todos' ? `Todos (${orders.filter(o => o.status !== 'encerrado' && !declinedIds.has(o.id)).length})` : `Já ofertei (${oferteiCount})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhuma cotação aberta no momento</p>
          <p className="text-xs mt-1">Novos pedidos aparecerão aqui assim que forem criados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((order) => (
            <MarketOrderCard
              key={order.id}
              order={order}
              onEnviarOferta={onEnviarOferta}
              onDecline={onDecline}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/MercadoTab.tsx
git commit -m "feat(fornecedor): add MercadoTab component"
```

---

## Task 7: Tab Pedidos Diretos (`PedidosDiretosTab`)

**Files:**
- Create: `src/components/fornecedor/PedidosDiretosTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/PedidosDiretosTab.tsx
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { DirectOrder, DirectOrderStatus } from '@/lib/supplier-mock'
import DirectOrderCard from './DirectOrderCard'

type Filter = 'todos' | 'aguardando' | 'confirmados'

interface PedidosDiretosTabProps {
  orders: DirectOrder[]
  onConfirmar: (orderId: string) => void
  onRecusar: (orderId: string) => void
}

export default function PedidosDiretosTab({
  orders,
  onConfirmar,
  onRecusar,
}: PedidosDiretosTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  const active = orders.filter((o) => o.status !== 'cancelado')

  const filtered = active.filter((o) => {
    if (filter === 'aguardando') return o.status === 'aguardando'
    if (filter === 'confirmados') return o.status === 'confirmado'
    return true
  })

  const counts = {
    todos: active.length,
    aguardando: active.filter((o) => o.status === 'aguardando').length,
    confirmados: active.filter((o) => o.status === 'confirmado').length,
  }

  const filterLabels: Record<Filter, string> = {
    todos:       `Todos (${counts.todos})`,
    aguardando:  `Aguardando (${counts.aguardando})`,
    confirmados: `Confirmados (${counts.confirmados})`,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'aguardando', 'confirmados'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-accent text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-accent/40'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido direto no momento</p>
          <p className="text-xs mt-1">Pedidos do catálogo vinculados à sua loja aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((order) => (
            <DirectOrderCard
              key={order.id}
              order={order}
              onConfirmar={onConfirmar}
              onRecusar={onRecusar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/PedidosDiretosTab.tsx
git commit -m "feat(fornecedor): add PedidosDiretosTab component"
```

---

## Task 8: Tab Minhas Ofertas (`MinhasOfertasTab`)

**Files:**
- Create: `src/components/fornecedor/MinhasOfertasTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/fornecedor/MinhasOfertasTab.tsx
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { SupplierOffer, OfferStatus } from '@/lib/supplier-mock'
import OfertaCard from './OfertaCard'

type Filter = 'todas' | 'pendentes' | 'aceitas' | 'recusadas'

interface MinhasOfertasTabProps {
  offers: SupplierOffer[]
}

export default function MinhasOfertasTab({ offers }: MinhasOfertasTabProps) {
  const [filter, setFilter] = useState<Filter>('todas')

  const filtered = offers.filter((o) => {
    if (filter === 'pendentes') return o.status === 'enviada'
    if (filter === 'aceitas')   return o.status === 'aceita'
    if (filter === 'recusadas') return o.status === 'recusada' || o.status === 'expirada'
    return true
  })

  const counts = {
    todas:     offers.length,
    pendentes: offers.filter((o) => o.status === 'enviada').length,
    aceitas:   offers.filter((o) => o.status === 'aceita').length,
    recusadas: offers.filter((o) => o.status === 'recusada' || o.status === 'expirada').length,
  }

  const filterLabels: Record<Filter, string> = {
    todas:     `Todas (${counts.todas})`,
    pendentes: `Pendentes (${counts.pendentes})`,
    aceitas:   `Aceitas (${counts.aceitas})`,
    recusadas: `Recusadas (${counts.recusadas})`,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todas', 'pendentes', 'aceitas', 'recusadas'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Você ainda não enviou ofertas</p>
          <p className="text-xs mt-1">Acesse a aba Mercado para responder cotações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((offer) => (
            <OfertaCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/MinhasOfertasTab.tsx
git commit -m "feat(fornecedor): add MinhasOfertasTab component"
```

---

## Task 9: Tab Histórico e Tab Perfil

**Files:**
- Create: `src/components/fornecedor/HistoricoTab.tsx`
- Create: `src/components/fornecedor/PerfilTab.tsx`

- [ ] **Step 1: Criar HistoricoTab**

```tsx
// src/components/fornecedor/HistoricoTab.tsx
import { useState } from 'react'
import { History, MapPin } from 'lucide-react'
import {
  DirectOrder,
  SupplierOffer,
  formatPrice,
  formatDate,
} from '@/lib/supplier-mock'

// Entrada normalizada para exibição unificada no histórico
interface HistoricoEntry {
  id: string
  source: 'cotacao' | 'compra-direta'
  product: string
  quantity: number
  unit: string
  city: string
  state: string
  price?: number
  date: string
  finalStatus: 'concluido' | 'cancelado'
}

type Filter = 'todos' | 'concluidos' | 'cancelados'

interface HistoricoTabProps {
  directOrders: DirectOrder[]
  offers: SupplierOffer[]
}

export default function HistoricoTab({ directOrders, offers }: HistoricoTabProps) {
  const [filter, setFilter] = useState<Filter>('todos')

  // Normaliza DirectOrders finalizadas
  const fromDirect: HistoricoEntry[] = directOrders
    .filter((o) => o.status === 'confirmado' || o.status === 'cancelado')
    .map((o) => ({
      id: o.id,
      source: 'compra-direta',
      product: o.product,
      quantity: o.quantity,
      unit: o.unit,
      city: o.buyerCity,
      state: o.buyerState,
      price: o.price,
      date: o.createdAt,
      finalStatus: o.status === 'confirmado' ? 'concluido' : 'cancelado',
    }))

  // Normaliza SupplierOffers finalizadas
  const fromOffers: HistoricoEntry[] = offers
    .filter((o) => o.status === 'aceita' || o.status === 'recusada' || o.status === 'expirada')
    .map((o) => ({
      id: o.id,
      source: 'cotacao',
      product: o.product,
      quantity: o.quantity,
      unit: o.unit,
      city: o.buyerCity,
      state: o.buyerState,
      price: o.status === 'aceita' ? o.price : undefined,
      date: o.createdAt,
      finalStatus: o.status === 'aceita' ? 'concluido' : 'cancelado',
    }))

  const all = [...fromDirect, ...fromOffers].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const filtered = all.filter((e) => {
    if (filter === 'concluidos') return e.finalStatus === 'concluido'
    if (filter === 'cancelados') return e.finalStatus === 'cancelado'
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'concluidos', 'cancelados'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'concluidos' ? 'Concluídos' : 'Cancelados'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">Nenhum pedido no histórico ainda</p>
          <p className="text-xs mt-1">Pedidos concluídos e cancelados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white rounded-card shadow-card p-4 flex flex-col gap-2 border border-slate-100 ${
                entry.finalStatus === 'cancelado' ? 'opacity-70' : ''
              }`}
            >
              {/* Badges */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    entry.source === 'cotacao'
                      ? 'bg-primary-light text-primary-dark'
                      : 'bg-accent/10 text-accent-dark'
                  }`}
                >
                  {entry.source === 'cotacao' ? 'COTAÇÃO' : 'COMPRA DIRETA'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    entry.finalStatus === 'concluido'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {entry.finalStatus === 'concluido' ? 'Concluído' : 'Cancelado'}
                </span>
              </div>

              {/* Produto */}
              <p className="font-display font-extrabold text-sm text-brand-text">
                {entry.product}
              </p>
              <p className="text-xs text-brand-muted">
                {entry.quantity} {entry.unit}
              </p>

              {/* Rodapé */}
              <div className="flex items-center justify-between text-xs text-brand-muted mt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {entry.city}, {entry.state}
                </span>
                <div className="flex items-center gap-2">
                  {entry.price != null && (
                    <span className="font-black text-brand-text">{formatPrice(entry.price)}</span>
                  )}
                  <span>{formatDate(entry.date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar PerfilTab**

```tsx
// src/components/fornecedor/PerfilTab.tsx
import { Mail, Phone, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { MockSupplier, maskCnpj } from '@/lib/supplier-mock'

interface PerfilTabProps {
  supplier: MockSupplier
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
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

export default function PerfilTab({ supplier }: PerfilTabProps) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="bg-white rounded-card shadow-card p-6 flex flex-col gap-1">

        {/* Dados da empresa */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
          Dados da empresa
        </p>
        <InfoRow icon={Building2} label="Razão social" value={supplier.name} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Building2} label="CNPJ" value={maskCnpj(supplier.cnpj)} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Mail}      label="E-mail"       value={supplier.email} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Phone}     label="Telefone"     value={supplier.phone} />

        {/* Marcas */}
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            Marcas que trabalho
          </p>
          <div className="flex flex-wrap gap-2">
            {supplier.brands.map((b) => (
              <span
                key={b}
                className="bg-primary-light text-primary-dark text-xs font-bold px-3 py-1 rounded-full"
              >
                {b}
              </span>
            ))}
            <button
              onClick={() => toast.info('Gerenciamento de marcas em breve.')}
              className="border border-dashed border-slate-300 text-slate-400 text-xs font-bold px-3 py-1 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
            >
              + adicionar
            </button>
          </div>
        </div>

        {/* Cobertura */}
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            Área de cobertura
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {supplier.states.map((s) => (
              <span
                key={s}
                className="bg-primary-light text-primary-dark text-xs font-bold px-3 py-1 rounded-full"
              >
                {s}
              </span>
            ))}
            <button
              onClick={() => toast.info('Gerenciamento de estados em breve.')}
              className="border border-dashed border-slate-300 text-slate-400 text-xs font-bold px-3 py-1 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
            >
              + estado
            </button>
          </div>
          {supplier.ceps && supplier.ceps.length > 0 && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-brand-muted">
              <span className="font-bold text-brand-text">CEPs específicos: </span>
              {supplier.ceps.join(', ')}
              <button
                onClick={() => toast.info('Gerenciamento de CEPs em breve.')}
                className="ml-2 text-primary hover:underline"
              >
                + CEP
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => toast.info('Edição de perfil em breve.')}
        className="w-full py-3 rounded-xl border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
      >
        ✏️ Editar perfil
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/fornecedor/HistoricoTab.tsx src/components/fornecedor/PerfilTab.tsx
git commit -m "feat(fornecedor): add HistoricoTab and PerfilTab components"
```

---

## Task 10: Controller principal (`page.tsx`)

**Files:**
- Create: `src/app/(main)/fornecedor/page.tsx`

- [ ] **Step 1: Criar a página controller**

```tsx
// src/app/(main)/fornecedor/page.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  MOCK_SUPPLIER,
  MOCK_MARKET_ORDERS,
  MOCK_DIRECT_ORDERS,
  MOCK_OFFERS,
  MarketOrder,
  DirectOrder,
  SupplierOffer,
} from '@/lib/supplier-mock'
import MercadoTab        from '@/components/fornecedor/MercadoTab'
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import MinhasOfertasTab  from '@/components/fornecedor/MinhasOfertasTab'
import HistoricoTab      from '@/components/fornecedor/HistoricoTab'
import PerfilTab         from '@/components/fornecedor/PerfilTab'
import EnviarOfertaModal from '@/components/fornecedor/EnviarOfertaModal'

type TabKey = 'pedidos-diretos' | 'mercado' | 'minhas-ofertas' | 'historico' | 'perfil'

export default function FornecedorPage() {
  const [activeTab, setActiveTab]         = useState<TabKey>('pedidos-diretos')
  const [marketOrders, setMarketOrders]   = useState<MarketOrder[]>(MOCK_MARKET_ORDERS)
  const [directOrders, setDirectOrders]   = useState<DirectOrder[]>(MOCK_DIRECT_ORDERS)
  const [offers, setOffers]               = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds]     = useState<Set<string>>(new Set())
  const [ofertaModal, setOfertaModal]     = useState<MarketOrder | null>(null)

  // ── Métricas para o hero ─────────────────────────────────────────────────
  const pendingDirectCount = directOrders.filter((o) => o.status === 'aguardando').length
  const openMarketCount    = marketOrders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id)
  ).length
  const sentOffersCount    = offers.filter((o) => o.status === 'enviada').length

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleEnviarOferta(
    orderId: string,
    price: number,
    deliveryDays: number,
    note?: string
  ) {
    // Marca offeredByMe no MarketOrder
    setMarketOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, offeredByMe: true, myOffer: { price, deliveryDays, note }, status: 'ofertado' as const }
          : o
      )
    )
    // Cria SupplierOffer
    const order = marketOrders.find((o) => o.id === orderId)
    if (order) {
      const newOffer: SupplierOffer = {
        id: `sof-${Date.now()}`,
        orderId,
        product: order.product,
        quantity: order.quantity,
        unit: order.unit,
        buyerCity: order.buyerCity,
        buyerState: order.buyerState,
        price,
        deliveryDays,
        note,
        status: 'enviada',
        createdAt: new Date().toISOString(),
      }
      setOffers((prev) => [newOffer, ...prev])
    }
    setOfertaModal(null)
    toast.success('Oferta enviada com sucesso!')
  }

  function handleDeclineMercado(orderId: string) {
    setDeclinedIds((prev) => new Set([...prev, orderId]))
    toast.info('Pedido removido da sua fila.')
  }

  function handleConfirmarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: 'confirmado' as const } : o)
    )
    toast.success('Pedido confirmado! O comprador será notificado.')
  }

  function handleRecusarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: 'cancelado' as const } : o)
    )
    toast.info('Pedido recusado.')
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Área do fornecedor
              </p>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Olá, {MOCK_SUPPLIER.name.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-brand-muted mt-1">{MOCK_SUPPLIER.email}</p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('pedidos-diretos')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-accent/20 hover:border-accent/40 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-accent leading-none">{pendingDirectCount}</span>
                <span className="text-xs text-brand-muted mt-1">Diretos</span>
              </button>
              <button
                onClick={() => setActiveTab('mercado')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-primary/10 hover:border-primary/30 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-primary-dark leading-none">{openMarketCount}</span>
                <span className="text-xs text-brand-muted mt-1">Mercado</span>
              </button>
              <button
                onClick={() => setActiveTab('minhas-ofertas')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-green-200 hover:border-green-400 transition-colors min-w-[90px]"
              >
                <span className="font-black text-2xl text-green-600 leading-none">{sentOffersCount}</span>
                <span className="text-xs text-brand-muted mt-1">Ofertas</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
            className="flex-col"
          >
            {/* Barra sticky */}
            <div className="sticky top-[64px] lg:top-[80px] z-10 bg-brand-bg pb-0">
              <TabsList
                variant="line"
                className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent overflow-x-auto"
              >
                <TabsTrigger value="pedidos-diretos" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  🛒 Pedidos Diretos
                  {pendingDirectCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                      {pendingDirectCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mercado" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  🏷️ Mercado
                </TabsTrigger>
                <TabsTrigger value="minhas-ofertas" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  💬 Minhas Ofertas
                </TabsTrigger>
                <TabsTrigger value="historico" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  📦 Histórico
                </TabsTrigger>
                <TabsTrigger value="perfil" className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap">
                  👤 Perfil
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-6">
              <TabsContent value="pedidos-diretos">
                <PedidosDiretosTab
                  orders={directOrders}
                  onConfirmar={handleConfirmarDireto}
                  onRecusar={handleRecusarDireto}
                />
              </TabsContent>
              <TabsContent value="mercado">
                <MercadoTab
                  orders={marketOrders}
                  declinedIds={declinedIds}
                  onEnviarOferta={(order) => setOfertaModal(order)}
                  onDecline={handleDeclineMercado}
                />
              </TabsContent>
              <TabsContent value="minhas-ofertas">
                <MinhasOfertasTab offers={offers} />
              </TabsContent>
              <TabsContent value="historico">
                <HistoricoTab directOrders={directOrders} offers={offers} />
              </TabsContent>
              <TabsContent value="perfil">
                <PerfilTab supplier={MOCK_SUPPLIER} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>

      {/* Modal fora das tabs */}
      <EnviarOfertaModal
        order={ofertaModal}
        open={ofertaModal !== null}
        onOpenChange={(open) => { if (!open) setOfertaModal(null) }}
        onSubmit={handleEnviarOferta}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Testar no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/fornecedor` e verificar:
- Hero exibe "Olá, Distribuidora 👋" com 3 stats clicáveis
- Tab padrão = Pedidos Diretos com 2 cards aguardando
- Confirmar pedido → status muda para "Confirmado", toast aparece
- Tab Mercado → 5 cotações (3 abertas, 2 já ofertadas)
- Botão "✕ Não concorro" → card desaparece, toast aparece
- Botão "✏️ Enviar oferta" → abre modal com produto/qtd no título
- Preencher preço (ex: `245,00`) → mostra preço por unidade
- Selecionar prazo → botão "Enviar oferta →" fica ativo
- Submit → modal fecha, card fica azul-claro com oferta, toast sucesso
- Tab Minhas Ofertas → oferta recém-enviada aparece como "Pendente"
- Tab Histórico → itens de ambas as fontes, ordenados por data
- Tab Perfil → dados, marcas e estados com chips, botão "Editar perfil" → toast
- Stats no hero atualizam ao confirmar/declinar

- [ ] **Step 4: Commit final**

```bash
git add src/app/\(main\)/fornecedor/page.tsx
git commit -m "feat(fornecedor): add supplier panel page controller"
```
