# T1 — Contratos de domínio + portas (Payment/Fulfillment)

**Feature:** 016 (compra direta — catálogo→carrinho→checkout)
**Tarefa do plano:** T1 (caminho crítico T0✅→T1→T6→T9→T12→T13→T15)
**Papel:** subagente SA-Domain (Haiku). Coordenador (sessão-mãe) revisa pelo D-012.
**Spec de referência:** `.claude/docs/design/specs/spec-compra-direta-carrinho-checkout.md` (RN-01, RN-12, RN-13)
**Decisões aplicáveis:** D-016..D-020. Perguntas do coordenador resolvidas assim:
- (1) **Subpastas** `src/lib/domain/` e `src/lib/ports/` (NÃO flat).
- (2) Pagamento **`'pix' | 'card'`** apenas. `boleto` NÃO entra — deixar comentário `// extensão futura: 'boleto'` no tipo, sem implementar.
- (3) Migração do `Order` real (account-mock) é **T1.5**, tarefa separada. **Neste T1 NÃO tocar em account-mock.ts** nem em nenhum arquivo existente além de criar arquivos novos.

---

## Objetivo

Criar a **camada de contratos** da compra direta: tipos e helpers PUROS de domínio + interfaces de porta (hexagonal). **Zero UI. Zero React. Zero I/O.** Tudo tipado (sem `any`) e testado com Vitest.

## Escopo — arquivos a CRIAR (todos novos)

### 1. `front/src/lib/domain/money.ts`
- `type Money = number` — inteiro em **centavos** (RN-01). Documentar no JSDoc que Money é sempre centavos inteiros.
- **NÃO** redefinir `formatPrice` — ela já existe em `@/lib/utils` e é a ÚNICA formatadora (RN-01). Se precisar formatar em teste, importe de lá.
- Helpers puros que faltam para o carrinho/checkout, todos operando em centavos inteiros:
  - `addMoney(a: Money, b: Money): Money`
  - `multiplyMoney(value: Money, qty: number): Money` — qty é inteiro ≥ 0; multiplicação de centavos.
  - `sumMoney(values: Money[]): Money` — soma de lista (usar para subtotal).
- Guardas: qty negativo ou não-inteiro → lançar `Error` com mensagem clara. Money não-inteiro → `Error`.

### 2. `front/src/lib/domain/cart.ts`
- `interface CartItem` com o mínimo para o carrinho de compra direta:
  - `productId: string`
  - `productName: string`
  - `supplierId: string`
  - `supplierName: string`
  - `unitPrice: Money` (centavos)
  - `quantity: number` (inteiro ≥ 1)
  - `unit: 'un' | 'cx' | 'kg'` (mesmo union do Order existente)
- Helpers puros (sem estado, sem localStorage — persistência é do T6):
  - `lineTotal(item: CartItem): Money` — unitPrice × quantity (usar multiplyMoney).
  - `cartSubtotal(items: CartItem[]): Money` — soma dos lineTotal (usar sumMoney).
  - `groupBySupplier(items: CartItem[]): Map<string, CartItem[]>` — agrupa por supplierId (D-017: split por fornecedor no checkout).
- Nenhum acoplamento a React. Funções determinísticas.

### 3. `front/src/lib/domain/order.ts`
- `interface OrderItem` (D-018) — a linha de um pedido já materializado:
  - `productId: string`
  - `productName: string`
  - `unitPrice: Money`
  - `quantity: number`
  - `unit: 'un' | 'cx' | 'kg'`
- `interface DomainOrder` — pedido de compra direta de UM fornecedor (D-017: 1 order por fornecedor):
  - `id: string`
  - `supplierId: string`
  - `supplierName: string`
  - `items: OrderItem[]`
  - `total: Money`
  - `deliveryAddress: Address` — **importar** `Address` de `@/lib/account-mock` (só import de tipo, não modificar o arquivo).
  - `createdAt: string` (ISO 8601)
- **IMPORTANTE:** `DomainOrder` é um tipo NOVO desta camada. NÃO é o `Order` do account-mock. A convergência dos dois é a T1.5 — aqui só definimos o alvo. Documentar isso em um comentário no topo do arquivo.
- Helper puro:
  - `buildOrdersFromCart(items: CartItem[], address: Address, idFactory: () => string, now: string): DomainOrder[]` — agrupa por fornecedor (groupBySupplier) e produz 1 DomainOrder por fornecedor, com total = cartSubtotal do grupo. `idFactory` e `now` são injetados (função pura testável, sem Date.now()/random dentro).

### 4. `front/src/lib/ports/payment.ts`
- `type PaymentMethod = 'pix' | 'card'` — com comentário `// extensão futura: 'boleto'`.
- `interface PaymentRequest`:
  - `orderId: string`
  - `amount: Money`
  - `method: PaymentMethod`
- `interface PaymentResult`:
  - `status: 'approved' | 'declined' | 'pending'`
  - `transactionId: string`
  - `paidAt?: string` (ISO 8601, presente quando approved)
- `interface PaymentGateway` (a PORTA — só a interface, sem implementação; o adaptador mock é a T2):
  - `charge(req: PaymentRequest): Promise<PaymentResult>`
- JSDoc explicando que implementações reais (backend 006) e o mock (T2) devem satisfazer o contract test.

### 5. `front/src/lib/ports/fulfillment.ts`
- `interface FulfillmentRequest`:
  - `orderId: string`
  - `address: Address` (importar de `@/lib/account-mock`)
  - `items: OrderItem[]` (importar de `@/lib/domain/order`)
- `interface FulfillmentResult`:
  - `status: 'scheduled' | 'rejected'`
  - `trackingCode?: string` (presente quando scheduled)
  - `estimatedDays?: number`
- `interface FulfillmentService` (a PORTA):
  - `schedule(req: FulfillmentRequest): Promise<FulfillmentResult>`
- JSDoc idem: contrato que backend real e mock (T2) devem satisfazer.

### 6. Testes — `front/src/lib/domain/__tests__/`
Criar testes unitários PUROS (sem render, sem mock de rede) cobrindo:
- `money.test.ts`: addMoney/multiplyMoney/sumMoney; casos de borda (0, lista vazia = 0); qty negativo lança; qty não-inteiro lança; Money não-inteiro lança.
- `cart.test.ts`: lineTotal; cartSubtotal com múltiplos itens; carrinho vazio = 0; groupBySupplier com 2 fornecedores retorna 2 grupos, com 1 fornecedor retorna 1 grupo.
- `order.test.ts`: buildOrdersFromCart com carrinho de 2 fornecedores → 2 DomainOrder, cada um com total correto e só os itens do seu fornecedor; idFactory/now injetados são usados (determinístico); carrinho vazio → lista vazia.

As portas (payment/fulfillment) NÃO têm teste aqui — o **contract test** vem na T2 junto com os adaptadores mock. Aqui são só interfaces/tipos.

---

## Restrições (D-012 / governança)

- **NÃO** usar `any`. Tipar tudo. `unknown` + narrow se necessário.
- **NÃO** duplicar `formatPrice` (RN-01) — vem de `@/lib/utils`.
- **NÃO** modificar NENHUM arquivo existente. Só criar os arquivos listados. (Import de tipo de account-mock é permitido; alterar o arquivo NÃO.)
- **NÃO** usar `Date.now()`, `Math.random()`, `new Date()` dentro de funções puras — receber `now`/`idFactory` por parâmetro.
- Nada de React, hooks, localStorage, fetch. Camada pura.
- Alias `@/` já funciona (vitest.config.ts do T0).

## Critério de pronto (DoD) — provar com execução, não com relatório

Rodar **no `front/` do worktree** (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):

1. `npm test` → **todos verdes**, incluindo os 3 novos arquivos de teste + o smoke do T0.
2. `npm run lint` → **EXIT 0**, zero warnings novos.
3. `npx tsc --noEmit` (ou `npm run build`) → **sem erro de tipo**.

Colar no relatório final a saída REAL desses 3 comandos (não "presumo que passou"). Se algo falhar: loop de no máximo **3 tentativas** de correção; se ainda falhar, **PARAR** e reportar o bloqueio exato (comando + saída), sem inventar.

## Entregável do subagente

- Os 8 arquivos criados (5 de código + 3 de teste).
- Saída literal dos 3 comandos do DoD.
- Lista de qualquer decisão de borda que você tomou (ex.: nome de helper, mensagem de erro).
