# S5b — Checkout: efeito de negócio (pedidos + adapters + flip)

**Thread:** S · **Depende de:** S5a ✅ (`/checkout` state machine), T1 ✅ (`buildOrdersFromCart`), T2 ✅ (mocks).
**Papel:** subagente SA-CheckoutEffect (Haiku). Coordenador revisa pelo D-012.
**Decisões:** D-016, D-017 (1 pedido por fornecedor), D-018 (`OrderItem`/`items[]`), D-019 (pix/card), D-022.

## Objetivo
Fazer a confirmação do checkout **criar de fato os pedidos** (1 por fornecedor), rodar os **adapters mock**
(Payment/Fulfillment) como STUB, **limpar a sacola**, e **aposentar o pedido instantâneo do "Comprar agora"**
(flip do fluxo) — o pedido passa a nascer **só** na confirmação do checkout. Corrige o toast enganoso reportado.

## Pré-leitura obrigatória
- `src/contexts/orders-context.tsx` — hoje só `createDirectOrder`. Vamos ADICIONAR um bridge de carrinho.
- `src/lib/domain/order.ts` — `buildOrdersFromCart(items, address, idFactory, now): DomainOrder[]` e `OrderItem`.
- `src/lib/account-mock.ts` — `interface Order` (campos planos `product/quantity/unit/price` + `items?: OrderItem[]`), `Address`.
- `src/lib/adapters/mock-payment-gateway.ts` / `mock-fulfillment-service.ts` — construtores e `charge`/`schedule`.
- `src/lib/ports/payment.ts` / `fulfillment.ts` — `PaymentRequest`/`FulfillmentRequest`.
- `src/app/(main)/checkout/page.tsx` — state machine do S5a (os ganchos `// S5b:` estão no "Pagar" e na confirmação).
- `src/app/(main)/catalogo/page.tsx` — `handleBuy`/`handleBuyConfirm` (fluxo atual do "Comprar agora" + BuyModal + toast).
- `src/lib/order-adapters.ts` (`orderToDirectOrder`) + `src/contexts/market-context.tsx` (`addDirectOrder`) — materialização no painel do fornecedor `sup-001`.

## Parte 1 — Bridge no OrdersContext
Adicionar método `createOrdersFromCart(items: CartItem[], address: Address): Order[]`:
- Chamar `buildOrdersFromCart(items, address, idFactory, now)` com `idFactory` e `now` internos
  (ex.: `now = new Date().toISOString()`; `idFactory` gera IDs únicos por chamada, ex. `ord-${Date.now()}-${i++}`).
- Mapear cada `DomainOrder` → `Order` (account-mock):
  - `type: 'compra-direta'`, `status: 'aguardando'`, `createdAt: domainOrder.createdAt`, `deliveryAddress: address`.
  - `supplierId`/`supplierName` do `domainOrder`.
  - `items: domainOrder.items` (D-018 — **preço unitário correto por linha**, resolve a dívida técnica do seed).
  - `price: domainOrder.total`.
  - Campos planos (compat): `product = items.length === 1 ? items[0].productName : `${items.length} itens``;
    `quantity = soma das quantidades`; `unit: 'un'`.
- `setOrders(prev => [...prev, ...novos])` e **retornar os novos** (para a tela mostrar/mater­ializar).
- Manter `createDirectOrder` como está (ainda referenciado até o flip; ver Parte 3) — exponha AMBOS no contexto.
- Sem `Date.now()`/`Math.random()` proibidos? (Estamos em app runtime, não em workflow script — `Date.now()` é OK aqui.)

## Parte 2 — Confirmar no checkout (page.tsx)
No passo `pagamento`, o botão **"Pagar"** deixa de só trocar o step. Handler `async` **idempotente** (cria só uma vez):
1. Guard: se já submeteu, retorna (use um `useState`/`useRef` `submitting`/`done`).
2. `const orders = createOrdersFromCart(items, deliveryAddress)` (do `useOrders`).
3. **Adapters STUB** — instanciar uma vez:
   - `new MockPaymentGateway({ now: () => new Date().toISOString(), idFactory: () => 'txn-'+..., outcome: 'approved' })`
   - `new MockFulfillmentService({ idFactory: () => 'trk-'+..., outcome: 'scheduled' })`
   - Para cada `order`: `await payment.charge({ orderId: order.id, amount: order.price!, method: paymentMethod })`
     e `await fulfillment.schedule({ orderId: order.id, address: deliveryAddress, items: order.items! })`.
     (Resultados só para efeito de STUB; default approved/scheduled.)
4. **Materializar no painel do fornecedor:** para cada `order` com `supplierId === 'sup-001'`, chamar
   `orderToDirectOrder(order)` e, se não-nulo, `addDirectOrder(...)` (do `useMarket`). Preserva o feed do painel.
5. Guardar `orders` em estado (para exibir na confirmação), `clear()` a sacola, `setStep('confirmacao')`.
- Confirmação: mostrar "Pedido confirmado" + nº de pedidos criados (1 por fornecedor) e link "Ver meus pedidos".
  Remover o comentário `// S5b:` placeholder. O toast/copy de sucesso vive **só aqui** ("Pedido confirmado").
- A guarda de carrinho vazio do S5a já ignora `step === 'confirmacao'`, então limpar a sacola não quebra a tela.

## Parte 3 — Flip do "Comprar agora" (catalogo/ProductCard/BuyModal)
Aposentar o pedido instantâneo. Em `src/app/(main)/catalogo/page.tsx`:
- Manter a trava de perfil (RN-06): `if (user && !isProfileComplete(profile)) { router.push('/minha-conta?tab=perfil&returnTo=/catalogo'); return }`.
- Em vez de abrir o BuyModal e chamar `createDirectOrder`, o "Comprar agora" passa a **adicionar ao carrinho e ir ao checkout**:
  `cart.addItem(item)` (montar `CartItem` do produto, igual ao ProductCard: productName com tamanho, unitPrice = priceInCents, quantity 1, unit 'un', supplierName via STORE_SUPPLIERS) e `router.push('/checkout')`.
- REMOVER: `handleBuyConfirm`, o `<BuyModal>`, os estados `selectedProductForBuy`/`buyModalOpen`, o import do `BuyModal`,
  a chamada `createDirectOrder` e a materialização `orderToDirectOrder/addDirectOrder` **daqui** (migrou pro checkout),
  e o `toast.success('Pedido criado! O fornecedor foi notificado.')` (o toast enganoso).
- `ProductCard` "Comprar agora" segue chamando `onBuy(product)` — só a semântica do pai muda. Se o gate de perfil deve
  valer também sem login, manter o comportamento atual do ProductCard (deslogado → `/login?redirect=/catalogo`).
- `BuyModal.tsx` fica órfão (sem uso). NÃO precisa deletar nesta task (evita ruído); mas remova qualquer import morto.

## CRIAR/ATUALIZAR testes
- `src/contexts/__tests__/orders-context.test.tsx` — testar `createOrdersFromCart`: carrinho com 2 fornecedores →
  2 pedidos, cada um `compra-direta`/`aguardando`, `items[]` com `unitPrice` **unitário** correto, `price = total`,
  `quantity = soma`. (Se o arquivo não existir, criar; usar RTL `renderHook` com o provider ou testar via componente.)
- `src/app/(main)/checkout/__tests__/page.test.tsx` — ATUALIZAR: ao clicar "Pagar", `createOrdersFromCart` é chamado
  uma vez e `clear()` é chamado (mocke `useOrders`/`useCart`/`useMarket` com `vi.mocked`); confirmação mostra sucesso.
  (Se preferir manter os providers reais do S5a, garanta que o teste verifique que a sacola foi limpa após "Pagar".)
- `src/components/catalogo/__tests__/ProductCard.test.tsx` e/ou teste do catálogo — ATUALIZAR expectativas do
  "Comprar agora" para o novo fluxo (não cria pedido instantâneo). NÃO deixar teste asseverando o toast antigo.
- Manter os contract tests do T2 verdes (não tocar neles).

## Restrições (governança)
- **É "NOT the Next.js you know"** — cheque `node_modules/next/dist/docs/` se precisar de API de navegação.
- Trabalho de UI: invoque `Skill(ui-system)` se existir. Mexer em `src/lib`/contexts/shared → considerar `Skill(risk-zone-protocol)`.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked(...)`. NÃO duplicar dinheiro (`formatPrice`).
- NÃO alterar os ports/adapters/contract-tests do T1/T2. NÃO alterar `feature-flags`. NÃO commitar.
- Materialização `sup-001` no painel do fornecedor **deve continuar funcionando** (não regredir o feed do painel).

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`...\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (183 anteriores ± ajustes; colar saída real; contract tests do T2 verdes).
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só warning pré-existente de supplier-mock.ts). Sem `any`/disable novo.
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal. NÃO commitar.

## Entregável
- Arquivos criados/alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
  decisões de borda; confirmação: "sem any", "pedido criado só no checkout", "sacola limpa no confirmar",
  "materialização sup-001 preservada", "toast enganoso removido".
