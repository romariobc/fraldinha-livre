# Mercado Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract marketplace logic from `/fornecedor` into two independent routes — `/mercado` (public supplier table with geo filters + inline offer form) and `/fornecedor/painel` (private hub with 3 tabs) — sharing state via React Context.

**Architecture:** `MarketContext` wraps the `(main)` layout and holds all market/offer/order state with API-ready handlers. `/mercado` renders an expandable-row table driven by `GeoScope`. `/fornecedor/painel` uses `@base-ui/react` Tabs with 3 content tabs powered by the same context. `/fornecedor/page.tsx` becomes a redirect.

**Tech Stack:** Next.js 16.2.4 App Router, React 19, TypeScript 5, Tailwind CSS 3, `@base-ui/react` Tabs (NOT Radix UI)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| EDIT | `src/lib/supplier-mock.ts` | Add `DeliveryType`, `GeoScope`, `DispatchStatus` types; enrich interfaces and mock data |
| CREATE | `src/lib/market-utils.ts` | `parsePriceToCents`, `geoMatch`, `formatDeliveryType`, `buildOfferSnapshot` |
| CREATE | `src/contexts/market-context.tsx` | `MarketProvider` + `useMarket()` hook — all shared state and handlers |
| EDIT | `src/app/(main)/layout.tsx` | Wrap children with `<MarketProvider>` |
| EDIT | `src/app/globals.css` | Add `slide-out` keyframe animation |
| CREATE | `src/components/mercado/GeoScopeSelector.tsx` | Segmented control for geographic scope; city search input |
| CREATE | `src/components/mercado/InlineOfferForm.tsx` | Inline price/delivery/note form with conditional delivery options |
| CREATE | `src/components/mercado/MarketRow.tsx` | Single expandable table row with slide-out decline animation |
| CREATE | `src/components/mercado/MarketTable.tsx` | Table with header, rows, IntersectionObserver infinite scroll, expand-radius CTA |
| CREATE | `src/app/(main)/mercado/page.tsx` | Hero counters + GeoScopeSelector + MarketTable |
| CREATE | `src/components/fornecedor/OfertasMercadoTab.tsx` | Sub-filtered list of supplier offers from context |
| CREATE | `src/components/fornecedor/LogisticaTab.tsx` | Stepper cards for accepted market offers + confirmed direct orders |
| CREATE | `src/app/(main)/fornecedor/painel/page.tsx` | Private hub: hero with 3 counters + "Ver Mercado" + 3-tab layout |
| EDIT | `src/app/(main)/fornecedor/page.tsx` | Replace with `redirect('/fornecedor/painel')` |
| REMOVE | `src/components/fornecedor/MercadoTab.tsx` | Replaced by `/mercado` page + components |
| REMOVE | `src/components/fornecedor/EnviarOfertaModal.tsx` | Replaced by `InlineOfferForm` |
| REMOVE | `src/components/fornecedor/MarketOrderCard.tsx` | Replaced by `MarketRow` |

---

## Task 1: Update `supplier-mock.ts` — new types + enriched mock data

**Files:**
- Modify: `src/lib/supplier-mock.ts`

- [ ] **Step 1: Replace the entire file with the updated version**

```typescript
// ─── New types ────────────────────────────────────────────────────────────────

export type DeliveryType =
  | { kind: 'delivery'; maxHours: 1 | 2 | 4 }
  | { kind: 'days'; count: number }
  | { kind: 'to_arrange' }

export type GeoScope =
  | { type: 'neighborhood' }
  | { type: 'radius'; km: 5 | 10 }
  | { type: 'city'; city: string; state: string }
  | { type: 'national' }

export type DispatchStatus = 'em_preparo' | 'despachado' | 'entregue'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MockSupplier {
  name: string
  cnpj: string
  email: string
  phone: string
  brands: string[]
  states: string[]
  cities?: string[]
  ceps?: string[]
  rating: number
  memberSince: string
  neighborhood: string
  zip: string
}

export type MarketOrderStatus = 'aberto' | 'ofertado' | 'encerrado'

export interface MarketOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'

  buyerName: string
  buyerCnpj: string
  buyerStreet: string
  buyerNeighborhood: string
  buyerCity: string
  buyerState: string
  buyerZip: string

  createdAt: string
  totalOffers: number
  offeredByMe: boolean
  myOffer?: {
    price: number
    deliveryType: DeliveryType
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
  price: number
  buyerCity: string
  buyerState: string
  createdAt: string
  status: DirectOrderStatus
  dispatchStatus?: DispatchStatus
}

export type OfferStatus = 'enviada' | 'aceita' | 'recusada' | 'expirada'

export interface SupplierOffer {
  id: string
  orderId: string
  product: string
  quantity: number
  unit: string
  buyerName: string
  buyerCity: string
  buyerState: string
  price: number
  deliveryType: DeliveryType
  note?: string
  status: OfferStatus
  createdAt: string
  dispatchStatus?: DispatchStatus
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
  const masked = cnpj.replace(
    /^(\d{2})\.(\d{3}\.\d{3}\/\d{4})-(\d{2})$/,
    (_, _a, mid, _c) => `***.${mid}-**`
  )
  if (masked === cnpj) {
    return cnpj.slice(0, 3).replace(/./g, '*') + cnpj.slice(3, -2) + '**'
  }
  return masked
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
  neighborhood: 'Bela Vista',
  zip: '01310-100',
}

export const MOCK_MARKET_ORDERS: MarketOrder[] = [
  // ── Same neighborhood (Bela Vista, zip 013xx) ─────────────────────────────
  {
    id: 'MKT-0041',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    buyerName: 'Clínica Bem Cuidar',
    buyerCnpj: '12.345.678/0001-90',
    buyerStreet: 'Av. Paulista, 1000',
    buyerNeighborhood: 'Bela Vista',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01310-100',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    totalOffers: 3,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0038',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerName: 'Revendas Baby SP',
    buyerCnpj: '98.765.432/0001-10',
    buyerStreet: 'R. Consolação, 500',
    buyerNeighborhood: 'Bela Vista',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01301-000',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: true,
    myOffer: { price: 24500, deliveryType: { kind: 'delivery', maxHours: 2 } },
    status: 'ofertado',
  },
  // ── Within 5km radius (CEP prefix '013', different neighborhood) ──────────
  {
    id: 'MKT-0035',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    buyerName: 'Farmácia Central',
    buyerCnpj: '55.123.456/0001-44',
    buyerStreet: 'R. Augusta, 300',
    buyerNeighborhood: 'Consolação',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01305-100',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    totalOffers: 0,
    offeredByMe: false,
    status: 'aberto',
  },
  // ── Within 10km radius (CEP prefix '01', not '013') ───────────────────────
  {
    id: 'MKT-0029',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerName: 'Hospital Infantil SP',
    buyerCnpj: '11.222.333/0001-55',
    buyerStreet: 'Av. Rebouças, 1200',
    buyerNeighborhood: 'Jardins',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01426-000',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    totalOffers: 2,
    offeredByMe: true,
    myOffer: { price: 18900, deliveryType: { kind: 'days', count: 3 }, note: 'Inclui frete' },
    status: 'ofertado',
  },
  // ── National — other states ───────────────────────────────────────────────
  {
    id: 'MKT-0021',
    product: 'Babysec Premium M',
    quantity: 60,
    unit: 'un',
    buyerName: 'Rede Baby RJ',
    buyerCnpj: '77.888.999/0001-00',
    buyerStreet: 'Av. Rio Branco, 200',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    buyerZip: '20040-020',
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    totalOffers: 5,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0015',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerName: 'Distribuidora Norte',
    buyerCnpj: '22.333.444/0001-88',
    buyerStreet: 'R. Principal, 100',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Manaus',
    buyerState: 'AM',
    buyerZip: '69005-000',
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    totalOffers: 0,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0012',
    product: 'Huggies Natural Care G',
    quantity: 48,
    unit: 'un',
    buyerName: 'Clínica Materno Infantil',
    buyerCnpj: '44.555.666/0001-11',
    buyerStreet: 'Av. Beira Mar, 500',
    buyerNeighborhood: 'Meireles',
    buyerCity: 'Fortaleza',
    buyerState: 'CE',
    buyerZip: '60165-000',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: false,
    status: 'aberto',
  },
  // ── Encerrado ─────────────────────────────────────────────────────────────
  {
    id: 'MKT-0018',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerName: 'Atacado Santos',
    buyerCnpj: '33.444.555/0001-77',
    buyerStreet: 'R. Do Porto, 50',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Santos',
    buyerState: 'SP',
    buyerZip: '11013-000',
    createdAt: '2026-04-30T10:00:00Z',
    totalOffers: 4,
    offeredByMe: true,
    myOffer: { price: 31200, deliveryType: { kind: 'days', count: 2 } },
    status: 'encerrado',
  },
]

export const MOCK_DIRECT_ORDERS: DirectOrder[] = [
  {
    id: 'DIR-0031',
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
    id: 'DIR-0028',
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
    id: 'DIR-0022',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    price: 10500,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    status: 'confirmado',
    dispatchStatus: 'em_preparo',
  },
  {
    id: 'DIR-0015',
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
    orderId: 'MKT-0018',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerName: 'Atacado Santos',
    buyerCity: 'Santos',
    buyerState: 'SP',
    price: 31200,
    deliveryType: { kind: 'days', count: 2 },
    status: 'aceita',
    createdAt: '2026-04-30T11:00:00Z',
    dispatchStatus: 'despachado',
  },
  {
    id: 'sof-002',
    orderId: 'MKT-0038',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerName: 'Revendas Baby SP',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 24500,
    deliveryType: { kind: 'delivery', maxHours: 2 },
    status: 'enviada',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'sof-003',
    orderId: 'MKT-0029',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerName: 'Hospital Infantil SP',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 18900,
    deliveryType: { kind: 'days', count: 3 },
    note: 'Inclui frete',
    status: 'enviada',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
  {
    id: 'sof-004',
    orderId: 'MKT-0099',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerName: 'Clínica Bem Cuidar',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 15600,
    deliveryType: { kind: 'days', count: 1 },
    status: 'recusada',
    createdAt: '2026-05-10T14:00:00Z',
  },
  {
    id: 'sof-005',
    orderId: 'MKT-0098',
    product: 'Turma da Mônica M',
    quantity: 50,
    unit: 'un',
    buyerName: 'Rede Baby RJ',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    price: 42500,
    deliveryType: { kind: 'to_arrange' },
    status: 'expirada',
    createdAt: '2026-05-05T10:00:00Z',
  },
]
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors related to `supplier-mock.ts`. (Other files may temporarily show errors about missing new imports — that's expected until Tasks 2–3 are done.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supplier-mock.ts
git commit -m "feat(types): add DeliveryType, GeoScope, DispatchStatus; enrich mock data"
```

---

## Task 2: Create `market-utils.ts`

**Files:**
- Create: `src/lib/market-utils.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { MarketOrder, MockSupplier, GeoScope, DeliveryType, SupplierOffer } from './supplier-mock'

export function parsePriceToCents(raw: string): number | null {
  const value = parseFloat(raw.trim().replace(',', '.'))
  if (isNaN(value) || value <= 0) return null
  return Math.round(value * 100)
}

export function geoMatch(order: MarketOrder, supplier: MockSupplier, scope: GeoScope): boolean {
  switch (scope.type) {
    case 'neighborhood':
      return order.buyerNeighborhood === supplier.neighborhood
    case 'radius':
      return (
        order.buyerZip.slice(0, scope.km === 5 ? 3 : 2) ===
        supplier.zip.slice(0, scope.km === 5 ? 3 : 2)
      )
    case 'city':
      return order.buyerCity === scope.city && order.buyerState === scope.state
    case 'national':
      return true
  }
}

export function formatDeliveryType(dt: DeliveryType): string {
  if (dt.kind === 'delivery') return `⚡ Delivery local (até ${dt.maxHours}h)`
  if (dt.kind === 'days') return `${dt.count} dia${dt.count !== 1 ? 's' : ''} útil${dt.count !== 1 ? 'eis' : ''}`
  return 'A combinar'
}

export function buildOfferSnapshot(
  order: MarketOrder,
  price: number,
  deliveryType: DeliveryType,
  note?: string
): SupplierOffer {
  return {
    id: `sof-${Date.now()}`,
    orderId: order.id,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    buyerName: order.buyerName,
    buyerCity: order.buyerCity,
    buyerState: order.buyerState,
    price,
    deliveryType,
    note,
    status: 'enviada',
    createdAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no new errors from `market-utils.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/market-utils.ts
git commit -m "feat(utils): add market-utils — parsePriceToCents, geoMatch, formatDeliveryType, buildOfferSnapshot"
```

---

## Task 3: Create `MarketContext`

**Files:**
- Create: `src/contexts/market-context.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { createContext, useContext, useState } from 'react'
import { toast } from 'sonner'
import type { MarketOrder, DirectOrder, SupplierOffer, DeliveryType, DispatchStatus } from '@/lib/supplier-mock'
import { MOCK_MARKET_ORDERS, MOCK_DIRECT_ORDERS, MOCK_OFFERS } from '@/lib/supplier-mock'
import { buildOfferSnapshot } from '@/lib/market-utils'

interface MarketContextValue {
  marketOrders: MarketOrder[]
  directOrders: DirectOrder[]
  offers: SupplierOffer[]
  declinedIds: Set<string>
  handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string): Promise<void>
  handleDeclineMercado(orderId: string): void
  handleConfirmarDireto(orderId: string): Promise<void>
  handleRecusarDireto(orderId: string): Promise<void>
  handleAtualizarDespacho(orderId: string, orderType: 'market' | 'direct', status: DispatchStatus): Promise<void>
}

const MarketContext = createContext<MarketContextValue | null>(null)

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>')
  return ctx
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>(MOCK_MARKET_ORDERS)
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>(MOCK_DIRECT_ORDERS)
  const [offers, setOffers] = useState<SupplierOffer[]>(MOCK_OFFERS)
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set())

  async function handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string) {
    const order = marketOrders.find((o) => o.id === orderId)!
    setMarketOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, offeredByMe: true, myOffer: { price, deliveryType, note }, status: 'ofertado' as const }
          : o
      )
    )
    setOffers((prev) => [buildOfferSnapshot(order, price, deliveryType, note), ...prev])
    // TODO: await fetch(`/api/market-orders/${orderId}/offer`, { method: 'POST', body: JSON.stringify({ price, deliveryType, note }) })
    toast.success('Oferta enviada com sucesso!')
  }

  function handleDeclineMercado(orderId: string) {
    setDeclinedIds((prev) => new Set([...prev, orderId]))
    toast.info('Pedido removido da sua fila.')
  }

  async function handleConfirmarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmado' as const } : o))
    )
    // TODO: await fetch(`/api/direct-orders/${orderId}/confirm`, { method: 'POST' })
    toast.success('Pedido confirmado! O comprador será notificado.')
  }

  async function handleRecusarDireto(orderId: string) {
    setDirectOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
    )
    // TODO: await fetch(`/api/direct-orders/${orderId}/refuse`, { method: 'POST' })
    toast.info('Pedido recusado.')
  }

  async function handleAtualizarDespacho(orderId: string, orderType: 'market' | 'direct', status: DispatchStatus) {
    if (orderType === 'direct') {
      setDirectOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, dispatchStatus: status } : o))
      )
    } else {
      setOffers((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, dispatchStatus: status } : o))
      )
    }
    // TODO: await fetch(`/api/orders/${orderId}/dispatch`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  return (
    <MarketContext.Provider
      value={{
        marketOrders,
        directOrders,
        offers,
        declinedIds,
        handleEnviarOferta,
        handleDeclineMercado,
        handleConfirmarDireto,
        handleRecusarDireto,
        handleAtualizarDespacho,
      }}
    >
      {children}
    </MarketContext.Provider>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors from `market-context.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/market-context.tsx
git commit -m "feat(context): add MarketContext with state and API-ready handlers"
```

---

## Task 4: Wrap layout with `MarketProvider`

**Files:**
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Update the layout**

Replace the file contents with:

```typescript
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MarketProvider } from '@/contexts/market-context'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>
        <MarketProvider>{children}</MarketProvider>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/layout.tsx
git commit -m "feat(layout): wrap (main) layout with MarketProvider"
```

---

## Task 5: Add `slide-out` animation to `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the animation class and keyframe**

Inside the `@layer utilities { ... }` block, add after the existing `.cloud-float` rule:

```css
  .slide-out {
    animation: slide-out 300ms ease-out forwards;
    pointer-events: none;
  }
```

After the existing `@keyframes cloud-float { ... }` block, add:

```css
@keyframes slide-out {
  0%   { opacity: 1; transform: translateX(0); max-height: 300px; }
  100% { opacity: 0; transform: translateX(40px); max-height: 0; overflow: hidden; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(css): add slide-out animation for declined market orders"
```

---

## Task 6: Create `GeoScopeSelector`

**Files:**
- Create: `src/components/mercado/GeoScopeSelector.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { GeoScope } from '@/lib/supplier-mock'

interface GeoScopeSelectorProps {
  value: GeoScope
  onChange: (scope: GeoScope) => void
}

type ScopeKey = 'neighborhood' | 'radius_5' | 'radius_10' | 'city' | 'national'

function scopeKey(scope: GeoScope): ScopeKey {
  if (scope.type === 'radius') return `radius_${scope.km}` as ScopeKey
  if (scope.type === 'city') return 'city'
  return scope.type as ScopeKey
}

const BUTTONS: Array<{ key: ScopeKey; label: string; scope: GeoScope }> = [
  { key: 'neighborhood', label: '📍 Apenas meu bairro', scope: { type: 'neighborhood' } },
  { key: 'radius_5',     label: '🔵 Raio 5km',          scope: { type: 'radius', km: 5 } },
  { key: 'radius_10',    label: '🔵 Raio 10km',         scope: { type: 'radius', km: 10 } },
  { key: 'city',         label: '🏙️ Outra cidade...',   scope: { type: 'city', city: '', state: '' } },
  { key: 'national',     label: '🇧🇷 Brasil inteiro',    scope: { type: 'national' } },
]

export default function GeoScopeSelector({ value, onChange }: GeoScopeSelectorProps) {
  const [cityInput, setCityInput] = useState('')
  const [stateInput, setStateInput] = useState('')

  const activeKey = scopeKey(value)

  function handleButtonClick(btn: (typeof BUTTONS)[number]) {
    if (btn.key === 'city') {
      onChange({ type: 'city', city: cityInput.trim(), state: stateInput.trim() })
    } else {
      onChange(btn.scope)
    }
  }

  function handleCitySearch() {
    if (cityInput.trim()) {
      onChange({ type: 'city', city: cityInput.trim(), state: stateInput.trim() })
    }
  }

  return (
    <div className="py-3 px-4 sm:px-8 lg:px-20 bg-white border-b-2 border-slate-200">
      <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.1em] mb-2">
        Mostrar pedidos de:
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => handleButtonClick(btn)}
            className={`text-[11px] font-bold px-3.5 py-1.5 rounded-lg border transition-colors ${
              activeKey === btn.key
                ? 'bg-primary-dark text-white border-primary-dark'
                : 'bg-white border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {activeKey === 'city' && (
        <div className="flex gap-2 mt-3 items-center flex-wrap">
          <input
            type="text"
            placeholder="Cidade..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="UF"
            value={stateInput}
            maxLength={2}
            onChange={(e) => setStateInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-16 focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleCitySearch}
            className="bg-primary-dark text-white text-xs font-bold px-3 py-1.5 rounded-lg"
          >
            Buscar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mercado/GeoScopeSelector.tsx
git commit -m "feat(mercado): add GeoScopeSelector component"
```

---

## Task 7: Create `InlineOfferForm`

**Files:**
- Create: `src/components/mercado/InlineOfferForm.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { GeoScope, DeliveryType, MarketOrder } from '@/lib/supplier-mock'
import { parsePriceToCents } from '@/lib/market-utils'

interface InlineOfferFormProps {
  order: MarketOrder
  scope: GeoScope
  onSubmit: (price: number, deliveryType: DeliveryType, note?: string) => void
  onDecline: () => void
}

type DeliveryOption = { value: string; label: string; deliveryType: DeliveryType }

function getDeliveryOptions(scope: GeoScope): DeliveryOption[] {
  const opts: DeliveryOption[] = []
  const isNeighborhoodOrRadius5 =
    scope.type === 'neighborhood' || (scope.type === 'radius' && scope.km === 5)
  const isRadius10 = scope.type === 'radius' && scope.km === 10

  if (isNeighborhoodOrRadius5) {
    opts.push({ value: 'd1h', label: '⚡ Delivery local (até 1h)', deliveryType: { kind: 'delivery', maxHours: 1 } })
    opts.push({ value: 'd2h', label: '⚡ Delivery local (até 2h)', deliveryType: { kind: 'delivery', maxHours: 2 } })
    opts.push({ value: 'd4h', label: '⚡ Delivery local (até 4h)', deliveryType: { kind: 'delivery', maxHours: 4 } })
  } else if (isRadius10) {
    opts.push({ value: 'd2h', label: '⚡ Delivery local (até 2h)', deliveryType: { kind: 'delivery', maxHours: 2 } })
    opts.push({ value: 'd4h', label: '⚡ Delivery local (até 4h)', deliveryType: { kind: 'delivery', maxHours: 4 } })
  }

  opts.push(
    { value: '1d',  label: '1 dia útil',    deliveryType: { kind: 'days', count: 1 } },
    { value: '2d',  label: '2 dias úteis',  deliveryType: { kind: 'days', count: 2 } },
    { value: '3d',  label: '3 dias úteis',  deliveryType: { kind: 'days', count: 3 } },
    { value: '5d',  label: '5 dias úteis',  deliveryType: { kind: 'days', count: 5 } },
    { value: '7d',  label: '7 dias úteis',  deliveryType: { kind: 'days', count: 7 } },
    { value: 'arr', label: 'A combinar',    deliveryType: { kind: 'to_arrange' } },
  )
  return opts
}

export default function InlineOfferForm({ order, scope, onSubmit, onDecline }: InlineOfferFormProps) {
  const [priceRaw, setPriceRaw] = useState('')
  const [deliveryKey, setDeliveryKey] = useState('')
  const [note, setNote] = useState('')

  const options = getDeliveryOptions(scope)
  const priceCents = parsePriceToCents(priceRaw)
  const perUnit =
    priceCents !== null && order.quantity > 0
      ? (priceCents / order.quantity / 100).toFixed(2).replace('.', ',')
      : null

  function handleSubmit() {
    if (!priceCents || !deliveryKey) return
    const opt = options.find((o) => o.value === deliveryKey)
    if (!opt) return
    onSubmit(priceCents, opt.deliveryType, note.trim() || undefined)
  }

  return (
    <div className="px-4 py-4 bg-primary-light border-t border-dashed border-primary/30 flex flex-wrap gap-3 items-end">
      {/* Price */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Preço total (R$) *
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={priceRaw}
          onChange={(e) => setPriceRaw(e.target.value)}
          className="bg-white border-2 border-primary rounded-lg px-3 py-1.5 text-sm font-bold text-brand-text w-28 focus:outline-none"
        />
        {perUnit && (
          <div className="text-[9px] text-primary-dark font-semibold mt-1">
            ≈ R$ {perUnit} por {order.unit}
          </div>
        )}
      </div>

      {/* Delivery */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Modalidade *
        </div>
        <select
          value={deliveryKey}
          onChange={(e) => setDeliveryKey(e.target.value)}
          className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm text-brand-text w-52 focus:outline-none focus:border-primary"
        >
          <option value="" disabled>
            Selecionar...
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.06em] mb-1.5">
          Nota (opcional)
        </div>
        <input
          type="text"
          placeholder="Ex: entrego via motoboy…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-brand-text w-44 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!priceCents || !deliveryKey}
          className="bg-accent text-white font-display font-black text-xs px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-accent-dark transition-colors"
        >
          ✏️ Enviar oferta
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="bg-white border border-slate-200 text-brand-muted font-bold text-xs px-3 py-2 rounded-lg hover:border-slate-300 transition-colors"
        >
          ✕ Não concorro
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mercado/InlineOfferForm.tsx
git commit -m "feat(mercado): add InlineOfferForm with conditional delivery options"
```

---

## Task 8: Create `MarketRow`

**Files:**
- Create: `src/components/mercado/MarketRow.tsx`

**Important notes:**
- Row does NOT accept an `isDeclined` prop. Instead, `handleDeclineClick` sets local `pendingDecline = true` (triggering the `slide-out` CSS animation), then after 300ms calls `onDecline()`. The parent removes the order from the list on that setState, causing the component to unmount — the animation has already played.
- Offered rows (`order.offeredByMe === true`) show a `✓ OFERTADO` badge instead of the chevron, and clicking them has no effect (not expandable, no form).

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { GeoScope, DeliveryType, MarketOrder } from '@/lib/supplier-mock'
import { maskCnpj, timeAgo } from '@/lib/supplier-mock'
import InlineOfferForm from './InlineOfferForm'

interface MarketRowProps {
  order: MarketOrder
  isExpanded: boolean
  supplierNeighborhood: string
  scope: GeoScope
  onToggle: () => void
  onOfferSubmit: (price: number, deliveryType: DeliveryType, note?: string) => void
  onDecline: () => void
}

export default function MarketRow({
  order,
  isExpanded,
  supplierNeighborhood,
  scope,
  onToggle,
  onOfferSubmit,
  onDecline,
}: MarketRowProps) {
  const [pendingDecline, setPendingDecline] = useState(false)

  const isSameNeighborhood = order.buyerNeighborhood === supplierNeighborhood
  const isOffered = order.offeredByMe

  function handleDeclineClick() {
    setPendingDecline(true)
    setTimeout(() => onDecline(), 300)
  }

  const rowBg = isOffered
    ? 'bg-[#f0fdf4]'
    : isExpanded
    ? 'bg-[#EBF7FE]'
    : 'bg-white hover:bg-slate-50'

  return (
    <div className={`border-b border-slate-100 transition-colors ${pendingDecline ? 'slide-out' : ''} ${rowBg}`}>
      {/* Main row */}
      <div
        role={isOffered ? undefined : 'button'}
        tabIndex={isOffered ? undefined : 0}
        onClick={isOffered ? undefined : onToggle}
        onKeyDown={isOffered ? undefined : (e) => e.key === 'Enter' && onToggle()}
        className={`grid items-center gap-2 px-4 py-3 ${isOffered ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ gridTemplateColumns: '88px 1.4fr 1.3fr 1.8fr 70px 36px' }}
      >
        {/* Col 1: ID */}
        <div
          className={`font-mono text-[10px] font-bold text-primary-dark px-1.5 py-0.5 rounded whitespace-nowrap border ${
            isExpanded
              ? 'bg-white border-[#BAE0F7]'
              : 'bg-[#EBF7FE] border-primary/20'
          }`}
        >
          {order.id}
        </div>

        {/* Col 2: Product / Qty */}
        <div>
          <div className="font-bold text-xs text-brand-text">{order.product}</div>
          <div className="text-[10px] text-brand-muted mt-0.5">
            {order.quantity} {order.unit}
          </div>
        </div>

        {/* Col 3: Buyer */}
        <div>
          <div className="font-semibold text-[11px] text-brand-text">{order.buyerName}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{maskCnpj(order.buyerCnpj)}</div>
        </div>

        {/* Col 4: Address */}
        <div>
          <div className="text-[11px] text-brand-text font-medium">
            {order.buyerStreet} — {order.buyerNeighborhood}
          </div>
          <div className="text-[10px] text-brand-muted mt-0.5">
            {order.buyerCity} · {order.buyerState} · {order.buyerZip}
          </div>
          {isSameNeighborhood && (
            <span className="inline-flex items-center gap-1 mt-1 bg-yellow-50 border border-yellow-300 rounded px-1.5 py-0.5">
              <span className="text-[9px] font-extrabold text-yellow-800">⚡ Mesmo bairro</span>
            </span>
          )}
        </div>

        {/* Col 5: Time */}
        <span className="text-[11px] text-brand-muted" suppressHydrationWarning>
          {timeAgo(order.createdAt)}
        </span>

        {/* Col 6: Chevron or offered badge */}
        <div className="flex justify-center">
          {isOffered ? (
            <span className="text-[9px] font-extrabold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
              ✓ OFERTADO
            </span>
          ) : (
            <span className="text-primary-dark font-bold text-sm">
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {/* Inline form — only when expanded and not yet offered */}
      {isExpanded && !isOffered && (
        <InlineOfferForm
          order={order}
          scope={scope}
          onSubmit={onOfferSubmit}
          onDecline={handleDeclineClick}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mercado/MarketRow.tsx
git commit -m "feat(mercado): add MarketRow with expand/collapse and slide-out decline animation"
```

---

## Task 9: Create `MarketTable`

**Files:**
- Create: `src/components/mercado/MarketTable.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeoScope, DeliveryType } from '@/lib/supplier-mock'
import { MOCK_SUPPLIER } from '@/lib/supplier-mock'
import { geoMatch } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'
import MarketRow from './MarketRow'

interface MarketTableProps {
  scope: GeoScope
  onExpandScope: () => void
}

const INITIAL_COUNT = 10
const PAGE_SIZE = 10

export default function MarketTable({ scope, onExpandScope }: MarketTableProps) {
  const { marketOrders, declinedIds, handleEnviarOferta, handleDeclineMercado } = useMarket()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const activeOrders = marketOrders.filter(
    (o) => !declinedIds.has(o.id) && o.status !== 'encerrado'
  )
  const filteredOrders = activeOrders.filter((o) => geoMatch(o, MOCK_SUPPLIER, scope))
  const visibleOrders = filteredOrders.slice(0, visibleCount)
  const hasMore = filteredOrders.length > visibleCount
  const nationalCount = activeOrders.length
  const showExpandCta = filteredOrders.length < 3 && nationalCount > filteredOrders.length

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT)
    setExpandedId(null)
  }, [scope])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => prev + PAGE_SIZE)
        }
      },
      { threshold: 0.1 }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore])

  function handleToggle(orderId: string) {
    setExpandedId((prev) => (prev === orderId ? null : orderId))
  }

  function handleOffer(orderId: string, price: number, deliveryType: DeliveryType, note?: string) {
    handleEnviarOferta(orderId, price, deliveryType, note)
    setExpandedId(null)
  }

  const scopeLabel =
    scope.type === 'neighborhood'
      ? `📍 ${MOCK_SUPPLIER.neighborhood} · ${MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo'}`
      : scope.type === 'radius'
      ? `🔵 Raio ${scope.km}km`
      : scope.type === 'city'
      ? `🏙️ ${scope.city}${scope.state ? ` · ${scope.state}` : ''}`
      : '🇧🇷 Brasil inteiro'

  return (
    <div className="px-4 sm:px-8 lg:px-20">
      {/* Result summary */}
      <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold text-brand-muted">
        <span className="bg-[#EBF7FE] text-primary-dark px-2 py-0.5 rounded text-[9px]">
          {scopeLabel}
        </span>
        <span>
          {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''} encontrado
          {filteredOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div
          className="grid gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[9.5px] font-bold text-slate-500 uppercase tracking-[.06em]"
          style={{ gridTemplateColumns: '88px 1.4fr 1.3fr 1.8fr 70px 36px' }}
        >
          <span>ID Pedido</span>
          <span>Produto / Qtd</span>
          <span>Comprador</span>
          <span>Endereço</span>
          <span>Postado</span>
          <span />
        </div>

        {/* Rows */}
        {visibleOrders.length === 0 ? (
          <div className="py-12 text-center text-brand-muted text-sm">
            Nenhum pedido neste raio no momento.
          </div>
        ) : (
          visibleOrders.map((order) => (
            <MarketRow
              key={order.id}
              order={order}
              isExpanded={expandedId === order.id}
              supplierNeighborhood={MOCK_SUPPLIER.neighborhood}
              scope={scope}
              onToggle={() => handleToggle(order.id)}
              onOfferSubmit={(price, deliveryType, note) =>
                handleOffer(order.id, price, deliveryType, note)
              }
              onDecline={() => handleDeclineMercado(order.id)}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>

      {/* Expand radius CTA */}
      {showExpandCta && (
        <div className="mt-3 p-4 bg-white border-2 border-dashed border-primary/30 rounded-xl flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-brand-text">Quer ver mais pedidos?</div>
            <div className="text-[11px] text-brand-muted mt-1">
              {nationalCount} pedido{nationalCount !== 1 ? 's' : ''} disponíve
              {nationalCount !== 1 ? 'is' : 'l'} no Brasil inteiro
            </div>
          </div>
          <button
            type="button"
            onClick={onExpandScope}
            className="bg-[#EBF7FE] text-primary-dark text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap hover:bg-primary/20 transition-colors"
          >
            Ampliar raio →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mercado/MarketTable.tsx
git commit -m "feat(mercado): add MarketTable with infinite scroll and expand-radius CTA"
```

---

## Task 10: Create `/mercado` page

**Files:**
- Create: `src/app/(main)/mercado/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { GeoScope } from '@/lib/supplier-mock'
import { MOCK_SUPPLIER } from '@/lib/supplier-mock'
import { geoMatch } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'
import GeoScopeSelector from '@/components/mercado/GeoScopeSelector'
import MarketTable from '@/components/mercado/MarketTable'

export default function MercadoPage() {
  const [scope, setScope] = useState<GeoScope>({ type: 'neighborhood' })
  const { marketOrders, declinedIds } = useMarket()

  const activeOrders = marketOrders.filter(
    (o) => o.status !== 'encerrado' && !declinedIds.has(o.id)
  )
  const neighborhoodCount = activeOrders.filter((o) =>
    geoMatch(o, MOCK_SUPPLIER, { type: 'neighborhood' })
  ).length
  const cityCount = activeOrders.filter((o) =>
    geoMatch(o, MOCK_SUPPLIER, {
      type: 'city',
      city: MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo',
      state: MOCK_SUPPLIER.states[0],
    })
  ).length
  const nationalCount = activeOrders.length

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#EBF7FE] via-brand-bg to-white border-b border-primary/10">
        <div className="container-fl pt-10 pb-6">
          <p className="text-[9px] font-extrabold uppercase tracking-[.15em] text-primary-dark mb-1">
            Mercado de Cotações
          </p>
          <h1 className="font-display font-black text-brand-text text-2xl">
            Pedidos abertos de fraldas
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Sua localização:{' '}
            <strong>
              {MOCK_SUPPLIER.neighborhood}, {MOCK_SUPPLIER.cities?.[0] ?? 'São Paulo'} ·{' '}
              {MOCK_SUPPLIER.states[0]}
            </strong>
          </p>
          <div className="flex gap-3 mt-4">
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-primary-dark block leading-none">
                {neighborhoodCount}
              </span>
              <span className="text-brand-muted">No bairro</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-green-600 block leading-none">
                {cityCount}
              </span>
              <span className="text-brand-muted">
                Em {MOCK_SUPPLIER.cities?.[0] ?? 'SP'}
              </span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-primary/20 text-xs">
              <span className="font-black text-lg text-accent block leading-none">
                {nationalCount}
              </span>
              <span className="text-brand-muted">No Brasil</span>
            </div>
          </div>
        </div>
        <GeoScopeSelector value={scope} onChange={setScope} />
      </section>

      {/* Table */}
      <section className="py-5">
        <MarketTable scope={scope} onExpandScope={() => setScope({ type: 'national' })} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Start dev server and verify `/mercado` visually**

Run: `npm run dev`

Open `http://localhost:3000/mercado`. Verify:
- Hero shows neighborhood, city, and national counters
- Scope selector renders 5 buttons; "📍 Apenas meu bairro" is active by default
- Table shows 2 orders for Bela Vista scope (MKT-0041 and MKT-0038)
- Clicking a row expands it showing the inline form
- Expanding a second row collapses the first
- MKT-0038 shows `✓ OFERTADO` badge (not expandable)
- MKT-0041 in Bela Vista shows `⚡ Mesmo bairro` badge
- Switching scope to "🇧🇷 Brasil inteiro" shows all 7 active orders
- Filling price and clicking "✏️ Enviar oferta" marks the row as offered (green bg)
- "✕ Não concorro" plays slide-out animation then removes the row

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/mercado/page.tsx
git commit -m "feat(mercado): add /mercado page with hero, geo scope, and market table"
```

---

## Task 11: Create `OfertasMercadoTab`

**Files:**
- Create: `src/components/fornecedor/OfertasMercadoTab.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { OfferStatus } from '@/lib/supplier-mock'
import { formatPrice, timeAgo } from '@/lib/supplier-mock'
import { formatDeliveryType } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'

type Filter = 'todas' | 'aguardando' | 'aceitas' | 'recusadas' | 'expiradas'

const STATUS_MAP: Record<Exclude<Filter, 'todas'>, OfferStatus> = {
  aguardando: 'enviada',
  aceitas:    'aceita',
  recusadas:  'recusada',
  expiradas:  'expirada',
}

const STATUS_LABELS: Record<OfferStatus, string> = {
  enviada:  'Aguardando',
  aceita:   'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

const STATUS_COLORS: Record<OfferStatus, string> = {
  enviada:  'bg-blue-100 text-blue-700',
  aceita:   'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-600',
  expirada: 'bg-slate-100 text-slate-500',
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'todas',     label: 'Todas' },
  { key: 'aguardando', label: 'Aguardando' },
  { key: 'aceitas',   label: 'Aceitas' },
  { key: 'recusadas', label: 'Recusadas' },
  { key: 'expiradas', label: 'Expiradas' },
]

export default function OfertasMercadoTab() {
  const { offers } = useMarket()
  const [filter, setFilter] = useState<Filter>('todas')

  const filtered =
    filter === 'todas'
      ? offers
      : offers.filter((o) => o.status === STATUS_MAP[filter as Exclude<Filter, 'todas'>])

  const counts: Record<Filter, number> = {
    todas:      offers.length,
    aguardando: offers.filter((o) => o.status === 'enviada').length,
    aceitas:    offers.filter((o) => o.status === 'aceita').length,
    recusadas:  offers.filter((o) => o.status === 'recusada').length,
    expiradas:  offers.filter((o) => o.status === 'expirada').length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === key
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted text-sm">
          Nenhuma oferta encontrada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-primary-dark bg-[#EBF7FE] px-1.5 py-0.5 rounded">
                      {offer.orderId}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_COLORS[offer.status]}`}
                    >
                      {STATUS_LABELS[offer.status]}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-brand-text">{offer.product}</div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {offer.quantity} {offer.unit}
                  </div>
                  <div className="text-xs text-brand-muted mt-1">
                    {offer.buyerName} · {offer.buyerCity} · {offer.buyerState}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-black text-base text-brand-text">
                    {formatPrice(offer.price)}
                  </div>
                  <div className="text-[10px] text-brand-muted">
                    {formatDeliveryType(offer.deliveryType)}
                  </div>
                  <div
                    className="text-[10px] text-brand-muted mt-1"
                    suppressHydrationWarning
                  >
                    {timeAgo(offer.createdAt)}
                  </div>
                </div>
              </div>
              {offer.note && (
                <div className="mt-2 text-xs text-brand-muted bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {offer.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/OfertasMercadoTab.tsx
git commit -m "feat(fornecedor): add OfertasMercadoTab with sub-filters"
```

---

## Task 12: Create `LogisticaTab`

**Files:**
- Create: `src/components/fornecedor/LogisticaTab.tsx`

**Logic notes:**
- `DispatchStatus` stages in order: `undefined` (Aceito) → `'em_preparo'` → `'despachado'` → `'entregue'`
- For delivery items (`deliveryType.kind === 'delivery'`), skip `'em_preparo'`: advance from `undefined` directly to `'despachado'`
- `nextStatus()` returns `null` when at the final stage (`'entregue'`); no button shown then

- [ ] **Step 1: Create the file**

```typescript
'use client'

import type { DispatchStatus, SupplierOffer, DirectOrder } from '@/lib/supplier-mock'
import { formatPrice, timeAgo } from '@/lib/supplier-mock'
import { formatDeliveryType } from '@/lib/market-utils'
import { useMarket } from '@/contexts/market-context'

type LogisticaItem =
  | { type: 'market'; data: SupplierOffer }
  | { type: 'direct'; data: DirectOrder }

type Stage = { status: DispatchStatus | null; label: string }

const ALL_STAGES: Stage[] = [
  { status: null,         label: 'Aceito' },
  { status: 'em_preparo', label: 'Em preparo' },
  { status: 'despachado', label: 'Despachado' },
  { status: 'entregue',   label: 'Entregue' },
]

function nextStatus(current: DispatchStatus | undefined, skipPreparo: boolean): DispatchStatus | null {
  if (!current) return skipPreparo ? 'despachado' : 'em_preparo'
  if (current === 'em_preparo') return 'despachado'
  if (current === 'despachado') return 'entregue'
  return null
}

function StepperBar({ current, skipPreparo }: { current?: DispatchStatus; skipPreparo: boolean }) {
  const stages = skipPreparo ? ALL_STAGES.filter((s) => s.status !== 'em_preparo') : ALL_STAGES
  const currentIdx = stages.findIndex((s) => s.status === (current ?? null))

  return (
    <div className="flex items-start gap-0 mt-4">
      {stages.map((stage, idx) => {
        const isPast    = idx < currentIdx
        const isCurrent = idx === currentIdx
        return (
          <div key={stage.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                  isPast
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary-dark border-primary-dark text-white'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isPast ? '✓' : idx + 1}
              </div>
              <div
                className={`text-[9px] mt-1 font-semibold text-center whitespace-nowrap ${
                  isCurrent ? 'text-primary-dark' : isPast ? 'text-green-600' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </div>
            </div>
            {idx < stages.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${isPast ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function LogisticaTab() {
  const { offers, directOrders, handleAtualizarDespacho } = useMarket()

  const items: LogisticaItem[] = [
    ...offers.filter((o) => o.status === 'aceita').map((data) => ({ type: 'market' as const, data })),
    ...directOrders.filter((o) => o.status === 'confirmado').map((data) => ({ type: 'direct' as const, data })),
  ]

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-brand-muted text-sm">
        Nenhum pedido em andamento no momento.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const isMarket        = item.type === 'market'
        const dispatchId      = isMarket ? (item.data as SupplierOffer).orderId : item.data.id
        const product         = item.data.product
        const quantity        = item.data.quantity
        const unit            = item.data.unit
        const price           = item.data.price
        const buyerCity       = item.data.buyerCity
        const buyerState      = item.data.buyerState
        const createdAt       = item.data.createdAt
        const dispatchStatus  = item.data.dispatchStatus
        const isDelivery      = isMarket && (item.data as SupplierOffer).deliveryType.kind === 'delivery'
        const next            = nextStatus(dispatchStatus, isDelivery)
        const nextLabel       = next ? ALL_STAGES.find((s) => s.status === next)?.label : null

        return (
          <div
            key={`${item.type}-${dispatchId}`}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-primary-dark bg-[#EBF7FE] px-1.5 py-0.5 rounded">
                    {dispatchId}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {isMarket ? 'Mercado' : 'Direto'}
                  </span>
                </div>
                <div className="font-bold text-sm text-brand-text">{product}</div>
                <div className="text-xs text-brand-muted">
                  {quantity} {unit} · {buyerCity}, {buyerState}
                </div>
                {isMarket && (
                  <div className="text-xs text-brand-muted">
                    {formatDeliveryType((item.data as SupplierOffer).deliveryType)}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-black text-base text-brand-text">
                  {formatPrice(price)}
                </div>
                <div className="text-[10px] text-brand-muted" suppressHydrationWarning>
                  {timeAgo(createdAt)}
                </div>
              </div>
            </div>

            <StepperBar current={dispatchStatus} skipPreparo={isDelivery} />

            {next && nextLabel && (
              <button
                type="button"
                onClick={() =>
                  handleAtualizarDespacho(
                    dispatchId,
                    isMarket ? 'market' : 'direct',
                    next
                  )
                }
                className="mt-3 bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary transition-colors"
              >
                Avançar: {nextLabel} →
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/fornecedor/LogisticaTab.tsx
git commit -m "feat(fornecedor): add LogisticaTab with 4-stage dispatch stepper"
```

---

## Task 13: Create `/fornecedor/painel` page

**Files:**
- Create: `src/app/(main)/fornecedor/painel/page.tsx`

**Important:** This page uses `@base-ui/react` Tabs. Always add `className="flex-col"` to `<Tabs>` — see AGENTS.md pitfall about `data-orientation`.

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMarket } from '@/contexts/market-context'
import { MOCK_SUPPLIER } from '@/lib/supplier-mock'
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import OfertasMercadoTab from '@/components/fornecedor/OfertasMercadoTab'
import LogisticaTab      from '@/components/fornecedor/LogisticaTab'

type TabKey = 'diretos' | 'ofertas' | 'logistica'

export default function FornecedorPainelPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('diretos')
  const { directOrders, offers, handleConfirmarDireto, handleRecusarDireto } = useMarket()

  const pendingDirectCount  = directOrders.filter((o) => o.status === 'aguardando').length
  const pendingOffersCount  = offers.filter((o) => o.status === 'enviada').length
  const inDeliveryCount     =
    offers.filter((o) => o.status === 'aceita').length +
    directOrders.filter((o) => o.status === 'confirmado').length

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-10 pb-8 border-b border-primary/10">
        <div className="container-fl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-1">
                Hub do Fornecedor
              </p>
              <h1 className="font-display font-black text-brand-text text-2xl lg:text-3xl">
                Olá, {MOCK_SUPPLIER.name.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-brand-muted mt-1">{MOCK_SUPPLIER.email}</p>
            </div>

            <div className="flex flex-wrap gap-3 items-start">
              {/* Counter: Diretos */}
              <button
                type="button"
                onClick={() => setActiveTab('diretos')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-accent/20 hover:border-accent/40 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-accent leading-none">
                  {pendingDirectCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Diretos</span>
              </button>

              {/* Counter: Ofertas */}
              <button
                type="button"
                onClick={() => setActiveTab('ofertas')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-primary/10 hover:border-primary/30 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-primary-dark leading-none">
                  {pendingOffersCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Ofertas</span>
              </button>

              {/* Counter: Entregas */}
              <button
                type="button"
                onClick={() => setActiveTab('logistica')}
                className="flex flex-col items-center bg-white rounded-2xl px-5 py-3 shadow-card border border-green-200 hover:border-green-400 transition-colors min-w-[80px]"
              >
                <span className="font-black text-2xl text-green-600 leading-none">
                  {inDeliveryCount}
                </span>
                <span className="text-xs text-brand-muted mt-1">Entregas</span>
              </button>

              {/* Shortcut to /mercado */}
              <Link
                href="/mercado"
                className="flex items-center gap-1.5 bg-primary-dark text-white text-xs font-display font-black px-4 py-3 rounded-2xl shadow-card hover:bg-primary transition-colors"
              >
                🏷️ Ver Mercado →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-brand-bg min-h-[60vh] py-8">
        <div className="container-fl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
            className="flex-col"
          >
            <div className="sticky top-[64px] lg:top-[80px] z-10 bg-brand-bg pb-0">
              <TabsList
                variant="line"
                className="w-full justify-start border-b-2 border-slate-200 rounded-none h-auto gap-0 p-0 bg-transparent overflow-x-auto"
              >
                <TabsTrigger
                  value="diretos"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🛒 Pedidos Diretos
                  {pendingDirectCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full">
                      {pendingDirectCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="ofertas"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  💬 Ofertas de Mercado
                </TabsTrigger>
                <TabsTrigger
                  value="logistica"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🚚 Logística
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-6">
              <TabsContent value="diretos">
                <PedidosDiretosTab
                  orders={directOrders}
                  onConfirmar={handleConfirmarDireto}
                  onRecusar={handleRecusarDireto}
                />
              </TabsContent>
              <TabsContent value="ofertas">
                <OfertasMercadoTab />
              </TabsContent>
              <TabsContent value="logistica">
                <LogisticaTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify `/fornecedor/painel` visually**

Open `http://localhost:3000/fornecedor/painel`. Verify:
- Hero shows supplier name, 3 counters (Diretos=2, Ofertas=2, Entregas=2), "🏷️ Ver Mercado →" link
- Clicking a counter navigates to that tab
- "Pedidos Diretos" tab shows DIR-0031 and DIR-0028 as pending with Confirmar/Recusar buttons
- "Ofertas de Mercado" tab shows 5 offers with sub-filters working correctly
- "Logística" tab shows sof-001 (despachado stage) and DIR-0022 (em_preparo stage) with advance buttons
- "🏷️ Ver Mercado →" navigates to `/mercado`
- Clicking "Avançar: Entregue →" on the logistics item advances the stepper

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/fornecedor/painel/page.tsx
git commit -m "feat(fornecedor): add /fornecedor/painel hub with 3-tab layout"
```

---

## Task 14: Convert `/fornecedor/page.tsx` to redirect

**Files:**
- Modify: `src/app/(main)/fornecedor/page.tsx`

- [ ] **Step 1: Replace the file with a redirect**

```typescript
import { redirect } from 'next/navigation'

export default function FornecedorPage() {
  redirect('/fornecedor/painel')
}
```

- [ ] **Step 2: Verify redirect works**

Open `http://localhost:3000/fornecedor`. Verify it redirects to `/fornecedor/painel` immediately.

- [ ] **Step 3: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/fornecedor/page.tsx
git commit -m "feat(fornecedor): redirect /fornecedor to /fornecedor/painel"
```

---

## Task 15: Remove old components + final check

**Files:**
- Remove: `src/components/fornecedor/MercadoTab.tsx`
- Remove: `src/components/fornecedor/EnviarOfertaModal.tsx`
- Remove: `src/components/fornecedor/MarketOrderCard.tsx`

- [ ] **Step 1: Delete the three files**

```powershell
Remove-Item src/components/fornecedor/MercadoTab.tsx
Remove-Item src/components/fornecedor/EnviarOfertaModal.tsx
Remove-Item src/components/fornecedor/MarketOrderCard.tsx
```

- [ ] **Step 2: Check TypeScript — confirm no remaining imports of deleted files**

Run: `npx tsc --noEmit`
Expected: no errors. If any file still imports from the deleted components, fix those imports.

- [ ] **Step 3: Final visual smoke test**

With the dev server running, verify:
- `http://localhost:3000/mercado` — table, geo filters, inline form, slide-out, infinite scroll CTA all work
- `http://localhost:3000/fornecedor` — redirects to `/fornecedor/painel`
- `http://localhost:3000/fornecedor/painel` — 3 tabs, all counters accurate, logistics stepper advances
- State is shared: send an offer from `/mercado` → navigate to `/fornecedor/painel` → "Ofertas de Mercado" tab shows the new offer immediately

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mercado): remove legacy MercadoTab, EnviarOfertaModal, MarketOrderCard"
```
