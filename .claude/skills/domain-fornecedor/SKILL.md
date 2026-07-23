---
name: domain-fornecedor
description: Contexto completo do painel do fornecedor — tipos, componentes, rotas, regras de negócio e arquivos permitidos
---

# Domain: Painel do Fornecedor

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/fornecedor/` ou `src/app/(main)/fornecedor/`.

> Reescrito a partir do código real em 2026-07-23. A versão anterior descrevia componentes que não existem mais (`MercadoTab`, `EnviarOfertaModal`, `MinhasOfertasTab`, `OfertaCard`, `HistoricoTab`, `PerfilTab`) e um controller em `fornecedor/page.tsx`.

---

## Camada de dados

**Arquivo:** `src/lib/supplier-mock.ts` (tipos + mocks) — **mas o estado ao vivo do painel não vem direto daqui.** Vem de `useMarket()` (ver "Estado" abaixo). `MOCK_MARKET_ORDERS` e `MOCK_SUPPLIER` alimentam o domínio `/mercado` (`src/components/mercado/`), não o painel do fornecedor.

**Tipos exportados:**
```typescript
MockSupplier        // name, cnpj, email, phone, brands, states, cities?, ceps?, rating, memberSince, neighborhood, zip
MarketOrder         // pedido de cotação do mercado (buyerStreet/buyerNeighborhood/buyerCity/buyerState/buyerZip, buyerCnpj, myOffer?)
MarketOrderStatus   // 'aberto' | 'ofertado' | 'encerrado'
DirectOrder         // pedido de compra direta (+ paymentStatus?, dispatchStatus?)
DirectOrderStatus   // 'aguardando' | 'confirmado' | 'cancelado'
SupplierOffer       // oferta enviada pelo fornecedor (+ deliveryType, note?, paymentStatus?, dispatchStatus?)
OfferStatus         // 'enviada' | 'aceita' | 'recusada' | 'expirada'
DeliveryType        // { kind: 'delivery'; maxHours: 1|2|4 } | { kind: 'days'; count } | { kind: 'to_arrange' }
GeoScope            // { type: 'neighborhood' } | { type:'radius'; km:5|10 } | { type:'city';... } | { type:'national' }
DispatchStatus      // 'em_preparo' | 'despachado' | 'entregue'
PaymentStatus       // 'pendente' | 'confirmado'
```

**Constantes exportadas (usadas via `MarketProvider`, não importadas direto pelas tabs):**
```typescript
MOCK_SUPPLIER        // não consumido em nenhum componente do domínio fornecedor hoje (sem tela de perfil)
MOCK_MARKET_ORDERS   // consumido por /mercado, não pelo painel do fornecedor
MOCK_DIRECT_ORDERS   // seed inicial de MarketProvider
MOCK_OFFERS          // seed inicial de MarketProvider
```

**Helpers em `supplier-mock.ts`:**
```typescript
formatDate(iso: string): string
timeAgo(iso: string): string       // "há 2h", "há 3 dias"
maskCnpj(cnpj: string): string     // usado hoje só em /mercado (MarketRow.tsx), não no painel
```

**`formatPrice` NÃO está em `supplier-mock.ts`** — mora em `src/lib/utils.ts` (`import { formatPrice } from '@/lib/utils'`), compartilhado com todos os domínios.

**Helper adicional:** `formatDeliveryType(deliveryType)` em `src/lib/market-utils.ts` — formata `DeliveryType` para exibição (usado em `OfertasMercadoTab` e `LogisticaTab`).

---

## Estado (Context, não `useState` local no controller)

**Arquivo:** `src/contexts/market-context.tsx` — `MarketProvider` é montado no root layout (`src/app/(main)/layout.tsx`), envolvendo toda a aplicação, não só o domínio fornecedor.

```typescript
useMarket(): {
  marketOrders, directOrders, offers, declinedIds,
  handleEnviarOferta(orderId, price, deliveryType, note?): Promise<void>
  handleDeclineMercado(orderId): void
  handleConfirmarDireto(orderId): Promise<void>
  handleRecusarDireto(orderId): Promise<void>
  handleAtualizarDespacho(orderId, orderType: 'market'|'direct', status): Promise<void>
  addDirectOrder(directOrder): void
  cancelDirectOrder(orderId): void
}
```

Mutações hoje são só client-side (`setState`); os handlers já têm comentários `// TODO: await fetch(...)` marcando os endpoints reais futuros. `cancelDirectOrder` é chamado por `OrderCard` do domínio **comprador** (acoplamento cross-domain — ver Pitfalls).

---

## Componentes

```
src/components/fornecedor/
  PedidosDiretosTab.tsx   ← lista de pedidos diretos; filtro Todos/Aguardando/Confirmados; ações Confirmar/Recusar
  DirectOrderCard.tsx     ← card de pedido direto (apresentacional)
  OfertasMercadoTab.tsx   ← acompanhamento de ofertas já enviadas; filtro Todas/Aguardando/Aceitas/Recusadas/Expiradas
  LogisticaTab.tsx        ← tracker de despacho (stepper) para ofertas aceitas + diretos confirmados
```

Não existem mais: `MercadoTab`, `MarketOrderCard`, `EnviarOfertaModal`, `MinhasOfertasTab`, `OfertaCard`, `HistoricoTab`, `PerfilTab`. Enviar uma nova oferta de mercado é fluxo do domínio `/mercado` (`src/app/(main)/mercado/page.tsx` + `src/components/mercado/`), fora do escopo desta skill.

---

## Rota e arquitetura

- **`src/app/(main)/fornecedor/page.tsx`** é só um redirect: `redirect('/fornecedor/painel')`.
- **Controller real:** `src/app/(main)/fornecedor/painel/page.tsx`.
- O controller **não guarda os dados em `useState` local** — só `activeTab` é `useState`; dados e mutações vêm de `useMarket()`.
- Guarda de auth: `useAuth()` (client-side) — se `!loading && !user`, `router.push('/login?redirect=/fornecedor/painel')`. Hooks são sempre chamados antes de qualquer early return (comentário explícito no código — não reordenar).
- Hero com 3 contadores clicáveis (Diretos aguardando / Ofertas aguardando / Entregas em andamento) que trocam `activeTab`, mais um link `Link href="/mercado"` para o domínio de mercado.
- Tabs via `@/components/ui/tabs` — sempre `<Tabs className="flex-col">` (ver `Skill(ui-system)`).

---

## Regras de negócio

**Pedidos Diretos (`PedidosDiretosTab`):**
- Filtro local: `todos` (exclui cancelados) / `aguardando` / `confirmados`.
- Ações via `useMarket()`: `handleConfirmarDireto` / `handleRecusarDireto`.

**Ofertas de Mercado (`OfertasMercadoTab`):**
- É uma view de **acompanhamento** das ofertas já enviadas (`useMarket().offers`), com filtros `todas/aguardando/aceitas/recusadas/expiradas`.
- **Não** contém o formulário de envio de oferta — isso acontece em `/mercado`, fora deste domínio.

**Logística (`LogisticaTab`) — conceito novo, sem equivalente na versão antiga:**
- Une `offers` com `status === 'aceita'` e `directOrders` com `status === 'confirmado'` numa lista só.
- Stepper de despacho: `Aceito → Em preparo → Despachado → Entregue`; pula "Em preparo" quando `deliveryType.kind === 'delivery'` (entrega expressa).
- Avança via `useMarket().handleAtualizarDespacho(id, 'market'|'direct', status)`.

---

## Pitfalls críticos

**`timeAgo()` causa hydration mismatch** (continua válido, usado em `DirectOrderCard`, `OfertasMercadoTab`, `LogisticaTab`):
```tsx
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

**Hooks antes de early return:** o controller chama `useState`/`useMarket`/`useEffect` sempre na mesma ordem, antes dos `if (loading) return ...` / `if (!user) return null`. Não mover chamadas de hook para depois de um early return.

**Acoplamento cross-domain via Context:** `src/components/minha-conta/OrderCard.tsx` (domínio comprador) importa `useMarket` para chamar `cancelDirectOrder` quando cancela um pedido do `sup-001`. Mudar a shape de `MarketContextValue` pode quebrar o domínio comprador — invoque `Skill(risk-zone-protocol)`.

**`src/contexts/` é zona de risco não documentada no `risk-zone-protocol.md` original** — `MarketProvider`, `OrdersProvider`, `CartProvider`, `AuthProvider` são todos montados no `layout.tsx` raiz e compartilhados entre domínios, exatamente como `src/lib/`.

---

## Arquivos que este agente PODE tocar

```
✅ src/components/fornecedor/**
✅ src/app/(main)/fornecedor/**
✅ src/lib/supplier-mock.ts          (cautela: também usado por /mercado — invoke risk-zone-protocol)
✅ src/lib/market-utils.ts           (cautela: também usado por /mercado — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**              — primitivos compartilhados
❌ src/components/minha-conta/**     — domínio do comprador
❌ src/components/catalogo/**        — domínio do catálogo
❌ src/components/mercado/**         — domínio de mercado (rota /mercado, fora do escopo desta skill)
❌ src/contexts/**                   — providers compartilhados (Market/Orders/Cart/Auth)
❌ tailwind.config.ts                — configuração global
❌ src/app/(main)/layout.tsx         — layout raiz
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
