# Painel do Fornecedor — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar a área privada do fornecedor em `/fornecedor` com painel de gestão de pedidos diretos, marketplace de cotações, acompanhamento de ofertas e configuração de perfil da empresa.

**Architecture:** Single-page com controller em `page.tsx` (useState), tabs gerenciadas via componente `Tabs` existente, dados mockados em `supplier-mock.ts`. Segue o mesmo padrão arquitetural de `/minha-conta`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS v3, tokens de design existentes, Sonner (toasts), Lucide icons, componentes shadcn/base-ui existentes.

---

## Contexto de negócio

A plataforma opera com dois fluxos de compra distintos:

### Compra Direta
- Comprador navega no Catálogo, adiciona produto ao carrinho e finaliza a compra
- Cada produto no catálogo está vinculado a um fornecedor específico com preço fixo
- O pedido vai **somente** para aquele fornecedor — sem concorrência
- Fornecedor vê o pedido e confirma ou recusa

### Cotação (Leilão)
- Comprador cria um pedido de cotação em "Minha Conta" especificando produto + quantidade
- O pedido aparece para **todos** os fornecedores na aba Mercado
- Cada fornecedor pode enviar uma oferta (preço total + prazo) ou declinar
- Comprador escolhe a melhor oferta e aceita — os demais são automaticamente recusados

### Fora deste spec (specs futuros)
- Lógica de fila/leilão do Mercado (backend: timestamps, locks, concorrência)
- Cadastro de produtos no catálogo pelo fornecedor
- Pedidos preferenciais (comprador repete pedido → vinculado ao mesmo fornecedor)

---

## Estrutura de arquivos

```
src/app/(main)/fornecedor/
  page.tsx                        ← controller principal (useState, handlers)

src/components/fornecedor/
  MercadoTab.tsx                  ← lista de cotações abertas no marketplace
  PedidosDiretosTab.tsx           ← pedidos de compra direta do catálogo
  MinhasOfertasTab.tsx            ← ofertas enviadas pelo fornecedor + status
  HistoricoTab.tsx                ← pedidos finalizados/cancelados
  PerfilTab.tsx                   ← dados da empresa, marcas e cobertura
  EnviarOfertaModal.tsx           ← modal: preço + prazo + observação opcional
  MarketOrderCard.tsx             ← card de cotação no Mercado
  DirectOrderCard.tsx             ← card de pedido direto
  OfertaCard.tsx                  ← card de oferta enviada

src/lib/
  supplier-mock.ts                ← tipos TypeScript + dados mock do fornecedor
```

---

## Modelo de dados (`supplier-mock.ts`)

```typescript
// Fornecedor logado (mock)
export interface MockSupplier {
  name: string          // razão social
  cnpj: string          // ex: '12.456.789/0001-00'
  email: string
  phone: string
  brands: string[]      // marcas que trabalha: ['Pampers', 'Huggies', ...]
  states: string[]      // UFs cobertas: ['SP', 'RJ']
  cities?: string[]     // cidades opcionais
  ceps?: string[]       // CEPs específicos de cobertura
  rating: number        // 1–5
  memberSince: string   // ex: 'mar/2025'
}

// Pedido de cotação visível no Mercado (de qualquer comprador)
export type MarketOrderStatus = 'aberto' | 'ofertado' | 'encerrado'

export interface MarketOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  buyerCity: string
  buyerState: string
  createdAt: string       // ISO 8601
  totalOffers: number     // quantas ofertas já recebeu (de todos os fornecedores)
  offeredByMe: boolean    // este fornecedor já enviou oferta?
  myOffer?: {             // presente se offeredByMe = true
    price: number         // centavos
    deliveryDays: number
    note?: string
  }
  status: MarketOrderStatus
}

// Pedido de compra direta (vindo do catálogo, destinado a este fornecedor)
export type DirectOrderStatus = 'aguardando' | 'confirmado' | 'cancelado'

export interface DirectOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  price: number           // centavos — preço total já definido pelo catálogo
  buyerCity: string
  buyerState: string
  createdAt: string
  status: DirectOrderStatus
}

// Oferta enviada pelo fornecedor (cotação)
export type OfferStatus = 'enviada' | 'aceita' | 'recusada' | 'expirada'

export interface SupplierOffer {
  id: string
  orderId: string
  product: string         // snapshot do pedido
  quantity: number
  unit: string
  buyerCity: string
  buyerState: string
  price: number           // centavos — preço total ofertado
  deliveryDays: number
  note?: string
  status: OfferStatus
  createdAt: string
}

export const MOCK_SUPPLIER: MockSupplier = { ... }
export const MOCK_MARKET_ORDERS: MarketOrder[] = [ ... ]   // ~6 pedidos variados
export const MOCK_DIRECT_ORDERS: DirectOrder[] = [ ... ]   // ~3 pedidos variados
export const MOCK_OFFERS: SupplierOffer[] = [ ... ]        // ~5 ofertas com status variados
```

---

## Página principal (`page.tsx`)

### Estado gerenciado
```typescript
const [activeTab, setActiveTab] = useState<TabKey>('pedidos-diretos')
const [marketOrders, setMarketOrders] = useState<MarketOrder[]>(MOCK_MARKET_ORDERS)
const [directOrders, setDirectOrders] = useState<DirectOrder[]>(MOCK_DIRECT_ORDERS)
const [offers, setOffers] = useState<SupplierOffer[]>(MOCK_OFFERS)
const [ofertaModalOrder, setOfertaModalOrder] = useState<MarketOrder | null>(null)
const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set())

type TabKey = 'pedidos-diretos' | 'mercado' | 'minhas-ofertas' | 'historico' | 'perfil'
```

### Handlers
- `handleEnviarOferta(orderId, price, deliveryDays, note?)` — marca `offeredByMe = true` no MarketOrder, cria SupplierOffer com status `'enviada'`, fecha modal, toast de sucesso
- `handleDeclineMercado(orderId)` — adiciona o `orderId` a um Set local `declinedIds`; o MarketOrder permanece no array mas é filtrado da renderização; toast informativo. O pedido não é deletado do sistema — apenas oculto para este fornecedor.
- `handleConfirmarDireto(orderId)` — muda status do DirectOrder para `'confirmado'`, toast de sucesso
- `handleRecusarDireto(orderId)` — muda status para `'cancelado'`, toast

### Hero — métricas rápidas
Três botões-stat clicáveis que navegam para a tab correspondente:
- **Diretos** (laranja) → count de DirectOrders com status `'aguardando'`
- **No Mercado** (azul) → count de MarketOrders abertos sem oferta minha
- **Ofertas enviadas** (verde) → count de SupplierOffers com status `'enviada'`

---

## Tabs

### Tab: Pedidos Diretos (padrão ao abrir)
- **Filtros:** Todos · Aguardando · Confirmados
- **Cards (`DirectOrderCard`):**
  - Badge de tipo: `COMPRA DIRETA` (laranja)
  - Produto, quantidade, preço total, cidade/estado, tempo relativo
  - Status badge: Aguardando (amarelo) / Confirmado (verde) / Cancelado (vermelho)
  - Ações quando `aguardando`: botão "Confirmar pedido" (verde, flex:1) + "Recusar" (cinza, flex fixo)
  - Sem ações quando `confirmado` ou `cancelado`
- **Empty state:** ícone + "Nenhum pedido direto no momento"

### Tab: Mercado
- **Filtros:** Todos · Já ofertei
- **Cards (`MarketOrderCard`):**
  - Badge: `COTAÇÃO` (azul)
  - Produto, quantidade, cidade/estado, tempo relativo
  - Contador de ofertas recebidas (de todos os fornecedores)
  - **Se `offeredByMe = false`:** botão "✏️ Enviar oferta" (laranja, flex:1) + "✕ Não concorro" (cinza, flex fixo)
  - **Se `offeredByMe = true`:** card com fundo azul-claro, badge "✓ Oferta enviada" com preço e prazo, linha "Aguardando decisão do comprador…" — sem ações
  - Clique em "✕ Não concorro": remove o pedido da lista local (mock) + toast + registra declínio
- **Empty state:** ícone + "Nenhuma cotação aberta no momento"

### Tab: Minhas Ofertas
- **Filtros:** Todas · Pendentes · Aceitas · Recusadas
- **Cards (`OfertaCard`):**
  - Produto, quantidade, cidade/estado
  - Preço ofertado + prazo
  - Status badge: Pendente (amarelo) / Aceita (verde) / Recusada (vermelho esmaecido) / Expirada (cinza)
  - Mensagem contextual: aceita → "Comprador aceitou sua oferta — pedido confirmado!"; recusada → "Comprador escolheu outra oferta"
  - Cards recusados/expirados com `opacity-70`
- **Empty state:** ícone + "Você ainda não enviou ofertas"

### Tab: Histórico
- Combina duas fontes: DirectOrders com status `confirmado`/`cancelado` + SupplierOffers com status `aceita`/`recusada`/`expirada`
- **Filtros:** Todos · Entregues · Cancelados
- Cards compactos: badge de origem (COTAÇÃO azul / COMPRA DIRETA laranja), produto, quantidade, valor, data, status
- Ordenado por data mais recente
- **Empty state:** ícone + "Nenhum pedido no histórico ainda"

### Tab: Perfil
Três blocos separados por divisor:

**Dados da empresa**
- Grid 2 colunas: razão social, CNPJ (mascarado: `***.456.789/0001-**`), e-mail, telefone

**Marcas que trabalho**
- Chips azuis para cada marca cadastrada
- Chip tracejado "+ adicionar" (toast "em breve" por ora)

**Área de cobertura**
- Chips de estados (UFs): SP, RJ, MG...
- Campo separado para CEPs específicos listados em texto
- Chip tracejado "+ estado" e "+ CEP" (toast "em breve" por ora)

**Rodapé:** botão "✏️ Editar perfil" (borda azul) → toast "Edição de perfil em breve"

---

## Modal: Enviar Oferta (`EnviarOfertaModal`)

Acionado pelo botão "Enviar oferta" no Mercado.

**Campos:**
- Cabeçalho: produto + quantidade do pedido (read-only)
- `Preço total (R$)` — input numérico; abaixo mostra cálculo automático "≈ R$ X,XX por unidade"
- `Prazo de entrega` — select: 1 dia útil / 2 dias / 3 dias / 5 dias / 7 dias / A combinar
- `Observação (opcional)` — textarea livre

**Validação:** preço > 0 e prazo selecionado para habilitar o botão "Enviar oferta →"

**Submit:** chama `handleEnviarOferta`, fecha modal, toast "Oferta enviada com sucesso!"

---

## Design tokens aplicados

| Elemento | Token |
|---|---|
| Badge COTAÇÃO | `text-primary-dark bg-primary-light` |
| Badge COMPRA DIRETA | `text-accent bg-accent/10` |
| Botão Enviar oferta | `bg-accent text-white hover:bg-accent-dark` |
| Botão Não concorro / Recusar | `bg-slate-100 text-brand-muted hover:bg-slate-200` |
| Botão Confirmar pedido | `bg-green-600 text-white hover:bg-green-700` |
| Card ofertado | `bg-primary-light border-primary/30` |
| Status Aceita | `bg-green-100 text-green-700` |
| Status Pendente | `bg-amber-100 text-amber-800` |
| Status Recusada | `bg-red-100 text-red-700` |
| Hero stats Diretos | `text-accent` |
| Hero stats Mercado | `text-primary-dark` |
| Hero stats Ofertas | `text-green-600` |

---

## Dados mock mínimos necessários

**`MOCK_MARKET_ORDERS`** — 6 pedidos:
- 3 sem oferta minha (status aberto)
- 2 com `offeredByMe = true` (status ofertado)
- 1 encerrado (para o Histórico)

**`MOCK_DIRECT_ORDERS`** — 4 pedidos:
- 2 aguardando confirmação
- 1 confirmado
- 1 cancelado

**`MOCK_OFFERS`** — 5 ofertas:
- 1 aceita
- 2 enviadas/pendentes
- 1 recusada
- 1 expirada
