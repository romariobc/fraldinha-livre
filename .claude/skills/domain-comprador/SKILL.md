---
name: domain-comprador
description: Contexto completo da área do comprador — tipos, componentes, rotas, regras de negócio e arquivos permitidos
---

# Domain: Área do Comprador (Minha Conta)

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/minha-conta/` ou `src/app/(main)/minha-conta/`.

> Revisado a partir do código real em 2026-07-23. A versão anterior descrevia `OfertasTab.tsx` e `NovoPedidoModal.tsx`, que não existem — o fluxo de criar cotação migrou para o domínio catálogo (`OfferModal` em `src/components/catalogo/`).

---

## Camada de dados

**Arquivo:** `src/lib/account-mock.ts` — só os **tipos** e o seed inicial; o controller não lê `INITIAL_ORDERS` diretamente.

**Tipos exportados:**
```typescript
OrderType     // 'cotacao' | 'compra-direta'
OrderStatus   // 'aguardando' | 'ofertas-recebidas' | 'aceito' | 'confirmado'
              //   | 'a-caminho' | 'entregue' | 'cancelado'
Address       // { logradouro, numero, complemento?, bairro, cidade, estado, cep }
MockUser      // { name, email, cpf, address: Address } — hoje só usado como fallback de endereço em BuyModal (domínio catálogo)
Order         // { id, type, product, quantity, unit, deliveryAddress, status, createdAt,
              //   price?, supplierId?, supplierName?, offers?, items?: OrderItem[] }
```
`Order.items` (de `src/lib/order-items.ts`) é a representação canônica das linhas do pedido; use `getOrderItems(order)` para ler — ele faz fallback para pedidos antigos sem `items`.

**Perfil real do usuário logado não é `MOCK_USER`** — vem de `useAuth().profile` (`src/contexts/auth-context.tsx`), editável via `updateProfile()`.

---

## Estado (Context, não `useState(INITIAL_ORDERS)`)

**Arquivo:** `src/contexts/orders-context.tsx` — `useOrders()`:
```typescript
{ orders, loading, error, createDirectOrder, createOrdersFromCart, cancelOrder }
```
Internamente usa um repositório (`MockOrderRepository` ou `HttpOrderRepository`, escolhido por `NEXT_PUBLIC_USE_BACKEND`) — a lista de pedidos já não é o array estático `INITIAL_ORDERS` mutado localmente. `createDirectOrder` está marcado no código como código morto ("sem chamador em produção... NÃO MEXER, fora de escopo").

---

## Componentes

```
src/components/minha-conta/
  PedidosTab.tsx        ← pedidos ativos (status != entregue/cancelado)
  HistoricoTab.tsx      ← pedidos finalizados (entregue ou cancelado), ordenados por data desc
  PerfilTab.tsx         ← visualização + edição do perfil (nome, CPF, telefone, endereço) via useAuth()
  OrderCard.tsx         ← card de pedido; prop `mode: 'pedidos' | 'historico'` muda o rodapé exibido
```

Não existem `OfertasTab.tsx` nem `NovoPedidoModal.tsx`. Pedidos `type: 'cotacao'` continuam existindo no tipo `Order`, mas não há mais uma tela dedicada dentro de `minha-conta` para acompanhá-los separadamente nem para criá-los — eles aparecem misturados em `PedidosTab`/`HistoricoTab` como qualquer outro pedido.

---

## Rota e arquitetura

- **Controller:** `src/app/(main)/minha-conta/page.tsx`, envolto em `<Suspense>` (usa `useSearchParams`).
- Tab inicial lida da URL: `?tab=pedidos|historico|perfil`.
- `?returnTo=` é repassado para `PerfilTab` — usado quando o comprador é redirecionado do catálogo por perfil incompleto (ver `Skill(domain-catalogo)`, RN-06).
- Guarda de auth idêntica ao painel do fornecedor: `useEffect` com `router.push('/login?redirect=/minha-conta')` se `!loading && !user`, hooks sempre antes de early return.
- Tabs: `pedidos` / `historico` / `perfil` (3, não 4) — `<Tabs className="flex-col">` (ver `Skill(ui-system)`).

---

## Regras de negócio

**Pedidos (Compra Direta e Cotação, tratados juntos):**
- `PedidosTab` mostra tudo que não é `entregue`/`cancelado`; `HistoricoTab` mostra o resto.
- `OrderCard` calcula `statusLabel` de forma type-aware: `status: 'aguardando'` em `compra-direta` mostra "Aguardando confirmação"; em `cotacao` usa o label padrão ("Aguardando ofertas").
- Cancelamento (`canCancel`): só em `mode="pedidos"`, `status === 'aguardando'` e `type === 'compra-direta'`. Chama `useOrders().cancelOrder(id)` e, se `order.supplierId === 'sup-001'`, também `useMarket().cancelDirectOrder(id)` — acoplamento direto com o contexto do domínio fornecedor.

**Criar cotação:** não acontece mais em `minha-conta`. O fluxo de "pedir oferta" está em `src/components/catalogo/OfferModal.tsx` (domínio catálogo).

---

## Pitfalls críticos

**`OrderCard` cruza para o domínio fornecedor:** importa `useMarket` de `src/contexts/market-context.tsx` para `cancelDirectOrder`. Se for alterar a shape do `MarketContextValue`, verifique este uso primeiro — invoke `Skill(risk-zone-protocol)`.

**`timeAgo()` não é usado neste domínio hoje** (`OrderCard` usa um `formatDate` local, não o `timeAgo` de `supplier-mock.ts`) — a nota de hydration mismatch da versão anterior desta skill não se aplica aqui.

---

## Arquivos que este agente PODE tocar

```
✅ src/components/minha-conta/**
✅ src/app/(main)/minha-conta/**
✅ src/lib/account-mock.ts        (cautela: tipos compartilhados com outros domínios — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**            — primitivos compartilhados
❌ src/components/fornecedor/**    — domínio do fornecedor
❌ src/components/catalogo/**      — domínio do catálogo
❌ src/contexts/**                 — providers compartilhados (Orders/Market/Auth/Cart)
❌ tailwind.config.ts              — configuração global
❌ src/app/(main)/layout.tsx       — layout raiz
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
