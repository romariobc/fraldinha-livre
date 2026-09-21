# U1 — Cancelamento nos contextos + correção do seed (unitPrice)

**Spec:** spec-pedido-detalhe-cancelamento.md — RN-05, RN-06, RN-07. **Feature:** 017. **D-025.**
**Papel:** subagente SA-CancelCtx (Haiku). Coordenador revisa pelo D-012. **Habilita:** U2 (UI do OrderCard).

## Objetivo
Dar aos contextos os métodos de cancelamento que a UI (U2) vai chamar, e corrigir a dívida D-022 no seed
(`items[].unitPrice` unitário). Sem UI nesta task.

## Estado atual (ler antes)
- `src/contexts/orders-context.tsx`: `{ orders, createDirectOrder, createOrdersFromCart }`. `Order.status`
  inclui `cancelado`.
- `src/contexts/market-context.tsx`: gerencia `directOrders: DirectOrder[]` (id === id do pedido). Já tem
  `handleRecusarDireto(orderId)` (fornecedor recusa → `cancelado` + toast "Pedido recusado.") e `addDirectOrder`.
- `src/lib/account-mock.ts`: `INITIAL_ORDERS` (ord-003/004/005) com `items[]` cujo `unitPrice` foi gravado = **total**.

## Parte 1 — `orders-context`: método `cancelOrder`
- Adicionar ao contexto: `cancelOrder: (orderId: string) => void`.
  ```ts
  const cancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o))
  }
  ```
- Expor no `value` do provider (junto de `orders`, `createDirectOrder`, `createOrdersFromCart`).

## Parte 2 — `market-context`: reflexo do cancelamento pelo comprador
- Adicionar: `cancelDirectOrder: (orderId: string) => void` — marca o `DirectOrder` correspondente como
  `cancelado`, **sem toast** (o toast é do lado do comprador, em U2). **No-op** se o id não existir.
  ```ts
  function cancelDirectOrder(orderId: string) {
    setDirectOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' as const } : o))
  }
  ```
- Expor no `value` do provider e na interface `MarketContextValue`.
- NÃO alterar `handleRecusarDireto` (é a ação do fornecedor, com toast próprio). São coisas distintas.

## Parte 3 — Corrigir o seed (`account-mock.ts`, D-022/RN-07)
Fazer `items[].unitPrice === price / quantity` (inteiro) em cada pedido do `INITIAL_ORDERS`. Onde o total não
divide inteiro, ajustar o `price` (é mock). Valores alvo:
- **ord-003** (qty 2, price 13400): `items[0].unitPrice = 6700` (6700×2 = 13400). `price` mantém 13400.
- **ord-004** (qty 40): ajustar para dividir inteiro → `price = 10400`, `items[0].unitPrice = 260` (260×40 = 10400).
- **ord-005** (qty 20, price 6000): `items[0].unitPrice = 300` (300×20 = 6000). `price` mantém 6000.
- Garantir, para TODOS: `items[].unitPrice * quantity === price` e `unitPrice` inteiro. (Pedidos criados pelo
  checkout via `createOrdersFromCart` já estão corretos — não há o que mexer lá.)

## Testes
- `src/contexts/__tests__/orders-context.test.tsx` (ATUALIZAR/estender): `cancelOrder(id)` muda o status do
  pedido para `cancelado` e não afeta os demais.
- `src/contexts/__tests__/market-context.test.tsx` (CRIAR se não existir, ou estender): `cancelDirectOrder(id)`
  marca o DirectOrder como `cancelado`; id inexistente é no-op (não lança, não altera nada). Mockar `sonner` se o
  provider importar toast.
- `src/lib/__tests__/account-mock.test.ts` (CRIAR se não existir): para cada pedido de `INITIAL_ORDERS` com
  `items` e `price`, `sum(item.unitPrice*item.quantity) === price` e todo `unitPrice` é inteiro.

## Restrições (governança)
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked`. NÃO duplicar dinheiro.
- NÃO tocar em: OrderCard, PedidosTab, checkout, catálogo, `src/components`, `src/app`. **Só os 2 contextos + o
  seed + os testes.** (A UI é a U2.)
- NÃO renomear campos existentes; só adicionar métodos e ajustar valores do seed. NÃO commitar.

## Critério de pronto (DoD) — provar com execução (front/ do worktree)
1. `npm test` → todos verdes (225 anteriores + ajustes). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda; confirmação: "sem any", "cancelOrder e cancelDirectOrder adicionados", "seed com unitPrice
unitario coerente (unit x qtd = total)", "handleRecusarDireto/checkout intactos".
