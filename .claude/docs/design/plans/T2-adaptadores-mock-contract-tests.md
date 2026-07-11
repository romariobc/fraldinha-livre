# T2 — Adaptadores mockados + contract tests (Payment/Fulfillment)

**Feature:** 016 (compra direta)
**Tarefa do plano:** T2 (depende de T1 ✅ commit 45e7cf9)
**Papel:** subagente SA-Adapters (Haiku). Coordenador revisa pelo D-012.
**Spec:** `.claude/docs/design/specs/spec-compra-direta-carrinho-checkout.md` (RN-12 — portas com contract tests).
**Portas já definidas (T1, NÃO alterar):** `src/lib/ports/payment.ts`, `src/lib/ports/fulfillment.ts`.

---

## Objetivo

Fornecer **implementações mockadas** de `PaymentGateway` e `FulfillmentService` (adaptadores hexagonais)
para o front funcionar hoje sem backend, e — o mais importante — escrever um **contract test reutilizável**
por porta: uma suíte que testa os INVARIANTES do contrato e que QUALQUER implementação (o mock agora, o
backend real 006 depois) precisa passar sem tocar na UI. É a "prova" que o backend terá que satisfazer.

**Zero UI, zero React.** Adaptadores puros/assíncronos, determinísticos (sem `Date.now()`/`Math.random()`
internos — injetar `now`/`idFactory`). Sem `any`.

## Escopo — arquivos a CRIAR (todos novos)

### 1. `front/src/lib/ports/__tests__/payment-gateway.contract.ts`
Suíte de contrato REUTILIZÁVEL (não é um `.test.ts` que roda sozinho — é uma função exportada que outros
testes chamam). Assinatura:
```ts
export function runPaymentGatewayContract(
  name: string,
  makeGateway: () => PaymentGateway
): void
```
Dentro dela, um `describe(name, () => { ... })` com `it(...)` que valida SÓ invariantes válidos para
QUALQUER implementação conformante, usando um `PaymentRequest` padrão:
- `charge()` resolve para um objeto com `status` ∈ `{'approved','declined','pending'}`.
- `transactionId` é string não-vazia.
- **Invariante approved⟺paidAt:** se `status === 'approved'` então `paidAt` é uma string ISO 8601 válida
  (parseável por `new Date(...)`, sem virar `Invalid Date`); se `status !== 'approved'` então `paidAt` é `undefined`.
- `charge()` retorna uma `Promise` (é awaitable).
NÃO assumir aprovado nem recusado — o contrato aceita qualquer status; só o invariante de consistência é exigido.

### 2. `front/src/lib/ports/__tests__/fulfillment-service.contract.ts`
Análogo, `runFulfillmentServiceContract(name, makeService)`. Invariantes:
- `schedule()` resolve com `status` ∈ `{'scheduled','rejected'}`.
- **Invariante scheduled⟺tracking:** se `status === 'scheduled'` então `trackingCode` é string não-vazia
  e `estimatedDays` é número inteiro ≥ 0; se `status === 'rejected'` então `trackingCode` e `estimatedDays`
  são `undefined`.

### 3. `front/src/lib/adapters/mock-payment-gateway.ts`
`class MockPaymentGateway implements PaymentGateway`. Determinístico e configurável para testes:
- Construtor recebe opções injetadas: `{ now: () => string; idFactory: () => string; outcome?: 'approved' | 'declined' | 'pending' }`.
  `outcome` default = `'approved'`.
- `charge(req)`:
  - `pending`/`declined` → retorna esse status, `transactionId` via `idFactory()`, SEM `paidAt`.
  - `approved` → `paidAt = now()`, `transactionId` via `idFactory()`.
  - Deve honrar o invariante approved⟺paidAt do contrato.
- Sem I/O real, sem timers. É só uma simulação em memória.

### 4. `front/src/lib/adapters/mock-fulfillment-service.ts`
`class MockFulfillmentService implements FulfillmentService`. Análogo:
- Construtor: `{ idFactory: () => string; outcome?: 'scheduled' | 'rejected'; estimatedDays?: number }`.
  `outcome` default `'scheduled'`, `estimatedDays` default `3`.
- `schedule(req)`:
  - `scheduled` → `trackingCode` via `idFactory()`, `estimatedDays` do construtor.
  - `rejected` → sem `trackingCode`/`estimatedDays`.
  - Honra o invariante scheduled⟺tracking.

### 5. `front/src/lib/adapters/__tests__/mock-payment-gateway.test.ts`
- Importa e RODA o contrato: `runPaymentGatewayContract('MockPaymentGateway (approved)', () => new MockPaymentGateway({ now: () => '2026-07-09T10:00:00Z', idFactory: () => 'tx-1' }))`.
- Roda o contrato também para uma instância com `outcome: 'declined'` e outra `'pending'` (garante que o
  invariante vale nos 3 caminhos).
- Testes ESPECÍFICOS do mock (além do contrato): approved usa o `now()` injetado em `paidAt`; `transactionId`
  vem do `idFactory` injetado; declined/pending não trazem `paidAt`.

### 6. `front/src/lib/adapters/__tests__/mock-fulfillment-service.test.ts`
- Roda `runFulfillmentServiceContract` para `outcome` scheduled e rejected.
- Testes específicos: scheduled traz `trackingCode` do `idFactory` e `estimatedDays` injetado; rejected não traz nenhum.

---

## Restrições (governança)

- **NÃO** alterar as portas do T1 (`ports/payment.ts`, `ports/fulfillment.ts`) nem qualquer arquivo existente.
- **NÃO** usar `any`. Sem `Date.now()`/`Math.random()`/`new Date()` DENTRO dos adaptadores (só `new Date(str)`
  para validar ISO nos testes de contrato é permitido).
- Import das interfaces/tipos: `PaymentGateway`, `PaymentRequest`, `PaymentResult` de `@/lib/ports/payment`;
  `FulfillmentService` etc. de `@/lib/ports/fulfillment`; `Address` de `@/lib/account-mock`; `OrderItem` de
  `@/lib/domain/order` conforme necessário para montar requests de teste.
- Nada de React/hooks/localStorage/fetch.

## Critério de pronto (DoD) — provar com execução

Rodar **no `front/` do worktree** (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):

1. `npm test` → **todos verdes** (os 42 anteriores + os novos de adaptadores). Colar a saída real.
2. `npm run lint` → **EXIT 0** (o warning pré-existente em `supplier-mock.ts` é aceitável; nenhum novo).
3. `npx tsc --noEmit` → **sem erro**.

Loop de no máximo **3 tentativas** de correção. Se ainda falhar, **PARAR** e reportar o bloqueio exato
(comando + saída literal). NÃO fazer commit — a sessão-mãe revisa e commita.

## Entregável

- Os 6 arquivos criados (2 adaptadores + 2 contratos reutilizáveis + 2 test files).
- Saída literal dos 3 comandos do DoD.
- Decisões de borda tomadas.
