# Guia de Integração Frontend — Backend Real (Cloudflare Workers + D1)

> **Infra:** auth no Google/Firebase, dados/API na Cloudflare — D-027 (emenda D-001, duas nuvens por
> domínio). Ver `.claude/docs/decisoes.md` D-026 (Alternativa C) e D-027.

> **Versão:** 2026-07-21 (B9, fatia 1 — Pedidos, fechada) | **Stack:** Next.js 16 + Firebase Auth
> (client SDK, sem mudança — feature 005a) + Hono + Drizzle ORM + Cloudflare D1 + Wrangler.

Este guia documenta a integração de verdade, já em produção para o domínio **Pedidos**. Não há NextAuth,
não há credentials provider, não há endpoints REST genéricos — o padrão é **porta + adapter** (já usado
pelos mocks de pagamento/logística) mais Firebase ID Token no header `Authorization`.

---

## 1. Arquitetura — visão geral

```
Browser (Firebase client SDK, ja logado)
   │  getIdToken() → JWT do Firebase
   ▼
front/src/lib/api-client.ts (apiFetch)
   │  Authorization: Bearer <token>
   ▼
back/ — Worker Cloudflare (Hono)
   │  middleware auth.ts verifica o token (JWKS publico do Google, sem Admin SDK)
   │  extrai uid → c.get('uid')
   ▼
back/src/routes/orders.ts → Drizzle ORM → D1 (SQLite)
```

O front nunca fala com o D1 diretamente e o Worker nunca vê senha/credencial — só o ID Token do Firebase,
que ele verifica sozinho via `firebase-auth-cloudflare-workers`/`jose`.

**Domínios cobertos hoje:** só **Pedidos** (a fatia 1 da thread B). Catálogo, perfis, painel do
fornecedor **continuam em mock** (`src/lib/products.ts`, `src/lib/supplier-mock.ts` etc.) — não delete
esses arquivos ainda, eles não têm equivalente no backend.

---

## 2. Padrão porta + adapter (não é um api-client genérico)

Cada domínio migrado ganha uma **porta** (interface TS) em `front/src/lib/ports/` e dois adapters: um
**mock** (estado em memória, usado nos testes e como fallback) e um **http** (chama o Worker de verdade).
Uma flag de ambiente escolhe qual adapter o Context usa. Isso já existia para pagamento/fulfillment
(ver `front/src/lib/ports/payment.ts`); Pedidos seguiu o mesmo molde.

### `OrderRepository` (a porta, `front/src/lib/ports/order-repository.ts`)

```typescript
export interface OrderRepository {
  list(): Promise<Order[]>                       // GET /orders (do uid do token)
  create(req: CreateOrderRequest): Promise<Order> // POST /orders — cria UM pedido
  cancel(orderId: string): Promise<Order>         // PATCH /orders/:id/cancel
}
```

- **`MockOrderRepository`** (`front/src/lib/adapters/mock-order-repository.ts`) — estado em memória,
  seed = `INITIAL_ORDERS`. Usado por padrão e em todos os testes.
- **`HttpOrderRepository`** (`front/src/lib/adapters/http-order-repository.ts`) — chama o Worker via
  `apiFetch`, parseia a resposta com `OrderSchema`/`OrderListSchema` (Zod, de `@contracts`), mapeia
  403/409/404 para erros tipados (`OrderForbiddenError`, `OrderCancelNotAllowedError`,
  `OrderNotFoundError`).

Escolha do adapter, em `front/src/contexts/orders-context.tsx`:

```typescript
const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
const repo: OrderRepository = useBackend
  ? new HttpOrderRepository()
  : new MockOrderRepository({ now: ..., idFactory: ... })
```

**Gotcha resolvido em B9:** o `list()` inicial não pode disparar antes do Firebase restaurar a sessão —
sem usuário não há token, e `GET /orders` sem token é sempre `401`. Por isso o load em modo backend está
amarrado ao `onAuthStateChanged(auth, ...)`: com usuário, busca; sem usuário, lista vazia e sem erro;
login/logout re-dispara. Ao migrar um novo domínio, replique esse padrão — não faça fetch no mount puro
se o endpoint exigir auth.

**Migrar um novo domínio (ex.: Produtos) segue os mesmos 4 passos:**
1. Schema Zod em `packages/contracts/src/<dominio>.ts` (fonte única de tipos, compartilhada front/back).
2. Porta + `Mock<Dominio>Repository` no front.
3. Rota Hono + Drizzle no back (`back/src/routes/<dominio>.ts`), com o mesmo middleware de auth.
4. `Http<Dominio>Repository` no front + flag no Context correspondente.

---

## 3. `api-client.ts` — injeção do token (não é NextAuth)

`front/src/lib/api-client.ts`:

```typescript
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

Não existe `getSession`/`getServerSession` — o SDK do Firebase já mantém `auth.currentUser` no client.
`getIdToken()` renova o JWT automaticamente se estiver perto de expirar; não cacheie o token manualmente.

---

## 4. Backend (`back/`) — Worker Hono + Drizzle + D1

### 4.1 Estrutura

```
back/
├── src/
│   ├── index.ts              # app Hono, monta CORS + auth middleware + rotas
│   ├── env.ts                 # tipos de Env (Bindings) e AppContext
│   ├── middleware/auth.ts     # verifica Firebase ID Token, injeta uid no contexto
│   ├── routes/orders.ts       # GET/POST /orders, PATCH /orders/:id/cancel
│   └── schema/orders.ts       # tabelas Drizzle (orders, order_items)
├── migrations/0000_charming_mordo.sql
├── drizzle.config.ts
└── wrangler.jsonc             # binding D1 (DB), var FIREBASE_PROJECT_ID
```

### 4.2 Middleware de auth (`back/src/middleware/auth.ts`)

Verifica o ID Token contra o JWKS público do projeto Firebase (`FIREBASE_PROJECT_ID` no `wrangler.jsonc`)
— **sem Firebase Admin SDK**, sem service account, sem segredo algum no Worker. `401` se token
ausente/inválido/expirado. `uid` fica disponível via `c.get('uid')` nas rotas.

### 4.3 CORS (adicionado em B9 — não estava no plano original)

O front chama o Worker de uma origem diferente (`localhost:3000` → `*.workers.dev`), e o header
`Authorization` força o navegador a fazer **preflight** (`OPTIONS`). Sem CORS configurado, esse preflight
cai em 404 e a chamada real nunca acontece — bug só visível no navegador, não em testes/build.

`back/src/index.ts` monta `hono/cors` restrito a `http://localhost:<qualquer porta>`:

```typescript
const ALLOWED_ORIGIN = /^https?:\/\/localhost(:\d+)?$/
app.use('*', cors({
  origin: (origin) => (ALLOWED_ORIGIN.test(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}))
```

**Quando o front ganhar domínio de produção**, adicione essa origem ao regex (ou troque por lista
explícita) — sem isso, o front em produção não vai conseguir chamar o Worker.

### 4.4 Regras de servidor (RN-01..RN-08 da spec)

- `uid` **sempre** do token verificado, nunca do corpo da requisição.
- Toda query de pedido filtra por `uid` — um usuário nunca vê pedido de outro (provado em B3/B9).
- `POST /orders` ignora `id`/`uid`/`status` enviados pelo cliente; o servidor gera tudo.
- `PATCH /orders/:id/cancel`: `403` se `uid` do token ≠ dono; `409` se `status != 'aguardando'` (trava
  logística, D-025); `404` se não existe.
- Persistência de order + items em transação (D1 batch) — order nunca fica sem items.

### 4.5 Validação de produtos (fatia 2, thread P — fechou a limitação DEC-A)

A limitação original (servidor confiava cegamente em `items[]`) foi fechada. Existe uma tabela
`products` no D1 (`back/src/schema/products.ts` — schema mínimo: `id`, `priceCents`, `supplierId`),
semeada com o catálogo real (24 produtos, espelhando `front/src/lib/products.ts`; um teste dedicado,
`back/test/products.seed-consistency.test.ts`, importa o array real do front e compara com
`GET /products` — é o sensor de drift entre as duas cópias). `GET /products` é público (sem auth — é
dado de catálogo).

`POST /orders` agora, antes de qualquer escrita, para cada item do pedido:
- Rejeita (`400`) se o `productId` não existe na tabela.
- Rejeita (`400`) se `unitPrice` do item não bate com o preço real do produto.
- Rejeita (`400`) se o `supplierId` do produto não bate com o `supplierId` do pedido.
- Rejeita (`400`) se `price` (total) ou `supplierId` do corpo vierem ausentes — ambos são
  `.optional()` no schema Zod compartilhado (`packages/contracts`), mas obrigatórios nesta rota.
- Rejeita (`400`) se o `price` total não bater com a soma de `unitPrice × quantity` de todos os itens.

Toda a busca de produtos é em lote (`WHERE id IN (...)`, uma query por pedido, não por item). Nenhuma
das checagens acima interfere na transação de gravação (`db.batch()`) — elas rodam antes, e uma
rejeição não grava nada.

**Ainda não fechado:** o catálogo público (`/catalogo` no front) continua lendo o array estático — não
consome `GET /products`. Migrar isso, junto com CRUD de produto pelo fornecedor, fica para a feature 007
(sem data definida).

---

## 5. Deploy e operação — o que aprendemos em B9

### 5.1 Versão do Wrangler (Node 20)

`wrangler` ≥4.87 exige Node ≥22. A máquina de desenvolvimento está em Node 20.20.2 (D-021). **Última
versão compatível: `wrangler@4.86.0`.** Rode sempre fixando a versão:

```bash
npx -y wrangler@4.86.0 deploy
npx -y wrangler@4.86.0 d1 migrations apply fraldinha-livre-db --remote
```

Não instale Node 22 globalmente só para isso — o pin funciona e evita quebrar o resto do projeto
(front/tooling dependem de Node 20.19+, D-021).

### 5.2 Autenticação do Wrangler

`wrangler login` abre OAuth no navegador; o token fica cacheado localmente (fora do repo). É ação do
cliente, não do agente — o Worker MCP `cloudflare-bindings`/`cloudflare-api` cobre leitura/D1 query, mas
**não faz deploy** (sem ferramenta `workers_deploy` disponível até 2026-07). Deploy real sempre passa pelo
CLI.

### 5.3 D1 remoto

O banco `fraldinha-livre-db` (`database_id` no `wrangler.jsonc`) já existe e a migration
`0000_charming_mordo.sql` está aplicada (tabelas `orders`, `order_items`, índice `idx_orders_uid`). Para
aplicar migrations futuras:

```bash
npx -y wrangler@4.86.0 d1 migrations apply fraldinha-livre-db --remote
```

### 5.4 `.env.local` do front (gitignored — por worktree)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...            # mesmas chaves da feature 005a
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

NEXT_PUBLIC_BACKEND_URL=https://fraldinha-livre-backend.romariobc.workers.dev
NEXT_PUBLIC_USE_BACKEND=true
```

Cada worktree tem seu próprio `.env.local` (arquivo gitignored) — copie as chaves Firebase do
`front/.env.local` do repo principal, não invente valores novos.

### 5.5 `next.config.ts` — Turbopack + monorepo

O front importa `@contracts` de `../packages/contracts` (fora de `front/`). O Turbopack do `next dev`
detecta a raiz do projeto pelo lockfile mais próximo (`front/package-lock.json`) e **não resolve nada
fora dessa raiz** por padrão — resultado: `Module not found: Can't resolve '@contracts'` só em `next dev`
(o `build` de produção não pegava esse erro). Fix, documentado pelo próprio Next 16:

```typescript
// front/next.config.ts
import path from "path";
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname, "..") },
};
```

---

## 6. Smoke test manual do Worker

```bash
curl -s https://fraldinha-livre-backend.romariobc.workers.dev/health
# {"ok":true}

curl -s -o /dev/null -w "%{http_code}\n" https://fraldinha-livre-backend.romariobc.workers.dev/orders
# 401 (sem token)
```

---

## 7. Checklist de migração — próximos domínios

Ao trazer **Produtos**, **Perfis** ou **sync do painel do fornecedor** para o backend real, siga o mesmo
molde de Pedidos:

- [ ] Schema Zod em `packages/contracts/src/<dominio>.ts`
- [ ] Porta `<Dominio>Repository` em `front/src/lib/ports/`
- [ ] `Mock<Dominio>Repository` + contract test reutilizável (`run<Dominio>RepositoryContract`)
- [ ] Rota Hono + Drizzle em `back/src/routes/<dominio>.ts`, reaproveitando o middleware de auth existente
- [ ] `Http<Dominio>Repository` no front, usando `apiFetch`
- [ ] Context correspondente: flag `NEXT_PUBLIC_USE_BACKEND`, load gateado por auth se o endpoint exigir
      token (replicar o padrão do `onAuthStateChanged` de `orders-context.tsx`)
- [ ] CORS já cobre `/*` no Worker — não precisa reconfigurar por rota
- [ ] Migration nova em `back/migrations/`, aplicada localmente e depois com `--remote`
- [ ] Suite do front (`npm test`) e do back (`cd back && npm test`) verdes; `lint`/`tsc`/`build` exit 0
- [ ] Validação humana no navegador (refresh mantém dado; isolamento por uid com 2 contas, se aplicável)

---

## O que NÃO existe neste projeto (evite reintroduzir)

- NextAuth, `next-auth/react`, `CredentialsProvider`, `getServerSession` — auth é 100% Firebase (D-010,
  005a). Não há segredo compartilhado tipo `NEXTAUTH_SECRET`.
- Endpoints REST genéricos tipo `/comprador/pedidos`, `/fornecedor/mercado` — a API real segue o contrato
  fixado no plano B (`GET/POST /orders`, `PATCH /orders/:id/cancel`), sem prefixos de papel.
- `auth-mock.ts`/`IS_LOGGED_IN` — já removidos na feature 013/005a.
