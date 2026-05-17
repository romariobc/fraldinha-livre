# Design: Estrutura de Skills e Contexto para Agentes Paralelos

**Data:** 2026-05-17  
**Status:** Aprovado

---

## Problema

O projeto Fraldinha Livre cresce em complexidade (frontend mock → backend real) e o padrão de trabalho do time é paralelizar por domínio: um agente trabalha no painel do fornecedor enquanto outro trabalha na área do comprador, em worktrees isolados.

Sem contexto focado, cada sub-agente precisa reler o CLAUDE.md inteiro, não sabe quais arquivos pode tocar sem criar conflito, e não tem guia para o momento de conectar frontend ao backend ainda inexistente.

---

## Solução

6 skills em `.claude/skills/` + atualização no `AGENTS.md`.

As skills são arquivos markdown invocáveis via `Skill(nome)`. Sub-agentes em worktrees isolados encontram `.claude/` automaticamente no repo.

---

## Estrutura de arquivos

```
.claude/
  skills/
    domain-fornecedor.md
    domain-comprador.md
    domain-catalogo.md
    ui-system.md
    paralelize.md
    api-contract.md
AGENTS.md                ← atualizado com instrução de auto-invoke
```

---

## Skill 1: `domain-fornecedor.md`

**Propósito:** Contexto completo do painel do fornecedor para agentes que trabalham exclusivamente nesse domínio.

**Conteúdo:**

### Camada de dados
- Arquivo: `src/lib/supplier-mock.ts`
- Tipos: `MockSupplier`, `MarketOrder`, `DirectOrder`, `SupplierOffer`
- Helpers: `formatPrice(cents)`, `formatDate(iso)`, `timeAgo(iso)`, `maskCnpj(cnpj)`
- Constantes exportadas: `MOCK_SUPPLIER`, `MOCK_MARKET_ORDERS`, `MOCK_DIRECT_ORDERS`, `MOCK_OFFERS`
- Status possíveis:
  - `MarketOrder`: `aberto | ofertado | encerrado`
  - `DirectOrder`: `aguardando | confirmado | cancelado`
  - `SupplierOffer` (`OfferStatus`): `enviada | aceita | recusada | expirada`

### Componentes
```
src/components/fornecedor/
  MarketOrderCard.tsx       ← card do mercado de cotações
  DirectOrderCard.tsx       ← card de pedido de compra direta
  OfertaCard.tsx            ← card de oferta enviada
  EnviarOfertaModal.tsx     ← modal com cálculo por unidade em tempo real
  MercadoTab.tsx            ← filtros Todos/Já ofertei + lista
  PedidosDiretosTab.tsx     ← lista de pedidos diretos + ações Confirmar/Recusar
  MinhasOfertasTab.tsx      ← acompanhamento de ofertas (Pendentes/Aceitas/Recusadas)
  HistoricoTab.tsx          ← view unificada diretos + cotações finalizadas
  PerfilTab.tsx             ← dados empresa, marcas, UFs de cobertura
```

### Rota
- Controller: `src/app/(main)/fornecedor/page.tsx`
- Padrão: `page.tsx` gerencia todo `useState` e passa handlers como props para tabs
- Hero com 3 métricas clicáveis que navegam para a tab correspondente

### Regras de negócio
- **Mercado:** pedidos de cotação de todos os compradores aparecem aqui; fornecedor pode "Enviar oferta" ou "Não concorro" (oculta localmente hoje, futuramente persiste)
- **Pedidos Diretos:** chegam somente deste fornecedor; ações: Confirmar ou Recusar
- **Minhas Ofertas:** rastreia o status das ofertas enviadas
- **Histórico:** view somente-leitura de transações finalizadas
- **Perfil:** razão social, CNPJ (mascarado), marcas representadas, UFs de cobertura

### Pitfalls específicos
- `timeAgo()` causa hydration mismatch — sempre `<span suppressHydrationWarning>`
- `EnviarOfertaModal` usa `Select` do base-ui: `onValueChange={(v) => setState(v ?? '')}`

### Arquivos que este agente pode tocar
- ✅ `src/components/fornecedor/**`
- ✅ `src/app/(main)/fornecedor/**`
- ✅ `src/lib/supplier-mock.ts` (com cautela — arquivo compartilhado)
- ❌ `src/components/ui/**` — não modificar sem alinhamento
- ❌ `src/components/minha-conta/**` — domínio do comprador
- ❌ `tailwind.config.ts`, `src/app/(main)/layout.tsx` — infraestrutura compartilhada

---

## Skill 2: `domain-comprador.md`

**Propósito:** Contexto completo da área do comprador para agentes que trabalham nesse domínio.

**Conteúdo:**

### Camada de dados
- Arquivo: `src/lib/account-mock.ts`
- Dados: pedidos do comprador, cotações abertas/fechadas, histórico, perfil

### Componentes
```
src/components/minha-conta/
  PedidosTab.tsx        ← lista de pedidos de compra direta
  OfertasTab.tsx        ← cotações abertas aguardando resposta dos fornecedores
  HistoricoTab.tsx      ← pedidos e cotações finalizados
  PerfilTab.tsx         ← dados do comprador
  OrderCard.tsx         ← card de pedido (apresentacional)
  NovoPedidoModal.tsx   ← criação de pedido de cotação (produto + quantidade)
```

### Rota
- Controller: `src/app/(main)/minha-conta/page.tsx`
- Mesmo padrão: `page.tsx` como controller, tabs recebem dados + callbacks como props

### Regras de negócio
- **Pedidos:** compras diretas do catálogo; vinculadas a um único fornecedor
- **Cotações (Leilão):** comprador cria cotação → aparece no Mercado para todos os fornecedores → comprador escolhe a melhor oferta
- **NovoPedidoModal:** especifica produto + quantidade; ao confirmar, o pedido vai para o Mercado

### Arquivos que este agente pode tocar
- ✅ `src/components/minha-conta/**`
- ✅ `src/app/(main)/minha-conta/**`
- ✅ `src/lib/account-mock.ts` (com cautela)
- ❌ `src/components/fornecedor/**` — domínio do fornecedor
- ❌ `src/components/ui/**`, `tailwind.config.ts` — infraestrutura compartilhada

---

## Skill 3: `domain-catalogo.md`

**Propósito:** Contexto do catálogo de produtos para agentes que trabalham nessa área.

**Conteúdo:**

### Camada de dados
- Arquivo: `src/lib/products.ts`
- Estrutura: lista de produtos com campos produto, marca, fornecedorId, preço, estoque

### Componentes
```
src/components/catalogo/
  ProductCard.tsx       ← card de produto (apresentacional)
  CatalogFilters.tsx    ← filtros de marca, preço, categoria
  Pagination.tsx        ← paginação do grid
  OfferModal.tsx        ← modal para criar cotação a partir de um produto
```

### Rota
- `src/app/(main)/catalogo/page.tsx`
- Fluxo: browse → filtro → clique em produto → OfferModal → cria cotação em `account-mock`

### Arquivos que este agente pode tocar
- ✅ `src/components/catalogo/**`
- ✅ `src/app/(main)/catalogo/**`
- ✅ `src/lib/products.ts`
- ❌ `src/components/ui/**` — infraestrutura compartilhada

---

## Skill 4: `ui-system.md`

**Propósito:** Padrões transversais de UI que se aplicam a todos os domínios.

**Conteúdo:**

### Padrão arquitetural page → tab → card
```
page.tsx (controller)
  └── useState + handlers
  └── Hero com métricas
  └── <Tabs className="flex-col">          ← className obrigatório
        └── <TabsList>
              └── <TabsTrigger value="...">
        └── <TabsContent value="...">
              └── <XxxTab dados={...} onAcao={...} />   ← sem estado próprio
                    └── <XxxCard />                      ← puramente apresentacional
```

### `@base-ui/react` — quirks críticos

**Tabs:**
```tsx
// CORRETO
<Tabs className="flex-col">

// ERRADO — data-orientation="horizontal" não é data-horizontal
<Tabs className="data-horizontal:flex-col">
```

**Select:**
```tsx
// onValueChange recebe string | null — sempre null-coalesce
<Select onValueChange={(v) => setState(v ?? '')}>
```

**Dialog:** fechar via `open` + `onOpenChange` controlados; não usar `defaultOpen`.

### Design tokens
| Token | Valor | Uso |
|---|---|---|
| `primary` | `#5BBFEA` | Azul primário (cotações, links) |
| `primary-dark` | `#2A9FD4` | Badges, textos de destaque |
| `primary-light` | `#E8F6FD` | Fundo de cards ofertados |
| `accent` | `#F5A623` | Laranja (CTAs, compra direta) |
| `accent-dark` | `#D4891A` | Hover de CTAs laranja |
| `brand-text` | `#1A2E3B` | Texto principal |
| `brand-muted` | `#5A7385` | Texto secundário |
| `brand-bg` | `#F0F8FD` | Fundo de seções |

**Tipografia:**
- `font-display` → Nunito (títulos, botões, badges)
- padrão → Inter (textos corridos)

**Container:** sempre `container-fl` (nunca `container` do Tailwind padrão).

**Border-radius:** `rounded-card` = 16px para cards.

### Hydration mismatch
`timeAgo()` usa `Date.now()` — sempre usar em spans com `suppressHydrationWarning`:
```tsx
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```
Não usar `useEffect + useState` para isso.

### Ícones
Biblioteca: `lucide-react`. Tamanho padrão: `size={16}` em badges, `size={20}` em botões.

### WaveDivider
Componente `src/components/WaveDivider.tsx` — divisor SVG entre seções. Aceita `className` para customizar cor do gradiente.

---

## Skill 5: `paralelize.md`

**Propósito:** Guia de orquestração para o agente principal ao decompor trabalho em sub-agentes paralelos.

**Conteúdo:**

### Mapa de conflitos

**🔴 Zona de risco — arquivos compartilhados (um agente por vez):**
```
src/lib/                          ← mocks usados por múltiplos domínios
src/components/ui/                ← primitivos base-ui/shadcn
src/components/Header.tsx
src/components/Footer.tsx
src/components/WaveDivider.tsx
src/app/(main)/layout.tsx
tailwind.config.ts
src/app/globals.css
```

**🟢 Zona segura — um agente por domínio, sem conflito:**
```
src/components/fornecedor/    ← agente fornecedor
src/app/(main)/fornecedor/    ← agente fornecedor
src/components/minha-conta/   ← agente comprador
src/app/(main)/minha-conta/   ← agente comprador
src/components/catalogo/      ← agente catálogo
src/app/(main)/catalogo/      ← agente catálogo
```

### Ordem de merge recomendada
1. Agente que tocou arquivos da zona de risco (lib/, ui/) — merge primeiro
2. Agentes de domínio isolado — podem ser mergeados em qualquer ordem entre si
3. Resolver conflitos em `src/lib/` manualmente se dois agentes adicionaram tipos

### Template de prompt para sub-agente

Todo prompt de sub-agente deve incluir:

```
Você está trabalhando no domínio [fornecedor|comprador|catálogo] do projeto Fraldinha Livre.

1. Invoque Skill(domain-[domínio]) antes de qualquer outra ação.
2. Invoque Skill(ui-system) se for criar ou modificar componentes de UI.
3. Arquivos que você pode tocar: [lista da zona segura do domínio].
4. NÃO modifique: [lista da zona de risco relevante].
5. Tarefa: [descrição concreta da tarefa].
6. Ao terminar, liste todos os arquivos modificados.
```

### Checklist "pronto para disparar?"
- [ ] A tarefa toca apenas arquivos da zona segura deste domínio?
- [ ] Se tocar zona de risco, há outro agente ativo que também toca os mesmos arquivos?
- [ ] O prompt inclui a instrução de invocar a domain skill?
- [ ] O prompt lista explicitamente os arquivos proibidos?

---

## Skill 6: `api-contract.md`

**Propósito:** Fonte da verdade do contrato frontend↔backend. Usada pelo agente que fará a migração de mocks para chamadas reais.

**Conteúdo:**

### Mapa mock → endpoint REST

**Domínio fornecedor (`src/lib/supplier-mock.ts`):**

> Os mocks são constantes somente-leitura. Mutações hoje vivem no `useState` do `page.tsx` — não há funções de mutação nos arquivos de mock.

| Mock atual | Método | Endpoint futuro |
|---|---|---|
| `MOCK_MARKET_ORDERS` | GET | `/api/fornecedor/mercado` |
| `MOCK_DIRECT_ORDERS` | GET | `/api/fornecedor/diretos` |
| `MOCK_OFFERS` | GET | `/api/fornecedor/ofertas` |
| *(useState local)* | POST | `/api/fornecedor/ofertas` (enviar oferta) |
| *(useState local)* | PUT | `/api/fornecedor/diretos/:id` (confirmar/recusar) |
| *(useState local)* | POST | `/api/fornecedor/mercado/:id/declinar` |

**Domínio comprador (`src/lib/account-mock.ts`):**

> `INITIAL_ORDERS` é uma única lista com `type: 'cotacao' | 'compra-direta'`. Separação por tipo é feita via filter no `page.tsx`.

| Mock atual | Método | Endpoint futuro |
|---|---|---|
| `INITIAL_ORDERS` (type: compra-direta) | GET | `/api/comprador/pedidos` |
| `INITIAL_ORDERS` (type: cotacao) | GET | `/api/comprador/cotacoes` |
| `INITIAL_ORDERS` (status: entregue/cancelado) | GET | `/api/comprador/historico` |
| *(useState local)* | POST | `/api/comprador/cotacoes` (criar nova cotação) |
| *(useState local)* | POST | `/api/comprador/cotacoes/:id/aceitar` |

**Catálogo (`src/lib/products.ts`):**
| Mock atual | Método | Endpoint futuro |
|---|---|---|
| lista de produtos | GET | `/api/produtos` |
| produto por id | GET | `/api/produtos/:id` |

### Tipos que cruzam a fronteira
Os tipos hoje definidos nos arquivos de mock migrarão para `src/types/api.ts`. Os principais:
- De `supplier-mock.ts`: `MockSupplier`, `MarketOrder`, `MarketOrderStatus`, `DirectOrder`, `DirectOrderStatus`, `SupplierOffer`, `OfferStatus`
- De `account-mock.ts`: `Order`, `OrderType`, `OrderStatus`, `Offer`, `Address`, `MockUser`
- De `products.ts`: `Product` (verificar shape atual no arquivo)

O arquivo `src/types/api.ts` é a fonte única de verdade de tipos compartilhados. Mock files importam deste arquivo; quando o backend existir, ele também usa esses tipos (via contrato OpenAPI ou shared package).

### Checklist de conexão (para o agente que fizer a migração)
1. Confirmar que o endpoint existe e retorna o tipo definido em `src/types/api.ts`
2. Criar `src/lib/api.ts` com `fetchJson<T>(url, options)` que injeta o Authorization header
3. Para cada domínio, no `page.tsx` controller:
   - Substituir import do mock pela chamada `fetchJson`
   - Adicionar `loading: boolean` e `error: string | null` ao state
   - Renderizar estado de loading (skeleton) e erro (banner) na UI
4. Criar `src/types/api.ts` consolidando os tipos que estavam nos mocks
5. Remover o arquivo de mock do domínio (ou manter como `dev-fallback` com flag `USE_MOCK`)
6. Testar: erro de rede, timeout, resposta 401, resposta 500

### Auth
Quando auth for implementado, o token JWT vai no header:
```
Authorization: Bearer <token>
```
O `fetchJson` em `src/lib/api.ts` deve ler o token do contexto de sessão (Next.js cookies ou localStorage) e injetá-lo automaticamente.

---

## Atualização no `AGENTS.md`

Adicionar seção ao final do `AGENTS.md` atual:

```markdown
## Domain Skills

Sub-agents working on a specific domain MUST invoke the corresponding skill
before taking any action:

| Working in | Invoke |
|---|---|
| `src/components/fornecedor/` or `src/app/(main)/fornecedor/` | `Skill(domain-fornecedor)` |
| `src/components/minha-conta/` or `src/app/(main)/minha-conta/` | `Skill(domain-comprador)` |
| `src/components/catalogo/` or `src/app/(main)/catalogo/` | `Skill(domain-catalogo)` |
| Any UI component or layout work | `Skill(ui-system)` |
| Migrating mocks to real API calls | `Skill(api-contract)` |
```

---

## O que esta estrutura NÃO inclui

- Definições declarativas de agentes (`.claude/agents/`) — não é o mecanismo usado
- Duplicação do CLAUDE.md — as skills complementam com profundidade operacional
- Skills para infraestrutura de auth/pagamento — fora do escopo atual
