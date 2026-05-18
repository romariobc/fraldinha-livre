---
name: domain-fornecedor
description: Contexto completo do painel do fornecedor — tipos, componentes, rotas, MarketContext e arquivos permitidos
---

# Domain: Painel do Fornecedor

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/fornecedor/` ou `src/app/(main)/fornecedor/`.

---

## Camada de dados

**Arquivo principal:** `src/lib/supplier-mock.ts`

**Tipos exportados:**
```typescript
MockSupplier        // perfil da empresa (razão social, CNPJ, marcas, UFs, zip, neighborhood, cities)
MarketOrder         // pedido de cotação do mercado
MarketOrderStatus   // 'aberto' | 'ofertado' | 'encerrado'
DirectOrder         // pedido de compra direta
DirectOrderStatus   // 'aguardando' | 'confirmado' | 'cancelado'
SupplierOffer       // oferta enviada pelo fornecedor
OfferStatus         // 'enviada' | 'aceita' | 'recusada' | 'expirada'
DispatchStatus      // 'em_preparo' | 'despachado' | 'entregue'
DeliveryType        // { kind: 'delivery', maxHours } | { kind: 'days', count } | { kind: 'tbd' }
GeoScope            // { type: 'neighborhood' } | { type: 'radius', km } | { type: 'city', city, state } | { type: 'national' }
```

**Constantes exportadas:**
```typescript
MOCK_SUPPLIER        // MockSupplier — dados do fornecedor logado
MOCK_MARKET_ORDERS   // MarketOrder[] — pedidos visíveis no Mercado
MOCK_DIRECT_ORDERS   // DirectOrder[] — pedidos de compra direta
MOCK_OFFERS          // SupplierOffer[] — ofertas enviadas por este fornecedor
```

**Helpers exportados de `supplier-mock.ts`:**
```typescript
formatPrice(cents: number): string   // 31200 → "R$ 312,00"
formatDate(iso: string): string      // ISO → dd/mm/yyyy pt-BR
timeAgo(iso: string): string         // ISO → "há 2h", "há 3 dias"
maskCnpj(cnpj: string): string       // "12.456.789/0001-00" → "***.456.789/0001-**"
```

**Helpers de `src/lib/market-utils.ts`:**
```typescript
formatDeliveryType(dt: DeliveryType): string   // DeliveryType → string legível
buildOfferSnapshot(order, price, deliveryType, note?): SupplierOffer
```

---

## Estado compartilhado — MarketContext

**ATENÇÃO: o estado do fornecedor NÃO vive mais em `useState` no `page.tsx`.**
Ele vive em `MarketContext`, provido por `<MarketProvider>` no layout raiz.

**Arquivo:** `src/contexts/market-context.tsx`

```typescript
// Hook de acesso — usar em qualquer componente dentro do layout (main)
import { useMarket } from '@/contexts/market-context'

const {
  marketOrders,           // MarketOrder[]
  directOrders,           // DirectOrder[]
  offers,                 // SupplierOffer[]
  declinedIds,            // Set<string> — IDs declinados (apenas visibilidade local)
  handleEnviarOferta,     // (orderId, price, deliveryType, note?) => Promise<void>
  handleDeclineMercado,   // (orderId) => void
  handleConfirmarDireto,  // (orderId) => Promise<void>
  handleRecusarDireto,    // (orderId) => Promise<void>
  handleAtualizarDespacho,// (orderId, orderType, status) => Promise<void>
} = useMarket()
```

Os handlers já emitem toasts via Sonner e têm `TODO: fetch(...)` prontos para conexão com API.

---

## Componentes

```
src/components/fornecedor/
  PedidosDiretosTab.tsx   ← lista de pedidos diretos; usa handleConfirmarDireto / handleRecusarDireto do contexto
  DirectOrderCard.tsx     ← card de pedido direto (apresentacional)
  OfertasMercadoTab.tsx   ← rastreia offers do contexto com filtros: todas/aguardando/aceitas/recusadas/expiradas
  OfertaCard.tsx          ← card de oferta enviada (apresentacional)
  LogisticaTab.tsx        ← stepper de 4 etapas (Aceito → Em preparo → Despachado → Entregue); usa handleAtualizarDespacho
  HistoricoTab.tsx        ← view unificada de pedidos + cotações finalizados
  PerfilTab.tsx           ← dados empresa, marcas representadas, UFs de cobertura
```

**Componentes REMOVIDOS** (não existem mais — não recriar):
- ~~`MercadoTab.tsx`~~ — substituído por `/mercado` + `OfertasMercadoTab.tsx`
- ~~`MarketOrderCard.tsx`~~ — removido junto com MercadoTab
- ~~`EnviarOfertaModal.tsx`~~ — formulário agora é inline em `InlineOfferForm` no domínio mercado

---

## Rota e arquitetura

```
src/app/(main)/fornecedor/
  page.tsx          ← apenas redirect('/fornecedor/painel') — não editar
  painel/
    page.tsx        ← CONTROLLER REAL do painel
```

**Controller:** `src/app/(main)/fornecedor/painel/page.tsx`

- Usa `useMarket()` para acessar dados e handlers (não tem `useState` próprio para dados de negócio)
- Hero no topo com 3 contadores clicáveis (Diretos / Ofertas / Em entrega) que mudam a tab ativa
- 3 tabs: `diretos`, `ofertas`, `logistica`
- Tabs não têm estado próprio (exceto filtros internos de UI)
- Cards são puramente apresentacionais

---

## Regras de negócio

**Pedidos Diretos:**
- Chegam SOMENTE para este fornecedor (comprador escolheu do catálogo)
- Ações: Confirmar (`handleConfirmarDireto`) ou Recusar (`handleRecusarDireto`)
- Não há concorrência — o fornecedor já está determinado pelo catálogo

**Ofertas (Minhas Ofertas):**
- Rastreia `offers` do contexto — histórico de ofertas enviadas com status atualizado
- Filtros: todas / aguardando (`enviada`) / aceitas / recusadas / expiradas

**Logística:**
- Combina pedidos diretos confirmados + ofertas aceitas em uma lista unificada
- Stepper de despacho: Aceito → Em preparo → Despachado → Entregue
- Entrega delivery (kind: 'delivery') pula "Em preparo" no stepper

---

## Pitfalls críticos

**timeAgo() causa hydration mismatch:**
```tsx
// SEMPRE usar suppressHydrationWarning em spans com timeAgo
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

**`useMarket()` lança erro fora do provider:**
```tsx
// MarketProvider está no layout (main) — dentro de qualquer página de (main)/ funciona.
// Nunca use useMarket() em componentes de Server Component ou fora do layout (main).
```

**Não duplicar estado do contexto:**
```tsx
// ❌ ERRADO — cria estado inconsistente com o contexto
const [directOrders, setDirectOrders] = useState(MOCK_DIRECT_ORDERS)

// ✅ CORRETO — consumir do contexto
const { directOrders, handleConfirmarDireto } = useMarket()
```

---

## Arquivos que este agente PODE tocar

```
✅ src/components/fornecedor/**
✅ src/app/(main)/fornecedor/painel/**
✅ src/lib/supplier-mock.ts        (cautela: arquivo compartilhado — invoke risk-zone-protocol)
✅ src/lib/market-utils.ts         (cautela: compartilhado com domínio mercado — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/contexts/market-context.tsx  — estado global; modificar afeta /mercado também
❌ src/app/(main)/fornecedor/page.tsx — apenas redirect, não editar
❌ src/components/ui/**             — primitivos compartilhados
❌ src/components/minha-conta/**    — domínio do comprador
❌ src/components/catalogo/**       — domínio do catálogo
❌ src/components/mercado/**        — domínio mercado
❌ tailwind.config.ts               — configuração global
❌ src/app/(main)/layout.tsx        — layout raiz
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
