# B7 — front/: HttpOrderRepository + api-client

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B7, dep: B5 e B4 — ambos
APROVADOS). Contrato HTTP na seção "Endpoints (Hono...)" do mesmo arquivo.

## Objetivo

Criar o adapter que fala com o Worker de verdade: `api-client.ts` (fetch + Firebase ID Token) +
`HttpOrderRepository` (implementa `OrderRepository` chamando os 3 endpoints já implementados em
B2-B4). **Nenhuma chamada de rede real nos testes** — tudo com `fetch` mockado.

## Contexto mínimo — LER antes de escrever

- Contrato HTTP (já implementado no Worker, B2-B4):

  | Método | Rota | Resp OK | Erros |
  |---|---|---|---|
  | GET | `/orders` | `200 Order[]` | `401` sem token |
  | POST | `/orders` | `201 Order` | `401`, `400` (corpo inválido) |
  | PATCH | `/orders/:id/cancel` | `200 Order` | `401`, `403` (não-dono), `409` (status≠aguardando), `404` |

- **Achado real, resolver assim (não é o que o handshake original assumia):** o `useAuth()` de
  `front/src/contexts/auth-context.tsx` **NÃO expõe `getIdToken()`** — o `user` ali é um objeto
  simplificado (`{ uid, email, displayName }`), sem métodos do Firebase. **Não modifique
  `auth-context.tsx`** (fora de escopo, mais risco). Em vez disso, `api-client.ts` importa `auth`
  DIRETO de `@/lib/firebase` (já exportado, `export const auth = getAuth(app)`) e chama
  `auth.currentUser?.getIdToken()` — é a forma correta de pegar o token fora de um componente React
  (e além disso, chamar `getIdToken()` a cada request deixa o SDK do Firebase renovar o token sozinho
  se estiver expirado, o que seria pior se fosse cacheado em estado).
- `front/src/lib/ports/order-repository.ts` (B5/B6) — `OrderRepository`, `OrderNotFoundError`,
  `OrderCancelNotAllowedError`. Falta um erro pro caso `403`, ver passo 1 abaixo.
- `@contracts` — `Order`, `OrderSchema`, `CreateOrderRequest`.
- Não existe `.env.local` neste worktree (gotcha conhecido) — `NEXT_PUBLIC_BACKEND_URL` vai ficar
  `undefined` em dev/test aqui, e é esperado: os testes mockam `fetch` inteiro, não fazem request real.

## Tarefas (nesta ordem)

### 1. Modificar `front/src/lib/ports/order-repository.ts` — adicionar `OrderForbiddenError`
Aditivo, ao lado das 2 classes de erro que já existem:
```ts
/** Lançado por cancel() quando o pedido existe mas não pertence ao usuário atual (403, RN-04). */
export class OrderForbiddenError extends Error {
  constructor(orderId: string) {
    super(`Not allowed to cancel order: ${orderId}`)
    this.name = 'OrderForbiddenError'
  }
}
```

### 2. Criar `front/src/lib/api-client.ts`
```ts
import { auth } from '@/lib/firebase'

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${BASE_URL}${path}`, { ...init, headers })
}
```
Camada fina: só injeta auth/base URL. NÃO interpreta status code nem faz parse de JSON aqui — isso é
do `HttpOrderRepository` (separação de responsabilidade: transporte vs. domínio).

### 3. Criar `front/src/lib/adapters/http-order-repository.ts`
```ts
import { z } from 'zod'
import { apiFetch } from '@/lib/api-client'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError, OrderForbiddenError } from '@/lib/ports/order-repository'
import type { Order, CreateOrderRequest } from '@contracts'
import { OrderSchema } from '@contracts'

export class HttpOrderRepository implements OrderRepository {
  async list(): Promise<Order[]> {
    const res = await apiFetch('/orders')
    if (!res.ok) throw new Error(`Failed to list orders: HTTP ${res.status}`)
    const json = await res.json()
    return z.array(OrderSchema).parse(json)
  }

  async create(req: CreateOrderRequest): Promise<Order> {
    const res = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(req) })
    if (!res.ok) throw new Error(`Failed to create order: HTTP ${res.status}`)
    const json = await res.json()
    return OrderSchema.parse(json)
  }

  async cancel(orderId: string): Promise<Order> {
    const res = await apiFetch(`/orders/${orderId}/cancel`, { method: 'PATCH' })
    if (res.status === 404) throw new OrderNotFoundError(orderId)
    if (res.status === 403) throw new OrderForbiddenError(orderId)
    if (res.status === 409) throw new OrderCancelNotAllowedError(orderId, 'unknown')
    if (!res.ok) throw new Error(`Failed to cancel order: HTTP ${res.status}`)
    const json = await res.json()
    return OrderSchema.parse(json)
  }
}
```
Nota sobre `OrderCancelNotAllowedError(orderId, 'unknown')`: o corpo do 409 que o Worker retorna hoje
(`{ error: 'cannot cancel: order is not awaiting' }`) não inclui o status atual — não dá pra extrair o
valor real. `'unknown'` é aceitável aqui (é só o texto da mensagem de erro, o que importa é o TIPO do
erro lançado). Se preferir extrair algo do corpo da resposta, pode, mas não é obrigatório.

### 4. Testes — `front/src/lib/adapters/__tests__/http-order-repository.test.ts`

**Parte A — comportamento específico do HTTP (fetch mockado simples, um teste por caso):**
- `list()` envia `Authorization: Bearer <token>` no header (mock `@/lib/firebase`'s `auth.currentUser`
  com `getIdToken` retornando um token fixo; mock `global.fetch`, capture os args da chamada e
  confirme o header).
- `create()`/`cancel()` também enviam o header.
- `cancel()`: mock fetch retornando status `403` → `HttpOrderRepository.cancel()` rejeita com
  `OrderForbiddenError`. Status `409` → rejeita com `OrderCancelNotAllowedError`. Status `404` →
  rejeita com `OrderNotFoundError`.
- `list()` com resposta 200 válida → resultado parseado bate com `OrderSchema` (roundtrip básico).

**Parte B — `runOrderRepositoryContract` contra o `HttpOrderRepository` (fetch mockado como um mini
backend fake com estado, não respostas fixas):**

```ts
function createFakeFetch() {
  let fakeDb: Order[] = []
  let counter = 0
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.endsWith('/orders')) {
      return new Response(JSON.stringify(fakeDb), { status: 200 })
    }
    if (method === 'POST' && url.endsWith('/orders')) {
      const body = JSON.parse(init!.body as string)
      counter += 1
      const order = OrderSchema.parse({
        id: `fake-order-${counter}`,
        uid: 'fake-uid',
        type: 'compra-direta',
        status: 'aguardando',
        createdAt: new Date(2026, 0, 1).toISOString(),
        ...body,
      })
      fakeDb.push(order)
      return new Response(JSON.stringify(order), { status: 201 })
    }
    const cancelMatch = url.match(/\/orders\/([^/]+)\/cancel$/)
    if (method === 'PATCH' && cancelMatch) {
      const order = fakeDb.find((o) => o.id === cancelMatch[1])
      if (!order) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      if (order.status !== 'aguardando') {
        return new Response(JSON.stringify({ error: 'not allowed' }), { status: 409 })
      }
      order.status = 'cancelado'
      return new Response(JSON.stringify(order), { status: 200 })
    }
    throw new Error(`fetch fake nao trata: ${method} ${url}`)
  })
}

// dentro de uma factory que zera o estado a cada chamada de makeRepo():
runOrderRepositoryContract('HttpOrderRepository (fetch mockado)', () => {
  vi.stubGlobal('fetch', createFakeFetch())
  return new HttpOrderRepository()
})
```
Ajuste os imports/mocks de `@/lib/firebase` conforme necessário pra `auth.currentUser?.getIdToken()`
não quebrar (pode ser um mock simples retornando uma string fixa, ou `undefined` — o fake fetch acima
não valida o header, só o comportamento de list/create/cancel). Confirme que `vi.stubGlobal`/mock de
módulo é restaurado entre os `describe` blocks se necessário (`afterEach(() => vi.unstubAllGlobals())`
ou equivalente) pra não vazar estado entre a Parte A e a Parte B do arquivo de teste.

## Testes e verificação (D-008)

Dentro de `front/`:
1. `npm test` — suíte inteira verde. **Confirme que NENHUM teste faz request de rede real** (todos os
   `fetch` usados nos testes deste arquivo devem ser mock/stub).
2. `npx tsc --noEmit` (ou build) — sem erro de tipo.
3. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas. Se o mock de `@/lib/firebase` ou o fake fetch da Parte B não se
comportar como esperado, ajuste — mas não pule a Parte B (rodar o contract test contra o HTTP adapter é
critério de aceite, não opcional).

## Critérios de aceite

- [ ] `order-repository.ts` ganhou `OrderForbiddenError` (aditivo).
- [ ] `api-client.ts`: injeta `Authorization: Bearer` via `auth.currentUser?.getIdToken()` (não via
      `useAuth()`), usa `NEXT_PUBLIC_BACKEND_URL` como base.
- [ ] `http-order-repository.ts`: mapeia 404→`OrderNotFoundError`, 403→`OrderForbiddenError`,
      409→`OrderCancelNotAllowedError`; parseia respostas com `OrderSchema`/`z.array(OrderSchema)`.
- [ ] Parte A: testes específicos de header + mapeamento de status, todos verdes.
- [ ] Parte B: `runOrderRepositoryContract` roda contra `HttpOrderRepository` com fetch mockado
      stateful, os 5 casos do contrato passam.
- [ ] `npm test`, `tsc`/`build`, `lint` — exit 0. Nenhuma chamada de rede real.
- [ ] **`auth-context.tsx` NÃO foi modificado.**
- [ ] Nenhum arquivo fora do escopo tocado (`account-mock.ts`, `orders-context.tsx`, `back/`,
      `packages/contracts/` intactos).

## Restrições

- **Não** modifique `auth-context.tsx` — pegar o token é via `auth.currentUser?.getIdToken()` direto
  de `@/lib/firebase`, não via `useAuth()`.
- **Não** modifique `orders-context.tsx` nem componentes de UI — isso é B8.
- **Não** faça requests de rede reais em nenhum teste.
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `feat(front): HttpOrderRepository + api-client com Firebase ID Token (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Confirmação de que a Parte B (contract test contra HTTP) passou — colar os 5 nomes de `it(...)`.
- Saída literal de `npm test`, `tsc`/`build`, `lint`.
- Hash do commit.
- Qualquer bloqueio, ajuste de detalhe ou decisão tomada (ex.: se precisou ajustar o mock de
  `@/lib/firebase`).
