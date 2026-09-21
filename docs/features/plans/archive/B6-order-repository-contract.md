# B6 — front/: contract test reutilizável runOrderRepositoryContract

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B6, dep: B5 — APROVADO,
commit `5ba3b81`).

## Objetivo

Criar uma suite de contrato reutilizável (`runOrderRepositoryContract`) que QUALQUER implementação de
`OrderRepository` deve passar — hoje só o mock (B5), mas a mesma suite vai rodar contra o
`HttpOrderRepository` na B7. Mesmo padrão dos contract tests que já existem pra `PaymentGateway` e
`FulfillmentService`.

## Contexto mínimo — LER antes de escrever

- **Padrão a copiar EXATAMENTE (convenção já estabelecida, não invente uma nova):**
  `front/src/lib/ports/__tests__/payment-gateway.contract.ts` — a assinatura é
  `runPaymentGatewayContract(name: string, makeGateway: () => PaymentGateway): void`, chamada de
  dentro de um `describe(...)`, com um `it(...)` por invariante. `makeGateway()` é chamado DENTRO de
  cada `it` (instância nova por teste, sem estado compartilhado entre casos).
  Ver também como é consumido: `front/src/lib/adapters/__tests__/mock-payment-gateway.test.ts`
  (`runPaymentGatewayContract('approved outcome', () => new MockPaymentGateway({...}))`).
- `front/src/lib/ports/order-repository.ts` (B5) — `OrderRepository`, `OrderNotFoundError`,
  `OrderCancelNotAllowedError`.
- `front/src/lib/adapters/mock-order-repository.ts` (B5) — `MockOrderRepository`.

## Problema a resolver primeiro: "list vazio"

Um dos casos obrigatórios do contrato é **"list() retorna vazio quando não há pedidos"**. Hoje
`MockOrderRepository` sempre semeia com `INITIAL_ORDERS` (3 pedidos) no constructor — não há como pedir
uma instância vazia. Modifique o constructor pra aceitar um seed opcional:

```ts
// front/src/lib/adapters/mock-order-repository.ts — MODIFICAR o constructor
constructor(options: { now: () => string; idFactory: () => string; seed?: Order[] }) {
  this.now = options.now
  this.idFactory = options.idFactory
  this.orders = options.seed ?? INITIAL_ORDERS.map(toContractOrder)
}
```
Isso é **aditivo** — `seed` é opcional, comportamento atual (semear de `INITIAL_ORDERS`) continua sendo
o padrão quando `seed` não é passado. **Não muda nenhum teste existente de B5** (eles não passam
`seed`, então continuam vendo os 3 pedidos do `INITIAL_ORDERS`).

## Tarefas (nesta ordem)

### 1. Modificar `front/src/lib/adapters/mock-order-repository.ts`
Conforme a seção acima — só o constructor ganha o parâmetro `seed?` opcional.

### 2. Criar `front/src/lib/ports/__tests__/order-repository.contract.ts`
```ts
export function runOrderRepositoryContract(
  name: string,
  makeRepo: () => OrderRepository
): void {
  describe(`OrderRepository (${name})`, () => {
    it('list() retorna array vazio quando não há pedidos', async () => { ... })

    it('create() faz o pedido aparecer em list()', async () => { ... })

    it('create() define status "aguardando"', async () => { ... })

    it('cancel() em pedido "aguardando" muda o status para "cancelado"', async () => { ... })

    it('cancel() de um pedido que não está mais "aguardando" lança erro', async () => {
      // Estratégia: cancelar duas vezes. A primeira (aguardando→cancelado) sucede.
      // A segunda (cancelado, não é mais aguardando) deve lançar OrderCancelNotAllowedError.
      // Isso testa o contrato só com a interface pública, sem precisar de seed especial.
    })
  })
}
```
Implemente cada `it` de verdade (o esqueleto acima é só a estrutura — preencha com `expect`s reais,
seguindo o estilo de `payment-gateway.contract.ts`). Use um `CreateOrderRequest` válido mínimo (produto,
quantidade, unidade, endereço, 1 item) pros testes que precisam criar um pedido — construa esse fixture
uma vez no topo da função e reutilize.

### 3. Modificar `front/src/lib/adapters/__tests__/mock-order-repository.test.ts`
Adicionar (não remover os testes existentes de B5):
```ts
import { runOrderRepositoryContract } from '@/lib/ports/__tests__/order-repository.contract'
// ...
runOrderRepositoryContract('MockOrderRepository', () =>
  new MockOrderRepository({ now: () => '...', idFactory: () => '...', seed: [] })
)
```
Use os mesmos `now`/`idFactory` fixos (ou fábricas determinísticas, ex. contador) já usados nos outros
testes deste arquivo — **sempre `seed: []`** pra essa chamada específica do contract test (pra garantir
"list vazio" no início de cada instância nova).

## Testes e verificação (D-008)

Dentro de `front/`:
1. `npm test` — suíte inteira verde (>=268, + os novos casos do contract test).
2. `npx tsc --noEmit` (ou build) — sem erro de tipo.
3. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas.

## Critérios de aceite

- [ ] `MockOrderRepository` aceita `seed?: Order[]` opcional, aditivo, sem quebrar uso existente.
- [ ] `order-repository.contract.ts` criado com a assinatura `runOrderRepositoryContract(name, makeRepo)`,
      mesmo padrão de `payment-gateway.contract.ts`.
- [ ] Os 5 casos do contrato, todos implementados de verdade (não `it.todo`/esqueleto vazio).
- [ ] `mock-order-repository.test.ts` roda `runOrderRepositoryContract(...)` com `seed: []`, além dos
      testes de B5 que já existiam (não removidos).
- [ ] `npm test`, `tsc`/`build`, `lint` — exit 0.
- [ ] Nenhum arquivo fora do escopo listado foi tocado (`account-mock.ts`, `orders-context.tsx`,
      `back/`, `packages/contracts/` intactos).

## Restrições

- **Não** invente uma assinatura diferente pro contract test — copiar exatamente o padrão de
  `payment-gateway.contract.ts`/`fulfillment-service.contract.ts`.
- **Não** modifique `account-mock.ts`, `orders-context.tsx`, `back/`, `packages/contracts/`.
- **Não** implemente `HttpOrderRepository` (B7).
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `test(front): contract test reutilizavel de OrderRepository (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Confirmação de que os 5 casos do contrato passam.
- Saída literal de `npm test`, `tsc`/`build`, `lint`.
- Hash do commit.
- Qualquer bloqueio ou decisão de detalhe tomada.
