# S3 — Página da Sacola (`/sacola`)

**Thread:** S · **Depende de:** S1 ✅ (`useCart`), T1 (`lineTotal`/`cartSubtotal`)
**Papel:** subagente SA-SacolaUI (Haiku). Coordenador revisa pelo D-012.
**Breakdown:** `.claude/docs/design/plans/S-sacola-navegacao-breakdown.md`
**Decisões:** D-016 (bifurcação da cesta), D-017 (agrupar por fornecedor), RN-06 (Buscar ofertas
personalizadas presente-mas-inativo atrás de LEILAO_ATIVO).

## Objetivo

Criar a rota `/sacola`: visualizar e editar o carrinho (itens, quantidade, remover, subtotal), agrupado
por fornecedor, com as duas CTAs da bifurcação (D-016). **Lê tudo do `useCart` (S1)** — nenhuma nova fonte
de dados, nenhuma criação de pedido (isso é o S5). Sem `any`.

## Escopo — arquivos

### 1. CRIAR `src/app/(main)/sacola/page.tsx`  (`'use client'`)
Página client que usa `useCart()`. Fica sob o route group `(main)`, então já herda Header/Footer e os
providers (incl. `CartProvider`). Estrutura:

- **Cabeçalho** da página: título "Sua sacola" + contagem (`itemCount` item(ns)). Use `container-fl` e as
  convenções visuais do projeto (cores `brand-text`/`brand-muted`/`primary-dark`, `rounded-card`,
  `shadow-card` — espelhe o estilo de `minha-conta/page.tsx` e `ProductCard.tsx`).

- **Empty state** (quando `items.length === 0`): ícone (`ShoppingBag` do lucide), mensagem, e link para
  `/catalogo` (`<Link href="/catalogo">`) com estilo de botão primário.

- **Lista agrupada por fornecedor** (quando há itens): iterar `bySupplier` (Map<supplierId, CartItem[]>).
  Para cada grupo:
  - Cabeçalho do grupo: `supplierName` (vem no próprio CartItem — use `items[0].supplierName`).
  - Cada item (linha): `productName`, `unit`, `unitPrice` (via `formatPrice`), stepper de quantidade
    (botões − e +) e botão remover (ícone `Trash2`), e o total da linha (`lineTotal(item)` de
    `@/lib/domain/cart`, formatado com `formatPrice`).
    - Botão **−**: `updateQty(item.productId, item.supplierId, item.quantity - 1)` (o guard do S1 remove ao
      chegar em 0).
    - Botão **+**: `updateQty(item.productId, item.supplierId, item.quantity + 1)`.
    - Botão **remover**: `removeItem(item.productId, item.supplierId)`.
  - **Subtotal do fornecedor**: soma dos `lineTotal` do grupo (pode usar `cartSubtotal(grupo)` de
    `@/lib/domain/cart`), via `formatPrice`.

- **Resumo/rodapé**: **Total** = `subtotal` (do useCart) via `formatPrice`. Nota "Frete a combinar com o
  fornecedor" (mesma linha usada no BuyModal). Duas CTAs (D-016):
  - **"Finalizar compra"** (primária): por ora **DESABILITADA** (o checkout é o S5). Renderizar `disabled`
    + `aria-disabled` + selo/hint "Em breve" (padrão de `ProductCard` "Pedir oferta"). NÃO navegar.
    Comentário no código: `// S5 habilita e liga em /checkout`.
  - **"Buscar ofertas personalizadas"** (secundária): presente e **DESABILITADA atrás de `LEILAO_ATIVO`**
    (import de `@/lib/feature-flags`), selo "Em breve" quando `!LEILAO_ATIVO` — MESMO padrão do "Pedir
    oferta" do ProductCard (RN-06). NÃO implementar leilão.

- Reuse: `formatPrice` de `@/lib/utils`; `lineTotal`/`cartSubtotal` de `@/lib/domain/cart`; `LEILAO_ATIVO`
  de `@/lib/feature-flags`. NÃO reimplementar cálculo de dinheiro.

### 2. CRIAR teste `src/app/(main)/sacola/__tests__/page.test.tsx`
Renderizar a página dentro de `<CartProvider>` (de `@/contexts/cart-context`). Para semear o carrinho,
**pré-carregue o localStorage** antes do render (`window.localStorage.setItem('fl.cart.v1', JSON.stringify([...]))`)
— o provider hidrata no mount (padrão já validado no teste do S1). Cobrir:
- Carrinho vazio → empty state visível + link para `/catalogo`.
- 2 fornecedores semeados → 2 grupos, nome de cada fornecedor presente, itens no grupo certo.
- Total exibido = `formatPrice(cartSubtotal(itens))`.
- Clicar **+** de um item aumenta a quantidade exibida (e o total).
- Clicar **remover** tira o item.
- "Finalizar compra" está `disabled`; "Buscar ofertas personalizadas" está `disabled` (LEILAO_ATIVO=false).
Use `@testing-library/react` + `@testing-library/user-event` (ou `fireEvent`), envolvendo interações em `act`.

## Restrições (governança)
- Trabalho de UI/layout — se `Skill(ui-system)` existir, invoque; se retornar "Unknown skill", siga o
  princípio (convenções visuais do projeto, acessibilidade: `aria-label` nos botões de ícone).
- NÃO usar `any`. NÃO duplicar `formatPrice`/`lineTotal`/`cartSubtotal`.
- NÃO tocar em `cart-context.tsx`, `ProductCard.tsx`, no Header, nem em `src/lib`/`src/components/ui`.
  Só criar a página + o teste.
- NÃO criar pedido, NÃO navegar para checkout (não existe ainda).

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (115 anteriores + os novos de /sacola). Colar saída real.
2. `npm run lint` → **eslint exit 0** (rode `npm run lint; echo "exit=$?"` SEM pipe para não mascarar o
   código de saída — só o warning pré-existente de supplier-mock.ts é aceitável; erro novo = corrigir).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso (a rota entra no bundle).

Loop de no máx. 3 tentativas. Se falhar depois, PARAR e reportar o bloqueio literal. NÃO commitar.

## Entregável
- `sacola/page.tsx` (criado) + teste (criado).
- Saída literal dos 4 comandos do DoD (com o exit real do lint, sem pipe).
- `git status --short`.
- Decisões de borda.
