---
name: domain-mercado
description: Contexto completo do mercado global de cotações — componentes, rota, GeoScope, MarketContext e arquivos permitidos
---

# Domain: Mercado Global de Cotações

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/mercado/` ou `src/app/(main)/mercado/`.

---

## Responsabilidade do domínio

`/mercado` é a página pública do marketplace de cotações: fornecedores veem todos os pedidos abertos e enviam ofertas inline. É distinto do `/fornecedor/painel`, que mostra o estado das ofertas já enviadas e a logística.

---

## Camada de dados

**Estado:** consumido de `MarketContext` via `useMarket()` — não criar `useState` local para dados de negócio.

**Arquivo de contexto:** `src/contexts/market-context.tsx`

```typescript
import { useMarket } from '@/contexts/market-context'

const {
  marketOrders,         // MarketOrder[] — todos os pedidos (filtrar por scope e status)
  declinedIds,          // Set<string> — pedidos declinados nesta sessão (ocultar localmente)
  handleEnviarOferta,   // (orderId, price, deliveryType, note?) => Promise<void>
  handleDeclineMercado, // (orderId) => void — oculta localmente, emite toast
} = useMarket()
```

**Arquivo de utilitários:** `src/lib/market-utils.ts`

```typescript
parsePriceToCents(raw: string): number | null   // "312,00" → 31200; inválido → null
geoMatch(order: MarketOrder, supplier: MockSupplier, scope: GeoScope): boolean
formatDeliveryType(dt: DeliveryType): string    // ex: "⚡ Delivery local (até 2h)", "3 dias úteis"
buildOfferSnapshot(order, price, deliveryType, note?): SupplierOffer
```

**Tipos relevantes de `src/lib/supplier-mock.ts`:**
```typescript
GeoScope     // { type: 'neighborhood' }
             // | { type: 'radius', km: 5 | 10 | 20 }
             // | { type: 'city', city: string, state: string }
             // | { type: 'national' }
DeliveryType // { kind: 'delivery', maxHours: number }
             // | { kind: 'days', count: number }
             // | { kind: 'tbd' }
MarketOrder  // { id, product, quantity, unit, buyerNeighborhood, buyerCity, buyerState, buyerZip,
             //   createdAt, status, offeredByMe?, myOffer? }
```

---

## Componentes

```
src/components/mercado/
  GeoScopeSelector.tsx  ← seletor de abrangência geográfica (bairro / raio / cidade / nacional)
  MarketTable.tsx       ← lista paginada com infinite scroll; recebe orders filtrados + handlers
  MarketRow.tsx         ← linha expandível: cabeçalho + InlineOfferForm ao expandir;
                          animação slide-out ao declinar (CSS: .slide-out-row em globals.css)
  InlineOfferForm.tsx   ← formulário de oferta dentro da linha; usa parsePriceToCents + formatDeliveryType;
                          exibe cálculo por unidade em tempo real; opções de entrega condicionais
```

---

## Rota e arquitetura

**Controller:** `src/app/(main)/mercado/page.tsx`

```
page.tsx
  └── useState: scope (GeoScope)
  └── useMarket(): marketOrders, declinedIds
  └── Derivações locais (useMemo implícito via inline filter):
        activeOrders   = marketOrders.filter(status ≠ encerrado && !declinedIds)
        filteredOrders = activeOrders.filter(geoMatch(o, MOCK_SUPPLIER, scope))
  └── Hero com 3 contadores (bairro / cidade / nacional)
  └── <GeoScopeSelector scope={scope} onChange={setScope} />
  └── <MarketTable orders={filteredOrders} onOffer={handleEnviarOferta} onDecline={handleDeclineMercado} />
        └── <MarketRow> (expandível)
              └── <InlineOfferForm> (ao expandir)
```

- `page.tsx` só gerencia `scope` como estado local; dados de negócio vêm do contexto
- Componentes não têm estado de negócio próprio

---

## Fluxo de envio de oferta

```
Usuário clica em "Ofertar" no MarketRow
  → MarketRow expande e renderiza InlineOfferForm
  → Usuário preenche preço + tipo de entrega (+ obs opcional)
  → InlineOfferForm chama onOffer(orderId, priceCents, deliveryType, note)
  → handleEnviarOferta no MarketContext:
      1. Atualiza marketOrders: offeredByMe=true, status='ofertado'
      2. Adiciona SupplierOffer em offers[]
      3. Toast "Oferta enviada com sucesso!"
      4. TODO: POST /api/market-orders/:id/offer
  → MarketRow colapsa e exibe badge "Já ofertei"
```

## Fluxo de declínio

```
Usuário clica em "Não concorro"
  → handleDeclineMercado(orderId)
  → declinedIds ganha o id
  → MarketRow dispara animação .slide-out-row (CSS keyframe)
  → Pedido some da lista filtrada
  → Toast "Pedido removido da sua fila."
  (sem persistência — ao recarregar o pedido reaparece — comportamento esperado para mock)
```

---

## Pitfalls críticos

**`geoMatch` usa prefixo de CEP, não cálculo real de raio:**
```typescript
// Raio de 5km → compara primeiros 3 dígitos do CEP
// Raio de 10km/20km → compara primeiros 2 dígitos
// Não é geolocalização real — aproximação para mock
```

**`parsePriceToCents` retorna `null` para entrada inválida:**
```typescript
// Sempre validar antes de chamar handleEnviarOferta
const cents = parsePriceToCents(rawInput)
if (!cents) { /* mostrar erro de validação */ return }
```

**`timeAgo()` causa hydration mismatch:**
```tsx
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

**Animação slide-out está em `src/app/globals.css`:**
```css
/* Classe: .slide-out-row — keyframe de saída com translate + opacity */
/* Não recriar inline — já existe no globals.css */
```

**`MarketProvider` está no layout raiz — não re-envolver:**
```tsx
// ❌ ERRADO — MarketProvider já está em src/app/(main)/layout.tsx
<MarketProvider><MercadoPage /></MarketProvider>

// ✅ Simplesmente usar useMarket() dentro do componente
```

---

## Arquivos que este agente PODE tocar

```
✅ src/components/mercado/**
✅ src/app/(main)/mercado/**
✅ src/lib/market-utils.ts         (cautela: compartilhado com domínio fornecedor — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/contexts/market-context.tsx  — estado global; modificar afeta /fornecedor/painel também
❌ src/components/ui/**             — primitivos compartilhados
❌ src/components/fornecedor/**     — domínio do fornecedor
❌ src/components/minha-conta/**    — domínio do comprador
❌ src/components/catalogo/**       — domínio do catálogo
❌ src/lib/supplier-mock.ts         — tipos base; invoke risk-zone-protocol se precisar adicionar tipo
❌ tailwind.config.ts               — configuração global
❌ src/app/(main)/layout.tsx        — layout raiz
❌ src/app/globals.css              — apenas para verificar .slide-out-row, não modificar sem protocolo
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
