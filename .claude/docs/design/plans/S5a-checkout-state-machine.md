# S5a — Máquina de checkout (telas + estado)

**Thread:** S · **Depende de:** S1 ✅ (`useCart`), S3 ✅ (`/sacola`).
**Papel:** subagente SA-Checkout (Haiku). Coordenador revisa pelo D-012.
**Decisões:** D-016, D-017 (agrupar por fornecedor), D-019 (pix/card). **NÃO** cria pedido nem limpa sacola (isso é S5b).

## Objetivo
Criar a rota `/checkout` com uma **máquina de 4 passos** — `endereco` → `revisao` → `pagamento` (STUB) →
`confirmacao` (placeholder) — dirigida por **estado local** (nada de criação de pedido, nada de adapter, nada de
limpar a sacola nesta task). Ligar a CTA "Finalizar compra" da `/sacola` a essa rota. Mudança isolada, sem `any`.

## Contexto (leia os arquivos antes de escrever)
- `src/contexts/cart-context.tsx` expõe `useCart()`: `{ items, itemCount, subtotal, bySupplier, addItem, removeItem, updateQty, clear }`.
  `bySupplier` é `Map<string, CartItem[]>`; `subtotal` já é `cartSubtotal(items)`.
- `src/lib/domain/cart.ts`: `CartItem`, `lineTotal(item)`, `cartSubtotal(items)`. **NÃO** duplicar dinheiro — use `formatPrice` de `@/lib/utils`.
- `src/lib/account-mock.ts`: `interface Address`, `MOCK_USER`.
- `src/contexts/auth-context.tsx`: `useAuth()` expõe `profile` (com `profile?.address`).
- `src/lib/ports/payment.ts`: `type PaymentMethod = 'pix' | 'card'`.
- `src/components/catalogo/BuyModal.tsx` — **referência** do padrão de endereço (rádio cadastro vs custom + validação). NÃO importar dele; replicar o padrão simples no checkout.
- `src/app/(main)/sacola/page.tsx` — a CTA "Finalizar compra" hoje está desabilitada com selo "Em breve" (linhas ~184-196).

## Escopo — CRIAR `src/app/(main)/checkout/page.tsx` (`'use client'`)
Componente de página com estado local:
- `step: 'endereco' | 'revisao' | 'pagamento' | 'confirmacao'` (inicia em `endereco`).
- Estado de endereço no padrão do BuyModal: `useCustomAddress` (boolean) + `customAddress: Address`.
  `defaultAddress = profile?.address || MOCK_USER.address`; `deliveryAddress = useCustomAddress ? customAddress : defaultAddress`.
- `paymentMethod: PaymentMethod` (inicia `'pix'`).

**Guarda de carrinho vazio:** se `items.length === 0` **e** `step !== 'confirmacao'`, renderizar estado vazio
("Sua sacola está vazia") com `<Link href="/catalogo">Explorar catálogo</Link>` — não renderizar os passos.

**Passo `endereco`:**
- Rádios "Usar endereço do cadastro" (mostra `defaultAddress` formatado) vs "Outro endereço" (form com os campos de `Address`).
- Validação (igual BuyModal): custom válido exige `logradouro`, `numero`, `cep`, `cidade`, `estado` preenchidos (trim).
- Botão "Continuar" → `step = 'revisao'`; **desabilitado** enquanto endereço inválido.

**Passo `revisao`:**
- Itens **agrupados por fornecedor** (`Array.from(bySupplier.entries())`): nome do fornecedor, linhas (`productName`,
  qty, `formatPrice(lineTotal(item))`), subtotal por fornecedor (`formatPrice(cartSubtotal(supplierItems))`).
- Total geral: `formatPrice(subtotal)`. Mostrar o `deliveryAddress` escolhido.
- Botões "Voltar" (→ `endereco`) e "Continuar" (→ `pagamento`).

**Passo `pagamento` (STUB):**
- Seleção de método: rádios "Pix" (`'pix'`) e "Cartão" (`'card'`) ligados a `paymentMethod`.
- Aviso claro de que é simulação (ex.: texto "Pagamento simulado — nenhuma cobrança real").
- Botão "Pagar" (STUB) → `step = 'confirmacao'`. Botão "Voltar" (→ `revisao`).
- **NÃO** chamar nenhum adapter/charge aqui — isso é o S5b. Deixar comentário `// S5b: aqui entram MockPaymentGateway/MockFulfillmentService + criação de pedido`.

**Passo `confirmacao` (placeholder):**
- Tela de sucesso estática: "Pedido recebido" + link "Ver meus pedidos" (`<Link href="/minha-conta">`).
- Comentário `// S5b: aqui o pedido é criado (buildOrdersFromCart) e a sacola é limpa (clear())`.
- **NÃO** cria pedido, **NÃO** chama `clear()`.

## Escopo — MODIFICAR `src/app/(main)/sacola/page.tsx`
- Só a CTA "Finalizar compra": trocar o `<button disabled>` + selo "Em breve" por um **link/botão habilitado** que
  navega para `/checkout` (`<Link href="/checkout">` estilizado como o botão primário, **sem** o selo "Em breve").
- **NÃO** tocar na CTA "Buscar ofertas personalizadas" (segue gateada por `LEILAO_ATIVO` com selo "Em breve").

## CRIAR teste `src/app/(main)/checkout/__tests__/page.test.tsx`
Mocke `@/contexts/cart-context` e `@/contexts/auth-context` com `vi.mock` + **`vi.mocked`** (NÃO usar `as any`).
Mocke `next/navigation` se necessário. Cobrir:
- Carrinho vazio → mostra estado vazio com link para `/catalogo` (não mostra passo de endereço).
- Com itens: renderiza passo `endereco`; "Continuar" desabilitado até endereço válido (default do cadastro já é válido — se usar default, habilita).
- Selecionar "outro endereço" com campos vazios mantém "Continuar" desabilitado.
- Navegar endereco → revisao mostra os itens agrupados e o total.
- revisao → pagamento mostra seleção Pix/Cartão; "Pagar" leva à confirmação ("Pedido recebido").
- Confirmação **não** chama `clear()` do carrinho (o mock de `clear` não é chamado).
Use um `CartItem[]` de teste (2 fornecedores, para exercitar o agrupamento).

## Restrições (governança)
- Trabalho de UI: se `Skill(ui-system)` existir, invoque antes de escrever; senão siga as convenções do projeto
  (Tailwind, tokens `brand-*`/`primary-*`, `rounded-card`, `container-fl`) e a11y (`aria-label`, labels de rádio).
- **É "NOT the Next.js you know"** (AGENTS.md): se precisar de API de rota/navegação que não domina, cheque
  `node_modules/next/dist/docs/` antes.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked(...)`.
- NÃO tocar em cart-context, orders-context, auth-context, ProductCard, BuyModal, src/lib, src/components/ui.
  Só criar o checkout (+ auxiliares em `src/components/checkout/` se precisar) e alterar a CTA da sacola.
- NÃO criar pedido, NÃO chamar adapters, NÃO limpar a sacola (tudo isso é S5b).

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (161 anteriores + os novos do checkout). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
   Nenhum `eslint-disable` de `no-explicit-any` novo.
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.

Loop de no máx. 3 tentativas. Se falhar depois, PARAR e reportar o bloqueio literal. **NÃO commitar.**

## Entregável
- `checkout/page.tsx` (+ auxiliares se houver) + teste (criado) + CTA da sacola alterada.
- Saída literal dos 4 comandos do DoD (exit real do lint no Bash).
- `git status --short`.
- Decisões de borda.
