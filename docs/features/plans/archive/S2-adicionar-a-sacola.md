# S2 — Adicionar à sacola (catálogo)

**Thread:** S · **Depende de:** S1 ✅ (`useCart`), S3 ✅ (`/sacola` existe)
**Papel:** subagente SA-AddCart (Haiku). Coordenador revisa pelo D-012.
**Decisões:** D-016 (ProductCard → "Adicionar à sacola"; BuyModal → "Comprar agora"), D-007 (teaser
"Pedir oferta" no catálogo mantido, gateado).

## Objetivo

Ligar o catálogo à sacola: o `ProductCard` ganha a CTA primária **"Adicionar à sacola"** que adiciona o
produto ao carrinho (`useCart.addItem`), mostra um toast e **permanece no catálogo** (continuar comprando).
O caminho express e o teaser continuam existindo. Sem `any` (nem em teste). Mudança pequena e isolada.

## Estado atual (ver o arquivo)
`src/components/catalogo/ProductCard.tsx`: recebe props `onBuy`, `onRequestOffer`, `isLoggedIn`. Hoje tem
CTA primária **"Comprar"** (→ `handleBuy` → se deslogado vai pro login, senão `onBuy(product)` que abre o
BuyModal na página do catálogo) e CTA secundária **"Pedir oferta →"** (desabilitada atrás de LEILAO_ATIVO).
Já importa `STORE_SUPPLIERS`, `formatPrice`, `useRouter`, `LEILAO_ATIVO`. `CartProvider` já envolve o
catálogo (rota sob `(main)`), então `useCart` funciona aqui.

## Escopo — MODIFICAR `src/components/catalogo/ProductCard.tsx`

As 3 CTAs (de cima para baixo):

1. **"Adicionar à sacola"** — CTA PRIMÁRIA (estilo do botão primário atual, `bg-primary-dark`).
   - `onClick` → `useCart().addItem(item)` onde `item` é montado do produto:
     ```ts
     {
       productId: product.id,
       productName: `${product.name} ${product.size}`, // ex.: "Supersec Pants P" (desambigua tamanhos)
       supplierId: product.supplierId,
       supplierName,                 // já calculado no componente (STORE_SUPPLIERS lookup, fallback existente)
       unitPrice: product.priceInCents,
       quantity: 1,
       unit: 'un',
     }
     ```
     (o tipo é `CartItem` de `@/lib/domain/cart`.)
   - Depois de adicionar: `toast.success('Adicionado à sacola', { action: { label: 'Ver sacola', onClick: () => router.push('/sacola') } })` (import `toast` de `sonner`).
   - **NÃO** navega, **NÃO** exige login (o carrinho é local; login só no checkout). Permanece no catálogo.

2. **"Comprar agora"** — CTA SECUNDÁRIA (express). É o comportamento ATUAL do "Comprar": renomear o rótulo
   para **"Comprar agora"** e MANTER exatamente a lógica atual (`handleBuy`: deslogado → `/login?redirect=/catalogo`;
   logado → `onBuy(product)` que abre o BuyModal). Não mexer no fluxo do BuyModal (o flip do fluxo é o S5).
   Estilo: secundário (ex.: outline/borda), para a primária "Adicionar à sacola" ficar em destaque.

3. **"Pedir oferta →"** — teaser de leilão, **INALTERADO** (desabilitado atrás de LEILAO_ATIVO, selo "Em breve").

- Import novo: `useCart` de `@/contexts/cart-context`, `toast` de `sonner`, `type { CartItem }` de
  `@/lib/domain/cart`. Reuse `supplierName` já calculado. NÃO duplicar dinheiro.

## CRIAR teste `src/components/catalogo/__tests__/ProductCard.test.tsx`
Como o ProductCard usa `useCart` e `useRouter`, **mocke com `vi.mock` + `vi.mocked`** (NÃO usar `as any` —
use `vi.mocked(useCart)` para tipar). Mocke `sonner` (toast) e `next/navigation` (useRouter).
Renderizar `<ProductCard product={PRODUTO} onBuy={vi.fn()} onRequestOffer={vi.fn()} isLoggedIn={true} />`.
Cobrir:
- Clicar "Adicionar à sacola" chama `addItem` UMA vez com o item esperado (productId, supplierId,
  unitPrice = priceInCents, quantity 1, unit 'un', productName com o tamanho).
- "Adicionar à sacola" funciona mesmo com `isLoggedIn={false}` (não redireciona — addItem é chamado).
- Clicar "Comprar agora" com `isLoggedIn={true}` chama `onBuy(product)`.
- "Pedir oferta" está desabilitado (LEILAO_ATIVO=false).
Use um `Product` de teste (pode importar de `@/lib/products` ou montar um literal).

## Restrições (governança)
- Trabalho de UI — se `Skill(ui-system)` existir, invoque; senão siga convenções + a11y (`aria-label`).
- **NÃO usar `any` em lugar nenhum** (código nem teste). Nos mocks de teste use `vi.mocked(...)`.
- NÃO tocar em cart-context.tsx, na página do catálogo, no BuyModal, em src/lib, src/components/ui.
  Só `ProductCard.tsx` + o teste novo.
- Manter o "Pedir oferta" teaser e o fluxo do BuyModal intactos.

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (152 anteriores + os novos do ProductCard). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe) → exit 0 (só o warning pré-existente de supplier-mock.ts).
   Nenhum `eslint-disable` de `no-explicit-any` novo.
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.

Loop de no máx. 3 tentativas. Se falhar depois, PARAR e reportar o bloqueio literal. NÃO commitar.

## Entregável
- `ProductCard.tsx` (modificado) + teste (criado).
- Saída literal dos 4 comandos do DoD (exit real do lint).
- `git status --short`.
- Decisões de borda.
