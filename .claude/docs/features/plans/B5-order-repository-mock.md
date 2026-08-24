# B5 — front/: OrderRepository (porta) + MockOrderRepository

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-pedidos-cloudflare.md` — seção "Porta do front"
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B5, dep: B1 — APROVADO).

## Objetivo

Criar a porta hexagonal `OrderRepository` (interface) e `MockOrderRepository` (implementação em
memória, seed = `INITIAL_ORDERS` existente), no MESMO padrão das portas de pagamento/logística que já
existem no front. Isso é o primeiro passo pro `OrdersContext` deixar de ler `INITIAL_ORDERS` direto
(B8, tarefa futura — **não mexer no `OrdersContext` nesta tarefa**).

## Contexto mínimo — LER estes arquivos antes de escrever código

- **Padrão a copiar (já existe, funciona, não reinvente):**
  `front/src/lib/ports/payment.ts` (interface pura) e
  `front/src/lib/adapters/mock-payment-gateway.ts` (mock com `now`/`idFactory` injetados no
  constructor — nunca `Date.now()`/`crypto.randomUUID()` direto dentro da classe).
- **Tipos do contrato (B1, já existe):** `packages/contracts/src/order.ts` — `Order`,
  `CreateOrderRequest`, `OrderSchema` (Zod). Import no front via `@contracts` (alias já configurado,
  `import type { Order, CreateOrderRequest } from '@contracts'`, `import { OrderSchema } from
  '@contracts'`).
- **Dados de seed (existentes, NÃO modificar):** `front/src/lib/account-mock.ts` — `INITIAL_ORDERS`
  (hoje só tem `type: 'compra-direta'`, D-022 já limpou os de cotação) e sua interface `Order` (é
  **diferente** da `Order` de `@contracts` — ver mapeamento abaixo).
- **Helper existente (NÃO duplicar, importar):** `front/src/lib/order-items.ts`, função
  `getOrderItems(order)` — já resolve o fallback de `items` ausente/vazio pro formato de linha
  canônico.

### Por que existem DUAS `Order` diferentes (não é engano, é intencional)
- `account-mock.ts`'s `Order` — tipo de UI/seed já usado pelos componentes hoje. **Não muda nesta
  tarefa.**
- `@contracts`'s `Order` — o contrato de rede (Zod), o mesmo que o Worker (B2-B4) usa. É o tipo que a
  **porta `OrderRepository` fala** (`list`/`create`/`cancel` retornam/recebem tipos de `@contracts`,
  nunca o `Order` de `account-mock.ts`).
- O `MockOrderRepository` faz a ponte: lê o seed de `account-mock.ts` e CONVERTE pra `@contracts.Order`
  ao inicializar (função de mapeamento abaixo). Religar o `OrdersContext` de verdade a essa porta é a
  B8, não aqui.

## Tarefas (nesta ordem)

### 1. `front/src/lib/ports/order-repository.ts`
```ts
import type { Order, CreateOrderRequest } from '@contracts'

export interface OrderRepository {
  list(): Promise<Order[]>
  create(req: CreateOrderRequest): Promise<Order>
  cancel(orderId: string): Promise<Order>
}

/** Lançado por cancel() quando o pedido não existe. */
export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`)
    this.name = 'OrderNotFoundError'
  }
}

/** Lançado por cancel() quando o pedido existe mas não está mais em 'aguardando' (trava D-025). */
export class OrderCancelNotAllowedError extends Error {
  constructor(orderId: string, status: string) {
    super(`Cannot cancel order ${orderId}: status is '${status}', expected 'aguardando'`)
    this.name = 'OrderCancelNotAllowedError'
  }
}
```
Essas 2 classes de erro são parte do CONTRATO da porta — tanto o mock (aqui) quanto o adapter HTTP
(B7, tarefa futura) devem lançá-las nos mesmos casos, pra quem consome a porta não precisar saber qual
adapter está por trás.

### 2. `front/src/lib/adapters/mock-order-repository.ts`
```ts
import type { OrderRepository } from '@/lib/ports/order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError } from '@/lib/ports/order-repository'
import type { Order, CreateOrderRequest } from '@contracts'
import { OrderSchema } from '@contracts'
import { INITIAL_ORDERS, type Order as AccountMockOrder } from '@/lib/account-mock'
import { getOrderItems } from '@/lib/order-items'

const MOCK_UID = 'mock-uid-ana' // usuário mock único — sem isolamento multi-usuário (isso é do servidor)

function toContractOrder(order: AccountMockOrder): Order {
  const mapped = {
    id: order.id,
    uid: MOCK_UID,
    type: 'compra-direta' as const,
    status: order.status,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    price: order.price,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    items: getOrderItems(order),
  }
  // Valida contra o schema Zod — se o mapeamento estiver errado, falha aqui, não em produção.
  return OrderSchema.parse(mapped)
}

export class MockOrderRepository implements OrderRepository {
  private orders: Order[]
  private now: () => string
  private idFactory: () => string

  constructor(options: { now: () => string; idFactory: () => string }) {
    this.now = options.now
    this.idFactory = options.idFactory
    this.orders = INITIAL_ORDERS.map(toContractOrder)
  }

  async list(): Promise<Order[]> {
    return [...this.orders]
  }

  async create(req: CreateOrderRequest): Promise<Order> {
    const order: Order = OrderSchema.parse({
      id: this.idFactory(),
      uid: MOCK_UID,
      type: 'compra-direta',
      status: 'aguardando',
      product: req.product,
      quantity: req.quantity,
      unit: req.unit,
      price: req.price,
      supplierId: req.supplierId,
      supplierName: req.supplierName,
      deliveryAddress: req.deliveryAddress,
      createdAt: this.now(),
      items: req.items,
    })
    this.orders.push(order)
    return order
  }

  async cancel(orderId: string): Promise<Order> {
    const order = this.orders.find((o) => o.id === orderId)
    if (!order) throw new OrderNotFoundError(orderId)
    if (order.status !== 'aguardando') throw new OrderCancelNotAllowedError(orderId, order.status)
    order.status = 'cancelado'
    return order
  }
}
```
Ajuste imports/paths conforme a estrutura real do projeto se algo divergir (ex.: confirme o path exato
de `@/lib/account-mock` e `@/lib/order-items` antes de assumir — devem já existir, só confirme).

### 3. `front/src/lib/adapters/__tests__/mock-order-repository.test.ts`
Testes básicos (o contrato reutilizável completo vem na B6 — aqui é só smoke test do mock):
- `list()` inicial retorna os pedidos do seed (mesma quantidade de `INITIAL_ORDERS`), todos com
  `uid === 'mock-uid-ana'` e `items` não-vazio.
- `create()` com um `CreateOrderRequest` válido: retorna um `Order` com `status === 'aguardando'`,
  `id`/`createdAt` vindos do `idFactory`/`now` injetados (não gerados internamente); aparece depois num
  `list()` subsequente.
- `cancel()` de um pedido em `aguardando` (seed já tem pelo menos 1 — confirme lendo
  `INITIAL_ORDERS` real, não assuma) → retorna com `status === 'cancelado'`.
- `cancel()` de um pedido com status diferente de `aguardando` (seed real deve ter algum — confirme) →
  lança `OrderCancelNotAllowedError`.
- `cancel()` de um `orderId` inexistente → lança `OrderNotFoundError`.
- Todos os testes injetam `now`/`idFactory` fixos (determinístico, sem `Date.now()`/`Math.random()`
  reais no teste).

## Testes e verificação (D-008)

Dentro de `front/`, nesta ordem:
1. `npm test` — suíte inteira verde, incluindo os novos testes de `mock-order-repository.test.ts`.
   Deve continuar em >=259 (o que já existia após B1) + os novos.
2. `npx tsc --noEmit` (ou `npm run build`) — sem erro de tipo.
3. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas. Se algo genuinamente não bater (ex.: `INITIAL_ORDERS` tiver um shape
diferente do que este prompt assume), PARE e relate o que encontrou — não invente um mapeamento
alternativo silenciosamente.

## Critérios de aceite

- [ ] `front/src/lib/ports/order-repository.ts`: interface `OrderRepository` + as 2 classes de erro,
      exatamente como especificado.
- [ ] `front/src/lib/adapters/mock-order-repository.ts`: `MockOrderRepository`, `now`/`idFactory`
      injetados (nunca chamados direto), seed mapeado de `INITIAL_ORDERS` via `OrderSchema.parse()`.
- [ ] Testes cobrindo os 5 casos listados no passo 3, todos verdes.
- [ ] `npm test`, `tsc`/`build`, `lint` — todos exit 0.
- [ ] **`front/src/lib/account-mock.ts` e `front/src/contexts/orders-context.tsx` NÃO foram
      modificados** (isso é B8).
- [ ] Nenhum arquivo fora do escopo listado foi tocado.

## Restrições

- **Não** modifique `account-mock.ts`, `orders-context.tsx`, ou qualquer componente de UI.
- **Não** implemente `HttpOrderRepository` nem `api-client` — isso é B7.
- **Não** use `Date.now()`, `Math.random()`, `crypto.randomUUID()`/`new Date()` dentro da classe —
  sempre injetados via `now`/`idFactory`.
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `feat(front): porta OrderRepository + adapter mock (thread B)`

## Relatório esperado

- Lista de arquivos criados.
- Confirmação de que `INITIAL_ORDERS` real bate com o que o mapeamento assume (colar o shape real se
  divergiu de algo).
- Saída literal de `npm test`, `tsc`/`build`, `lint`.
- Hash do commit.
- Qualquer bloqueio ou ajuste de detalhe.
