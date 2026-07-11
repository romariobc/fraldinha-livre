# S1 — Cart context (estado da sacola)

**Thread:** S (sacola + navegação) · **Depende de:** T1 ✅ (`src/lib/domain/cart.ts`)
**Papel:** subagente SA-Cart (Haiku). Coordenador revisa pelo D-012.
**Breakdown:** `.claude/docs/design/plans/S-sacola-navegacao-breakdown.md`
**Decisões:** D-016 (carrinho canônico), D-017 (agrupar por fornecedor), D-019 (localStorage).

## Objetivo

Criar o **estado da sacola (carrinho)** como um React context, persistido em localStorage, reusando os
helpers puros do domínio (T1). É plumbing de estado: **zero página nova, zero mudança visual** nesta tarefa
(o Provider só é montado no layout). Sem `any`.

## Escopo — arquivos

### 1. CRIAR `src/contexts/cart-context.tsx`  (`'use client'`)
- Importar os tipos/helpers do domínio (NÃO reimplementar):
  `import type { CartItem } from '@/lib/domain/cart'`
  `import { cartSubtotal, groupBySupplier } from '@/lib/domain/cart'`
  `import type { Money } from '@/lib/domain/money'`
- `interface CartContextValue`:
  - `items: CartItem[]`
  - `itemCount: number` — soma das `quantity` de todos os itens
  - `subtotal: Money` — `cartSubtotal(items)` (centavos)
  - `bySupplier: Map<string, CartItem[]>` — `groupBySupplier(items)`
  - `addItem(item: CartItem): void` — se já existe item com **mesmo `productId` E `supplierId`**, SOMA a
    quantity (não duplica linha); senão adiciona. `unitPrice`/nome do item existente são preservados.
  - `removeItem(productId: string, supplierId: string): void`
  - `updateQty(productId: string, supplierId: string, quantity: number): void` — guard: quantity inteiro
    ≥ 1 (se < 1, ignora ou remove — escolha: se `quantity <= 0` remove o item; se não-inteiro, ignora).
  - `clear(): void`
- `CartProvider({ children })`:
  - Estado `useState<CartItem[]>([])`. **Hidratar do localStorage** no mount via `useEffect` (SSR-safe:
    ler `window.localStorage` só dentro do effect; nunca no render inicial, para não quebrar o SSR).
  - **Persistir** em `useEffect([items])` para a chave **`fl.cart.v1`** (JSON.stringify).
    Proteger com try/catch (localStorage pode falhar/estar cheio) — falha silenciosa, não quebrar a UI.
  - Derivados (`itemCount`, `subtotal`, `bySupplier`) calculados a partir de `items` (pode usar `useMemo`).
- `useCart()` — hook que lê o context e lança erro claro se usado fora do `CartProvider`
  (padrão idêntico ao `useOrders` em `src/contexts/orders-context.tsx` — siga o mesmo estilo).
- **Determinismo:** NÃO usar `Date.now()`/`Math.random()` no contexto (não precisa; itens vêm prontos de
  quem chama `addItem`).

### 2. MODIFICAR `src/app/(main)/layout.tsx`
- Envolver a árvore com `<CartProvider>` (junto dos outros providers já presentes — ver o arquivo; provável
  que já tenha `OrdersProvider`). Não reordenar os outros; só adicionar o CartProvider.
- **Nenhuma outra mudança visual.**

### 3. CRIAR testes `src/contexts/__tests__/cart-context.test.tsx`
Testar o comportamento observável via `useCart` (use `@testing-library/react` `renderHook` + `act`, ou um
componente-sonda). Cobrir:
- add novo item → `items` tem 1, `itemCount` = quantity, `subtotal` correto.
- add do MESMO productId+supplierId → soma quantity (continua 1 linha).
- add de mesmo productId mas supplierId diferente → 2 linhas.
- `updateQty` altera quantity e reflete em subtotal/itemCount; guard (quantity 0 → remove; não-inteiro → ignora).
- `removeItem` remove a linha certa.
- `clear` esvazia.
- `bySupplier` agrupa (2 fornecedores → 2 grupos).
- **Persistência:** após mutações, `localStorage['fl.cart.v1']` reflete os itens; um novo Provider hidrata
  a partir do localStorage. (Mock/uso do localStorage do jsdom — o setup do vitest já tem jsdom.)

## Restrições (governança)
- Modifica `src/contexts/` e `src/app/(main)/layout.tsx`. Antes de editar, invoque
  `Skill(risk-zone-protocol)` se disponível; se a skill não existir no ambiente, siga mesmo assim o
  princípio: mudança mínima, zero regressão visual, verificar build.
- NÃO usar `any`. NÃO duplicar `cartSubtotal`/`groupBySupplier` (vêm de `@/lib/domain/cart`).
- NÃO tocar em `orders-context.tsx`, nem em componentes de UI, nem criar páginas.
- `'use client'` no topo do context (usa hooks/localStorage).

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (97 anteriores + os novos de cart-context). Colar saída real.
2. `npm run lint` → EXIT 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso (o Provider entra no bundle do layout).

Loop de no máx. 3 tentativas. Se falhar depois disso, PARAR e reportar o bloqueio literal. NÃO commitar.

## Entregável
- `cart-context.tsx` (criado), `layout.tsx` (modificado), teste (criado).
- Saída literal dos 4 comandos do DoD.
- `git status --short` provando que só esses arquivos mudaram.
- Decisões de borda (ex.: comportamento exato do guard de updateQty).
