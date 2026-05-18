---
name: domain-fornecedor
description: Contexto completo do painel do fornecedor — tipos, componentes, rotas, regras de negócio e arquivos permitidos
---

# Domain: Painel do Fornecedor

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/fornecedor/` ou `src/app/(main)/fornecedor/`.

---

## Camada de dados

**Arquivo:** `src/lib/supplier-mock.ts`

**Tipos exportados:**
```typescript
MockSupplier        // perfil da empresa (razão social, CNPJ, marcas, UFs)
MarketOrder         // pedido de cotação do mercado
MarketOrderStatus   // 'aberto' | 'ofertado' | 'encerrado'
DirectOrder         // pedido de compra direta
DirectOrderStatus   // 'aguardando' | 'confirmado' | 'cancelado'
SupplierOffer       // oferta enviada pelo fornecedor
OfferStatus         // 'enviada' | 'aceita' | 'recusada' | 'expirada'
```

**Constantes exportadas:**
```typescript
MOCK_SUPPLIER        // MockSupplier — dados do fornecedor logado
MOCK_MARKET_ORDERS   // MarketOrder[] — pedidos visíveis no Mercado
MOCK_DIRECT_ORDERS   // DirectOrder[] — pedidos de compra direta
MOCK_OFFERS          // SupplierOffer[] — ofertas enviadas por este fornecedor
```

**Helpers exportados:**
```typescript
formatPrice(cents: number): string   // 31200 → "R$ 312,00"
formatDate(iso: string): string      // ISO → dd/mm/yyyy pt-BR
timeAgo(iso: string): string         // ISO → "há 2h", "há 3 dias"
maskCnpj(cnpj: string): string       // "12.456.789/0001-00" → "***.456.789/0001-**"
```

---

## Componentes

```
src/components/fornecedor/
  MercadoTab.tsx          ← marketplace de cotações abertas; filtros Todos/Já ofertei
  MarketOrderCard.tsx     ← card de pedido de cotação (apresentacional)
  EnviarOfertaModal.tsx   ← modal: preço + cálculo por unidade em tempo real, prazo, obs
  PedidosDiretosTab.tsx   ← lista de pedidos diretos; ações Confirmar/Recusar
  DirectOrderCard.tsx     ← card de pedido direto (apresentacional)
  MinhasOfertasTab.tsx    ← acompanhamento de ofertas; filtro Pendentes/Aceitas/Recusadas
  OfertaCard.tsx          ← card de oferta enviada (apresentacional)
  HistoricoTab.tsx        ← view unificada de pedidos + cotações finalizados
  PerfilTab.tsx           ← dados empresa, marcas representadas, UFs de cobertura
```

---

## Rota e arquitetura

- **Controller:** `src/app/(main)/fornecedor/page.tsx`
- `page.tsx` gerencia todo o `useState` e passa dados + handlers como props para as tabs
- Hero no topo com 3 métricas clicáveis (Diretos aguardando / Mercado aberto / Ofertas enviadas) que navegam para a tab correspondente
- Tabs usam `@base-ui/react` — sempre `<Tabs className="flex-col">`
- Tabs não têm estado próprio (exceto filtros internos); cards são puramente apresentacionais

---

## Regras de negócio

**Mercado (cotação competitiva):**
- Pedidos de cotação de TODOS os compradores aparecem aqui para TODOS os fornecedores
- Fornecedor pode: "Enviar oferta" (abre EnviarOfertaModal) ou "Não concorro" (oculta o card localmente hoje)
- `offeredByMe: true` indica que este fornecedor já enviou oferta neste pedido

**Pedidos Diretos:**
- Chegam SOMENTE para este fornecedor (comprador escolheu do catálogo)
- Ações disponíveis: Confirmar ou Recusar
- Não há concorrência — o fornecedor já está determinado pelo catálogo

**Minhas Ofertas:**
- Rastreia `MOCK_OFFERS` — histórico de ofertas enviadas com status atualizado
- Filtros: Pendentes (enviada), Aceitas (aceita), Recusadas (recusada + expirada)

---

## Pitfalls críticos

**timeAgo() causa hydration mismatch:**
```tsx
// SEMPRE usar suppressHydrationWarning em spans com timeAgo
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

**EnviarOfertaModal usa Select do base-ui:**
```tsx
// onValueChange retorna string | null — sempre null-coalesce
<Select onValueChange={(v) => setPrazo(v ?? '')}>
```

---

## Arquivos que este agente PODE tocar

```
✅ src/components/fornecedor/**
✅ src/app/(main)/fornecedor/**
✅ src/lib/supplier-mock.ts        (cautela: arquivo compartilhado — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**            — primitivos compartilhados
❌ src/components/minha-conta/**   — domínio do comprador
❌ src/components/catalogo/**      — domínio do catálogo
❌ tailwind.config.ts              — configuração global
❌ src/app/(main)/layout.tsx       — layout raiz
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
