@AGENTS.md

---

# Fraldinha Livre — Guia de Onboarding

Marketplace B2B de fraldas e produtos de higiene infantil. Conecta compradores (clínicas, revendedores, atacadistas) a fornecedores/distribuidoras via dois fluxos distintos: **compra direta do catálogo** e **cotação competitiva (leilão)**.

---

## Stack técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.4 |
| Linguagem | TypeScript | ^5 |
| Estilos | Tailwind CSS | ^3.4.19 |
| Componentes base | `@base-ui/react` | ^1.4.1 |
| Toasts | Sonner | ^2.0.7 |
| Ícones | Lucide React | ^1.14.0 |

> **Atenção:** `@base-ui/react` **não é Radix UI**. As APIs diferem. Em especial: o componente `Tabs` usa `data-orientation="horizontal"` (não `data-horizontal`). Sempre adicione `className="flex-col"` na raiz do `<Tabs>` para evitar renderização lado-a-lado.

---

## Estrutura de rotas

```
src/app/(main)/
  page.tsx              ← Landing page (homepage)
  layout.tsx            ← Layout compartilhado com Header + Footer
  catalogo/             ← Catálogo de produtos (browsing + filtros)
  minha-conta/          ← Área do comprador (pedidos, cotações, perfil)
  fornecedor/           ← Área do fornecedor (painel de gestão)
  contato/              ← Página de contato
```

---

## Estrutura de componentes

```
src/components/
  Header.tsx            ← Navbar responsivo com ícone de carrinho (login-guarded)
  Footer.tsx
  WaveDivider.tsx       ← Divisor SVG de seção com gradiente configurável
  FaqAccordion.tsx

  ui/                   ← Primitivos shadcn/base-ui (button, dialog, tabs, select…)

  catalogo/
    ProductCard.tsx
    CatalogFilters.tsx
    Pagination.tsx
    OfferModal.tsx

  minha-conta/          ← Área do comprador
    PedidosTab.tsx
    OfertasTab.tsx
    HistoricoTab.tsx
    OrderCard.tsx
    PerfilTab.tsx
    NovoPedidoModal.tsx

  fornecedor/           ← Área do fornecedor
    MarketOrderCard.tsx
    DirectOrderCard.tsx
    OfertaCard.tsx
    EnviarOfertaModal.tsx
    MercadoTab.tsx
    PedidosDiretosTab.tsx
    MinhasOfertasTab.tsx
    HistoricoTab.tsx
    PerfilTab.tsx
```

---

## Camada de dados

```
src/lib/
  products.ts           ← Mock do catálogo de produtos
  account-mock.ts       ← Mock de dados do comprador (pedidos, cotações)
  auth-mock.ts          ← Mock de autenticação (IS_LOGGED_IN flag)
  supplier-mock.ts      ← Mock do fornecedor (tipos + helpers + dados)
  utils.ts              ← Utilitários gerais (cn, etc.)
```

### `supplier-mock.ts` — tipos principais

```typescript
MockSupplier       // perfil do fornecedor (razão social, CNPJ, marcas, UFs)
MarketOrder        // pedido de cotação visível no Mercado (status: aberto | ofertado | encerrado)
DirectOrder        // pedido de compra direta (status: aguardando | confirmado | cancelado)
SupplierOffer      // oferta enviada pelo fornecedor (status: enviada | aceita | recusada | expirada)

// Helpers exportados:
formatPrice(cents)  // 31200 → "R$ 312,00"
formatDate(iso)     // ISO → dd/mm/yyyy pt-BR
timeAgo(iso)        // ISO → "há 2h", "há 3 dias"
maskCnpj(cnpj)      // "12.456.789/0001-00" → "***.456.789/0001-**"
```

---

## Design tokens (Tailwind)

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#5BBFEA` | Azul primário (cotações, links) |
| `primary-dark` | `#2A9FD4` | Azul escuro (badges, textos de destaque) |
| `primary-light` | `#E8F6FD` | Fundo azul suave (cards ofertados) |
| `accent` | `#F5A623` | Laranja (CTAs, compra direta) |
| `accent-dark` | `#D4891A` | Laranja escuro (hover) |
| `brand-text` | `#1A2E3B` | Texto principal |
| `brand-muted` | `#5A7385` | Texto secundário |
| `brand-bg` | `#F0F8FD` | Fundo de seções |
| `rounded-card` | `16px` | Border-radius padrão de cards |
| `shadow-card` | azul suave | Sombra padrão de cards |

**Fontes:**
- `font-display` → Nunito (títulos, botões, badges)
- `font-body` / padrão → Inter (textos corridos)

**Container:** Use sempre `container-fl` (classe utilitária customizada) em vez de `container` padrão do Tailwind.

---

## Padrão arquitetural das páginas

Todas as páginas de área privada seguem o mesmo padrão:

```
page.tsx (controller)
  └── useState para dados + handlers
  └── Hero com métricas rápidas
  └── <Tabs className="flex-col"> com TabsList + TabsContent
        └── TabComponents (recebem dados + callbacks como props)
              └── Cards (puramente apresentacionais)
```

- **Sem backend ainda** — todos os dados são mock em `src/lib/`
- **`page.tsx`** gerencia todo o estado (`useState`) e passa handlers como props para baixo
- **Tabs** são componentes isolados sem estado próprio (exceto filtros internos)
- **Cards** são puramente apresentacionais, sem lógica de negócio

---

## Fluxos de negócio

### Compra Direta
Comprador navega no Catálogo → adiciona ao carrinho → finaliza compra. Cada produto está vinculado a um único fornecedor com preço fixo. O pedido vai **somente** para aquele fornecedor. O fornecedor confirma ou recusa na aba **Pedidos Diretos**.

### Cotação (Leilão)
Comprador cria um pedido de cotação em **Minha Conta** especificando produto + quantidade. O pedido aparece para **todos os fornecedores** na aba **Mercado**. Cada fornecedor pode enviar uma oferta (preço + prazo) ou declinar. O comprador escolhe a melhor oferta — os demais são recusados automaticamente.

---

## Armadilhas conhecidas

### `timeAgo()` causa hydration mismatch
`timeAgo()` usa `Date.now()` e produz texto diferente no SSR vs. cliente. Sempre use `suppressHydrationWarning` nos spans que renderizam tempo relativo:
```tsx
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

### `@base-ui/react` Tabs — `className` não `data-horizontal`
A variante `data-horizontal:flex-col` do Tailwind **não funciona** porque o base-ui emite `data-orientation="horizontal"`, não `data-horizontal`. Use diretamente:
```tsx
<Tabs className="flex-col">
```

### `Select.onValueChange` retorna `string | null`
O base-ui `Select` passa `(value: string | null, ...)` no `onValueChange`. Use null-coalescing:
```tsx
onValueChange={(v) => setState(v ?? '')}
```

### Mock data com datas relativas ao módulo load
As datas em `MOCK_MARKET_ORDERS` e `MOCK_DIRECT_ORDERS` são computadas uma vez no import (`new Date(Date.now() - N * 3600000)`). Em sessões longas de dev, os tempos relativos ficam desatualizados — comportamento esperado para mock.

---

## Estado atual do projeto (maio/2026)

### Implementado ✅

**Landing page**
- Hero com CTA, seção de marcas como nuvens flutuantes animadas (sky gradient, `cloud-float` keyframe)
- WaveDivider entre seções, FAQ accordion, Footer

**Header**
- Navbar responsivo (mobile hamburger)
- Ícone de carrinho com guarda de login: redireciona para `/login` com toast se não autenticado

**Catálogo** (`/catalogo`)
- Grid de produtos com filtros e paginação
- Modal de cotação (OfferModal)

**Minha Conta** (`/minha-conta`) — área do comprador
- Tabs: Pedidos, Cotações, Histórico, Perfil
- Fluxo de criação de novo pedido de cotação (NovoPedidoModal)

**Painel do Fornecedor** (`/fornecedor`)
- Hero com 3 métricas clicáveis (Diretos / Mercado / Ofertas enviadas)
- **Tab Pedidos Diretos:** lista de pedidos do catálogo, ações Confirmar/Recusar
- **Tab Mercado:** marketplace de cotações abertas, filtros Todos/Já ofertei, botões "Enviar oferta" e "Não concorro"
- **Tab Minhas Ofertas:** acompanhamento de ofertas enviadas (Pendentes/Aceitas/Recusadas)
- **Tab Histórico:** view unificada de pedidos diretos + cotações finalizadas
- **Tab Perfil:** dados da empresa, marcas e área de cobertura (UFs + CEPs)
- **Modal Enviar Oferta:** preço com cálculo por unidade em tempo real, select de prazo, observação

### Não implementado / próximos passos 🔜

| Área | O que falta |
|---|---|
| Autenticação | Auth real (JWT / session). Hoje `IS_LOGGED_IN = false` em `auth-mock.ts` |
| Backend | API Routes ou servidor externo. Hoje tudo é mock local |
| Catálogo do fornecedor | Fluxo de cadastro de produtos pelo fornecedor |
| Lógica de leilão | Fila com timestamps, locks, concorrência — o "✕ Não concorro" só oculta localmente |
| Pedidos preferenciais | Comprador repete pedido → vinculado ao mesmo fornecedor |
| Notificações | Push/email quando pedido chega ou oferta é aceita |
| Pagamento | Integração com gateway |
| Admin | Painel administrativo da plataforma |

### Desafios superados 🧩

**Hydration mismatch com tempo relativo**
`timeAgo()` gera valores diferentes no SSR e no cliente. Solução: `suppressHydrationWarning` nos spans de tempo. Não use `useEffect` + `useState` para isso — é overhead desnecessário para texto secundário.

**`@base-ui/react` vs Radix UI**
O projeto usa `@base-ui/react`, não Radix. As APIs são similares mas divergem em atributos de dados (`data-orientation` vs `data-horizontal`) e assinaturas de callbacks. Ler `src/components/ui/tabs.tsx` antes de escrever qualquer coisa com Tabs.

**Arquitetura de dois fluxos (Direta vs Cotação)**
O modelo mental inicial confundia os dois fluxos. A separação clara está no spec em `docs/superpowers/specs/2026-05-13-fornecedor-design.md`: compra direta nunca tem concorrência — o fornecedor já está determinado pelo catálogo.

**Nuvens animadas sem z-index correto**
Elementos `absolute` nas "bolinhas" das nuvens ficavam sobre o texto do nome da marca. Fix: `z-0` nos bumps + `relative z-[1]` no corpo da nuvem. O `filter: drop-shadow()` no pai segue o shape composto corretamente.

---

## Documentação técnica

```
docs/superpowers/
  specs/
    2026-05-13-fornecedor-design.md   ← Design spec completo do painel do fornecedor
  plans/
    2026-05-13-fornecedor.md          ← Plano de implementação (10 tasks, código completo)
```

---

## Infraestrutura

- **Fase atual**: frontend em desenvolvimento, hospedado na Vercel para preview
- **Migração planejada**: ao final da fase de frontend, migrar da Vercel para outra plataforma (a definir pelo cliente). Não criar dependências hard-coded em APIs ou recursos exclusivos da Vercel (ex.: Vercel KV, Edge Config, Image Optimization proprietária, etc.).
