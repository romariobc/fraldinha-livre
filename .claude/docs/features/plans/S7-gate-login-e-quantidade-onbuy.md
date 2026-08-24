# S7 — Gate de login nos botões de compra + quantidade no "Comprar agora"

**Origem:** feedback do cliente (2026-07-10). Duas decisões dele, ambas pequenas e no `ProductCard`/catálogo.
**Papel:** subagente SA-GateQty (Haiku). Coordenador revisa pelo D-012.

## Decisões do cliente
1. **Todos veem o catálogo; só logados interagem com os botões de compra.** Hoje "Adicionar à sacola" funciona
   deslogado (D-016 dizia que o carrinho é local e login só no checkout). O cliente REVERTE isso: clicar em compra
   deslogado deve levar ao login. **Isto emenda a D-016.**
2. **Ambos os botões respeitam a quantidade do stepper.** Hoje "Comprar agora" ignora o stepper e vai ao checkout
   com 1. Passar a quantidade via `onBuy(product, quantity)`.

## Estado atual (ler antes)
`src/components/catalogo/ProductCard.tsx`:
- Recebe prop `isLoggedIn: boolean` e `onBuy: (product: Product) => void`.
- Tem `const [quantity, setQuantity] = useState(1)` (stepper — S6).
- `handleAddToCart()`: monta `CartItem` com `quantity` e chama `cart.addItem` + toast + `setQuantity(1)`.
  **NÃO checa login hoje** (é o bug reportado).
- `handleBuyNow()`: se `!isLoggedIn` → `router.push('/login?redirect=/catalogo')`; senão `onBuy(product)`.
`src/app/(main)/catalogo/page.tsx`:
- `handleBuy(product)`: trava RN-06 (logado + perfil incompleto → `/minha-conta?tab=perfil&returnTo=/catalogo`);
  senão monta `CartItem` com `quantity: 1` **fixo** e faz `addItem` + `router.push('/checkout')`.
- Passa `onBuy={handleBuy}` e `isLoggedIn={user !== null}` ao `ProductCard`.

## Fix 1 — Gate de login em "Adicionar à sacola"
Em `handleAddToCart()` do ProductCard, no topo:
```ts
if (!isLoggedIn) {
  router.push('/login?redirect=/catalogo')
  return
}
```
(mesmo padrão já usado no `handleBuyNow`). Deslogado: **não** adiciona ao carrinho, **não** mostra toast,
redireciona ao login. Logado: comportamento atual (addItem com quantity + toast + reset). Sem checagem de perfil
aqui (perfil só importa no checkout; a regra é apenas "estar logado").

## Fix 2 — Quantidade em "Comprar agora"
- Mudar a assinatura da prop: `onBuy: (product: Product, quantity: number) => void`.
- `handleBuyNow()`: manter o gate de login; depois chamar `onBuy(product, quantity)`.
- Em `catalogo/page.tsx`, `handleBuy(product, quantity)`: manter a trava RN-06; usar `quantity` (não `1`) ao montar
  o `CartItem` antes de `addItem` + `router.push('/checkout')`.
- Verificar se `ProductCard` é usado em outro lugar além do catálogo (grep); se for, ajustar as chamadas de `onBuy`.

## Testes a atualizar (`src/components/catalogo/__tests__/ProductCard.test.tsx`)
- O teste "should work without login (no redirect)" **INVERTE**: agora deslogado NÃO chama `addItem` e
  **redireciona** para `/login?redirect=/catalogo` (renomear o teste de acordo).
- Adicionar/ajustar: logado + "Adicionar à sacola" → `addItem` chamado com a quantidade correta.
- "Comprar agora" logado agora chama `onBuy(product, quantity)` — ajustar as asserções que esperavam `onBuy(product)`;
  novo caso: stepper em 3 + "Comprar agora" → `onBuy` recebe `(product, 3)`.
- "Comprar agora" deslogado segue redirecionando ao login (inalterado).
Se houver teste da página de catálogo que exercita `handleBuy`, ajustar para a nova assinatura.

## Restrições (governança)
- "NOT the Next.js you know" — cheque `node_modules/next/dist/docs/` se precisar.
- UI: invoque `Skill(ui-system)` se existir.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked(...)`.
- NÃO tocar em: cart-context, orders-context, checkout, `src/lib`, `src/components/ui`, feature-flags.
  Só `ProductCard.tsx`, `catalogo/page.tsx` e os testes afetados.
- Manter o stepper (S6), o flip (S5) e o teaser "Pedir oferta" intactos.
- NÃO commitar.

## Critério de pronto (DoD) — provar com execução (front/ do worktree)
1. `npm test` → todos verdes (196 anteriores ± ajustes). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda; confirmação: "sem any", "add-a-sacola deslogado redireciona ao login (sem toast, sem addItem)",
"ambos os botoes usam a quantidade do stepper", "checkout/flip/stepper intactos".
