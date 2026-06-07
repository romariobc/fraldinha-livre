# Design Spec — Mercado Global + Hub do Fornecedor

**Data:** 2026-05-18
**Status:** Aprovado
**Escopo:** Separação da lógica do Mercado em rota pública independente + reestruturação do painel privado do fornecedor

---

## 1. Contexto e Motivação

O sistema atual tem o Mercado de cotações embutido como uma aba dentro de `/fornecedor`. Isso mistura captação global de propostas (que deve ser visível para qualquer fornecedor cadastrado) com a gestão privada de contratos (que é pessoal de cada fornecedor). A refatoração separa esses dois contextos em rotas distintas e adiciona lógica geográfica ao mercado.

---

## 2. Arquitetura de Rotas

```
src/app/(main)/
  mercado/
    page.tsx              ← NOVA — pública para fornecedores cadastrados
  fornecedor/
    page.tsx              ← EDITAR — redirect para /fornecedor/painel
    painel/
      page.tsx            ← NOVA — hub privado do fornecedor logado
```

`/fornecedor/page.tsx` faz `redirect('/fornecedor/painel')` via Next.js para preservar links existentes.

---

## 3. Estado Compartilhado — React Context

Um `MarketContext` criado em `src/contexts/market-context.tsx` envolve `(main)/layout.tsx`. Permite que `/mercado` e `/fornecedor/painel` compartilhem estado sem prop drilling.

### Interface do Context

```ts
interface MarketContextValue {
  // Estado
  marketOrders: MarketOrder[]
  directOrders: DirectOrder[]
  offers: SupplierOffer[]
  declinedIds: Set<string>

  // Handlers (API-ready — ver Seção 7)
  handleEnviarOferta(orderId: string, price: number, deliveryType: DeliveryType, note?: string): Promise<void>
  handleDeclineMercado(orderId: string): void
  handleConfirmarDireto(orderId: string): Promise<void>
  handleRecusarDireto(orderId: string): Promise<void>
  handleAtualizarDespacho(orderId: string, orderType: 'market' | 'direct', status: DispatchStatus): Promise<void>
}
```

`useMarket()` é o hook de acesso. Lança erro se usado fora do provider.

---

## 4. Página `/mercado` — Mercado Global

### Comportamento geral

Página pública para fornecedores cadastrados. Exibe pedidos de cotação abertos em formato de **tabela com linhas expansíveis** (accordion). Apenas uma linha pode estar expandida por vez. O formulário de envio de oferta é **inline** — sem modal.

### Filtros geográficos (GeoScope)

O seletor de escopo é um segmented control de seleção única. O escopo ativo controla quais pedidos aparecem na tabela e quais opções de modalidade de entrega ficam disponíveis no formulário.

| Escopo | Label | Critério de match (mock) |
|---|---|---|
| `neighborhood` | 📍 Apenas meu bairro | `buyerNeighborhood === supplier.neighborhood` |
| `radius_5km` | 🔵 Raio 5km | Primeiros 3 dígitos do CEP coincidem |
| `radius_10km` | 🔵 Raio 10km | Primeiros 2 dígitos do CEP coincidem |
| `city` | 🏙️ Outra cidade... | Cidade digitada no input de busca |
| `national` | 🇧🇷 Brasil inteiro | Sem filtro de localização |

Ao selecionar `city`, um input de busca de cidade aparece abaixo do seletor.

### Hero

- Título fixo + localização cadastrada do fornecedor
- 3 contadores: "No bairro" / "Em [cidade]" / "No Brasil" — atualizados conforme os dados

### Tabela — 6 colunas

| # | Coluna | Campo(s) |
|---|---|---|
| 1 | **ID Pedido** | `id` — monospace, prefixo `MKT-`, cor `primary-dark` |
| 2 | **Produto / Qtd** | `product` + `quantity unit` na segunda linha |
| 3 | **Comprador** | `buyerName` + `buyerCnpj` mascarado |
| 4 | **Endereço** | `buyerStreet` — `buyerNeighborhood` / `buyerCity` · `buyerState` · `buyerZip` |
| 5 | **Postado** | `timeAgo(createdAt)` com `suppressHydrationWarning` |
| 6 | **▼/▲** | Chevron; linha inteira clicável |

Badge **⚡ Mesmo bairro** aparece na coluna Endereço quando `buyerNeighborhood === supplier.neighborhood`.

### Estados visuais das linhas

- **Pendente:** fundo branco, ações "Enviar oferta" + "✕ Não concorro"
- **Expandida:** fundo `primary-light` (`#EBF7FE`), form inline visível
- **Ofertada:** fundo verde suave (`#f0fdf4`), badge `✓ OFERTADO`, sem ações de envio
- **Recusada localmente:** animação `slide-out` (300ms) → linha desaparece via `declinedIds` Set imutável

### Formulário inline (ao expandir)

Campos:
1. **Preço total (R$)** — input texto, `inputMode="decimal"`, converte via `parsePriceToCents()`
2. **≈ R$ X,XX por [unit]** — calculado em tempo real: `price / quantity`
3. **Modalidade** — select com opções condicionadas ao escopo ativo:
   - `⚡ Delivery local (até 1h)` — só se escopo ≤ `radius_5km`
   - `⚡ Delivery local (até 2h)` — só se escopo ≤ `radius_10km`
   - `⚡ Delivery local (até 4h)` — só se escopo ≤ `radius_10km`
   - `1 dia útil / 2 / 3 / 5 / 7 dias úteis` — sempre
   - `A combinar` — sempre
4. **Nota (opcional)** — textarea

Ao submeter: `handleEnviarOferta()` → snapshot `SupplierOffer` → `offeredByMe: true` no pedido → linha vira estado "Ofertada".

### Scroll infinito

`visibleCount` começa em 10, incrementa +10 quando um `<div>` sentinel (IntersectionObserver) entra na viewport. A lista renderizada é `orders.slice(0, visibleCount)`.

### CTA de expansão de raio

Quando o escopo atual retorna poucos resultados (< 3), um banner no rodapé mostra quantos pedidos existem em escopos maiores com botão "Ampliar raio →".

---

## 5. Página `/fornecedor/painel` — Hub Privado

### Hero

- Saudação com nome do fornecedor
- 3 contadores clicáveis que navegam para a aba correspondente:
  - **Diretos** (pedidos diretos aguardando) — borda laranja
  - **Ofertas** (ofertas enviadas aguardando resposta) — borda azul
  - **Entregas** (pedidos aceitos em andamento) — borda verde
- Botão de atalho **"🏷️ Ver Mercado →"** navega para `/mercado`

### Aba 1 — 💬 Ofertas de Mercado

Lista todos os `SupplierOffer` do context.

Colunas por card: ID do pedido original (MKT-XXXX) · produto + quantidade + comprador + endereço · preço total + por unidade + modalidade · tempo · badge de status.

Sub-filtros: Todas / Aguardando / Aceitas / Recusadas / Expiradas.

### Aba 2 — 🛒 Pedidos Diretos

Lista `DirectOrder` do context. ID com prefixo `DIR-`.

Pedidos `aguardando`: botões Confirmar (verde) e Recusar (cinza).
Pedidos `confirmado` / `cancelado`: badge de status, sem ações.

### Aba 3 — 🚚 Logística / Entregas

Agrega:
- `SupplierOffer` com `status === 'aceita'`
- `DirectOrder` com `status === 'confirmado'`

Cada item exibe um **stepper visual** de 4 estágios: `Aceito → Em preparo → Despachado → Entregue`.

O botão avança para o próximo `DispatchStatus` chamando `handleAtualizarDespacho()`. O estágio atual é destacado; estágios anteriores têm check; estágios futuros ficam acinzentados.

Para itens com modalidade `delivery`, o primeiro estágio após aceito é diretamente `Despachado` (sem "Em preparo").

---

## 6. Tipagem TypeScript — Alterações Completas

### Tipos novos

```ts
// Modalidade de entrega — discriminated union
export type DeliveryType =
  | { kind: 'delivery'; maxHours: 1 | 2 | 4 }
  | { kind: 'days'; count: number }
  | { kind: 'to_arrange' }

// Escopo geográfico
export type GeoScope =
  | { type: 'neighborhood' }
  | { type: 'radius'; km: 5 | 10 }
  | { type: 'city'; city: string; state: string }
  | { type: 'national' }

// Status de despacho
export type DispatchStatus = 'em_preparo' | 'despachado' | 'entregue'
```

### `MarketOrder` — campos adicionados

```ts
export interface MarketOrder {
  id: string                   // prefixo 'MKT-'
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'

  buyerName: string            // NOVO — razão social cadastrada
  buyerCnpj: string            // NOVO — mascarado via maskCnpj() antes da aceitação

  buyerStreet: string          // NOVO — rua + número
  buyerNeighborhood: string    // NOVO — chave do filtro local
  buyerCity: string
  buyerState: string
  buyerZip: string             // NOVO — CEP, chave do filtro de raio

  createdAt: string
  totalOffers: number
  offeredByMe: boolean
  myOffer?: {
    price: number
    deliveryType: DeliveryType // ALTERADO — era deliveryDays: number
    note?: string
  }
  status: MarketOrderStatus
}
```

### `MockSupplier` — campos adicionados

```ts
export interface MockSupplier {
  // ...existentes...
  neighborhood: string         // NOVO — bairro cadastrado
  zip: string                  // NOVO — CEP base
}
```

### `DirectOrder` — campo adicionado

```ts
export interface DirectOrder {
  // ...existentes...
  dispatchStatus?: DispatchStatus  // NOVO — preenchido após confirmação
}
```

### `SupplierOffer` — campos alterados

```ts
export interface SupplierOffer {
  // ...existentes...
  buyerName: string            // NOVO — snapshot do nome do comprador
  deliveryType: DeliveryType   // ALTERADO — era deliveryDays: number (removido)
  dispatchStatus?: DispatchStatus  // NOVO — para itens aceitos na aba Logística
  // deliveryDays: number      // REMOVIDO — substituído por deliveryType
}
```

---

## 7. Handlers — Padrão API-ready

Todos os handlers seguem o contrato:
1. Snapshot imutável do estado atual antes da mutação
2. Atualização otimista do estado local
3. Slot comentado `// TODO: await fetch(...)` para substituição futura por chamada HTTP

```ts
async function handleEnviarOferta(orderId, price, deliveryType, note?) {
  // Otimista
  setMarketOrders(prev => prev.map(o =>
    o.id === orderId
      ? { ...o, offeredByMe: true, myOffer: { price, deliveryType, note }, status: 'ofertado' }
      : o
  ))
  const order = marketOrders.find(o => o.id === orderId)!
  setOffers(prev => [buildOfferSnapshot(order, price, deliveryType, note), ...prev])
  // TODO: await fetch(`/api/market-orders/${orderId}/offer`, { method: 'POST' })
}

async function handleAtualizarDespacho(orderId, orderType, status) {
  if (orderType === 'direct')
    setDirectOrders(prev => prev.map(o => o.id === orderId ? { ...o, dispatchStatus: status } : o))
  else
    setOffers(prev => prev.map(o => o.orderId === orderId ? { ...o, dispatchStatus: status } : o))
  // TODO: await fetch(`/api/orders/${orderId}/dispatch`, { method: 'PATCH', body: { status } })
}
```

`buildOfferSnapshot(order, price, deliveryType, note)` em `market-utils.ts` constrói o `SupplierOffer` imutável a partir do `MarketOrder` original.

---

## 8. Utilitários — `market-utils.ts` (novo)

```ts
// Conversão segura string → centavos
export function parsePriceToCents(raw: string): number | null {
  const value = parseFloat(raw.trim().replace(',', '.'))
  if (isNaN(value) || value <= 0) return null
  return Math.round(value * 100)
}

// Match geográfico (mock — substitui por cálculo real de distância no backend)
export function geoMatch(order: MarketOrder, supplier: MockSupplier, scope: GeoScope): boolean {
  switch (scope.type) {
    case 'neighborhood': return order.buyerNeighborhood === supplier.neighborhood
    case 'radius':       return order.buyerZip.slice(0, scope.km === 5 ? 3 : 2) === supplier.zip.slice(0, scope.km === 5 ? 3 : 2)
    case 'city':         return order.buyerCity === scope.city && order.buyerState === scope.state
    case 'national':     return true
  }
}

// Formata DeliveryType para exibição
export function formatDeliveryType(dt: DeliveryType): string {
  if (dt.kind === 'delivery') return `⚡ Delivery local (até ${dt.maxHours}h)`
  if (dt.kind === 'days') return `${dt.count} dia${dt.count !== 1 ? 's' : ''} útil${dt.count !== 1 ? 'eis' : ''}`
  return 'A combinar'
}

// Constrói snapshot imutável da oferta
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

---

## 9. Arquivos a Criar / Editar / Remover

| Ação | Arquivo |
|---|---|
| CRIAR | `src/contexts/market-context.tsx` |
| CRIAR | `src/app/(main)/mercado/page.tsx` |
| CRIAR | `src/app/(main)/fornecedor/painel/page.tsx` |
| CRIAR | `src/components/mercado/MarketTable.tsx` |
| CRIAR | `src/components/mercado/MarketRow.tsx` |
| CRIAR | `src/components/mercado/GeoScopeSelector.tsx` |
| CRIAR | `src/components/mercado/InlineOfferForm.tsx` |
| CRIAR | `src/components/fornecedor/OfertasMercadoTab.tsx` |
| CRIAR | `src/components/fornecedor/LogisticaTab.tsx` |
| CRIAR | `src/lib/market-utils.ts` |
| EDITAR | `src/app/(main)/layout.tsx` — envolve com `<MarketProvider>` |
| EDITAR | `src/app/(main)/fornecedor/page.tsx` — vira redirect |
| EDITAR | `src/lib/supplier-mock.ts` — novos campos e tipos |
| REMOVER | `src/components/fornecedor/MercadoTab.tsx` |
| REMOVER | `src/components/fornecedor/EnviarOfertaModal.tsx` |
| REMOVER | `src/components/fornecedor/MarketOrderCard.tsx` |

---

## 10. Armadilhas e Decisões

- **`declinedIds` é um `Set<string>` imutável** — sempre reconstruir com `new Set([...prev, id])`, nunca mutar diretamente
- **`deliveryType` substitui `deliveryDays: number`** — `SupplierOffer.deliveryType` é uma union discriminada; ao exibir, usar helper `formatDeliveryType(dt: DeliveryType): string`
- **`timeAgo()` em SSR** — manter `suppressHydrationWarning` em todos os spans que usam `timeAgo()`
- **Um row expandido por vez** — `expandedId: string | null` no estado local da tabela; abrir nova linha fecha a anterior automaticamente
- **Opções de delivery condicionadas ao escopo** — o componente `InlineOfferForm` recebe `scope: GeoScope` e filtra as opções do select internamente
- **`geoMatch` é mock** — a função usa prefixo de CEP como proxy de distância; o backend real usará coordenadas geográficas
- **CNPJ mascarado** — `buyerCnpj` exibido via `maskCnpj()` na tabela do Mercado; CNPJ completo revelado apenas na aba Ofertas de Mercado após status `aceita`
