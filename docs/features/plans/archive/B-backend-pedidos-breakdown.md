# Thread B — Backend de Pedidos (Cloudflare Workers + D1) — Fatia 1

> **Para workers agenticos:** cada tarefa B-N vira um prompt Haiku completo (B1.md, B2.md, ...)
> escrito pela sessao-mae **na hora do disparo** (padrao D-006), seguindo o template de
> `README.md`. Revisao de entrega obrigatoria pelo `../review-checklist.md` (D-012).

**Spec:** `../specs/spec-backend-pedidos-cloudflare.md` (APROVADA 2026-07-17)
**Decisoes:** D-026 (Alternativa C), D-027 (auth Google + dados Cloudflare), D-005 (monorepo),
D-017 (1 pedido por fornecedor), D-018 (`Order.items[]`), D-025 (trava logistica de cancelamento).

**Objetivo da fatia:** os pedidos deixam de viver em `useState` (`orders-context.tsx:18`) e passam a
**persistir no D1** via um Worker Cloudflare, com autorizacao por `uid` do Firebase ID Token. Escopo:
**so Pedidos** (comprador cria/le/cancela os proprios). Refresh deixa de apagar pedido.

**Stack:** Hono (rotas) · Drizzle ORM + drizzle-kit (D1) · Wrangler (dev local + deploy) ·
`firebase-auth-cloudflare-workers` (verificacao do ID Token) · `packages/contracts` (Zod). Node >=20.19 (D-021).

---

## Constraints globais (valem para TODA tarefa)

- **Dinheiro em centavos** (INTEGER no D1; `number` inteiro no TS). Nunca float de reais.
- **`uid` SEMPRE do token verificado**, nunca do body (RN-01). Toda query de pedido filtra por `uid` (RN-02).
- **Queries parametrizadas via Drizzle** — nunca concatenar SQL (RN-06).
- **Suite do front permanece verde** (>=258 testes) — testes injetam o `MockOrderRepository`, nunca rede.
- **Sem `any`.** `lint`/`tsc`/`build` exit 0 antes de todo relatorio (D-008, max 3 tentativas).
- **Commits em pt-BR** (Conventional Commits).
- **Auth (005a) nao muda** — o front so passa a anexar `getIdToken()`; o Worker verifica.

---

## Duas decisoes de design fixadas aqui (a spec deixou implicitas)

### DEC-A — O split por fornecedor (D-017) fica no FRONT; o servidor persiste 1 pedido por chamada
`POST /orders` cria **um** pedido (um fornecedor). O front mantem `buildOrdersFromCart` (dominio T1, ja
testado) para dividir o carrinho por fornecedor e chama `POST /orders` **uma vez por pedido resultante**.
Motivo: o split ja e dominio puro testado; o servidor fica simples e autoritativo so no que importa
(id/uid/createdAt/status). **Limitacao conhecida e aceita nesta fatia:** ate a fatia de Produtos existir,
o servidor **confia** nos `items[]` (nomes/precos) enviados pelo cliente — nao ha catalogo no backend
para revalidar preco. Registrar no codigo e no relatorio; endurecer na fatia de Produtos.

### DEC-B — O `OrdersContext` fica ASSINCRONO (mudanca de assinatura sync -> async)
A RN-08 da spec dizia "membros nao mudam de assinatura". **Correcao honesta:** mover para backend de rede
torna `createOrdersFromCart` e `cancelOrder` assincronos (`Promise<...>`). Isso **e** uma mudanca de
assinatura e exige atualizar quem chama (a confirmacao do checkout, S5b). O que se preserva e a
**semantica** e os **nomes**; o `orders` (lista) continua sincrono (lido do estado). `loading`/`error`
sao campos **aditivos**. B8 atualiza os callers e trata loading/erro. Nao ha criacao otimista silenciosa
(risco de perder pedido em falha de rede) — a UI espera a confirmacao do servidor.

---

## Interfaces canonicas (definidas UMA vez — DRY; todas as tarefas usam estas assinaturas)

### `packages/contracts` (Zod + tipos inferidos) — produzido por B1
```ts
// address.ts
export const AddressSchema = z.object({
  logradouro: z.string().min(1), numero: z.string().min(1),
  complemento: z.string().optional(), bairro: z.string().min(1),
  cidade: z.string().min(1), estado: z.string().length(2), cep: z.string().min(1),
})
export type Address = z.infer<typeof AddressSchema>

// order.ts
export const OrderItemSchema = z.object({
  productId: z.string().min(1), productName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),   // centavos
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const OrderStatusSchema = z.enum([
  'aguardando','ofertas-recebidas','aceito','confirmado','a-caminho','entregue','cancelado',
])

export const OrderSchema = z.object({
  id: z.string(), uid: z.string(), type: z.literal('compra-direta'),
  status: OrderStatusSchema, product: z.string(),
  quantity: z.number().int().positive(), unit: z.enum(['un','cx','kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(), supplierName: z.string().optional(),
  deliveryAddress: AddressSchema, createdAt: z.string(),      // ISO 8601
  items: z.array(OrderItemSchema),
})
export type Order = z.infer<typeof OrderSchema>

// Body do POST /orders — o cliente NAO envia id/uid/createdAt/status (servidor define)
export const CreateOrderRequestSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.enum(['un','cx','kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(), supplierName: z.string().optional(),
  deliveryAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1),
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>
```

### Porta do front (produzida por B5)
```ts
// front/src/lib/ports/order-repository.ts
export interface OrderRepository {
  list(): Promise<Order[]>                       // GET /orders (do uid)
  create(req: CreateOrderRequest): Promise<Order> // POST /orders — UM pedido
  cancel(orderId: string): Promise<Order>         // PATCH /orders/:id/cancel — pedido atualizado
}
```

### Contrato HTTP (produzido por B3/B4, consumido por B7)
| Metodo | Rota | Req | Resp OK | Erros |
|---|---|---|---|---|
| GET | `/orders` | — | `200 Order[]` (do uid) | `401` sem token |
| POST | `/orders` | `CreateOrderRequest` | `201 Order` | `401`, `400` (Zod) |
| PATCH | `/orders/:id/cancel` | — | `200 Order` | `401`, `403` (nao-dono), `409` (status != aguardando), `404` |

---

## Tarefas (ordem e dependencias)

```
B1 ─┬─> B2 ─> B3 ─> B4 ──────────────┐
    ├─> B5 ─> B6                      ├─> B7 ─> B8 ─> B9
    └────────────────────────────────┘
(B5 e a trilha front; roda em paralelo a B2-B4 apos B1. B6 tambem depende do migration de B2 p/ D1 local.)
```

### B1 — `packages/contracts`: schemas Zod de Order/OrderItem/Address  [dep: —]
- **Create:** `packages/contracts/src/{address,order,index}.ts`, `packages/contracts/package.json`,
  `tsconfig.json`. **Modify:** `front/tsconfig.json` (path alias `@contracts/*` -> workspace).
- **Produces:** as interfaces canonicas acima (`OrderSchema`, `CreateOrderRequestSchema`, tipos).
- **Test:** `packages/contracts/src/__tests__/order.test.ts` — parse valido; rejeita `unitPrice`
  negativo, `estado` != 2 chars, `items` vazio; `CreateOrderRequestSchema` rejeita corpo com `uid`/`id`
  extra? (Zod por padrao ignora extras — teste documenta que `id`/`uid`/`status` do body sao ignorados.)
- **DoD:** testes verdes; `front` importa `@contracts` e compila (`tsc`); nada visual muda.
- **Commit:** `feat(contracts): schemas Zod de Order/OrderItem/Address (thread B)`

### B2 — `back/`: scaffold do Worker (Hono + Wrangler + D1) + migration 0000_orders  [dep: B1]
- **Create:** `back/package.json`, `back/wrangler.jsonc` (binding D1 `DB`, `compatibility_date`),
  `back/drizzle.config.ts`, `back/src/index.ts` (app Hono + rota `GET /health` -> `{ok:true}`),
  `back/src/schema/orders.ts` (tabelas Drizzle `orders` + `order_items`, ver modelo da spec),
  `back/migrations/0000_orders.sql` (gerado por `drizzle-kit generate`).
- **Produces:** binding `DB` (D1), `db` helper (`drizzle(env.DB)`), schema Drizzle das 2 tabelas.
- **Test:** `back/test/health.test.ts` com **Vitest + @cloudflare/vitest-pool-workers** (roda no
  runtime do Worker com D1 local); aplica migration; `GET /health` -> 200; tabela `orders` existe.
- **DoD:** `wrangler d1 migrations apply <db> --local` cria as tabelas; `npm test` no `back/` verde;
  `wrangler deploy --dry-run` ok. **Sem** deploy real ainda.
- **Commit:** `feat(back): scaffold Worker Hono + D1 + migration de pedidos (thread B)`
- **NOTA:** o binding aponta para um D1 real so em B9; ate la, tudo local (Wrangler emula).

### B3 — `back/`: middleware de auth (Firebase ID Token) + `GET /orders`  [dep: B2]
- **Create:** `back/src/middleware/auth.ts` (usa `firebase-auth-cloudflare-workers`; extrai `uid`;
  401 se ausente/invalido/expirado — RN-07), `back/src/routes/orders.ts` (`GET /orders`).
- **Modify:** `back/src/index.ts` (monta o middleware nas rotas `/orders`), `back/wrangler.jsonc`
  (var `FIREBASE_PROJECT_ID`).
- **Produces:** `c.get('uid')` no contexto Hono; `GET /orders` -> `Order[]` do uid (RN-02).
- **Test:** `back/test/orders.get.test.ts` — sem token -> 401; com token de uid=A (fake verifier
  injetado) e 2 pedidos de A + 1 de B no D1 local -> retorna **so** os 2 de A (RN-02); mapeia
  linhas D1 -> `OrderSchema` (parse valido). Injetar um verificador de token fake nos testes (nao
  chamar o Google).
- **DoD:** testes verdes; isolamento por uid provado com 2 usuarios.
- **Commit:** `feat(back): auth por Firebase ID Token + GET /orders isolado por uid (thread B)`

### B4 — `back/`: `POST /orders` + `PATCH /orders/:id/cancel`  [dep: B3]
- **Modify:** `back/src/routes/orders.ts`.
- **Produces:** os 2 endpoints conforme o contrato HTTP acima.
- **Regras de servidor:** POST valida body com `CreateOrderRequestSchema`; servidor gera `id`
  (`crypto.randomUUID()`), define `uid` (token), `createdAt` (ISO), `status='aguardando'`; grava
  order + items em **transacao** (RN-03). PATCH: 404 se nao existe; 403 se `uid` != dono (RN-04);
  409 se `status != 'aguardando'` (trava logistica, D-025); senao grava `cancelado` e retorna o pedido.
- **Test:** `back/test/orders.mutations.test.ts` — POST ignora `id/uid/status` mandados no body e usa
  os do servidor (RN-03); POST grava items (le de volta em `order_items`); PATCH de outro dono -> 403;
  PATCH de pedido `confirmado` -> 409; PATCH de `aguardando` do dono -> 200 + status `cancelado`.
- **DoD:** testes verdes cobrindo 403/409/201; transacao verificada (order sem items nao persiste).
- **Commit:** `feat(back): POST /orders + PATCH cancelar com trava logistica no servidor (thread B)`

### B5 — `front/`: `OrderRepository` (porta) + `MockOrderRepository`  [dep: B1]
- **Create:** `front/src/lib/ports/order-repository.ts` (interface acima), 
  `front/src/lib/adapters/mock-order-repository.ts` (implementa a porta com estado em memoria;
  seed = `INITIAL_ORDERS`; `create` gera id/createdAt/status como o servidor faria; `cancel` aplica a
  trava `aguardando` e lanca erro tipado fora dela).
- **Produces:** `MockOrderRepository` (usado por testes e como fallback com a flag desligada).
- **Test:** `front/src/lib/adapters/__tests__/mock-order-repository.test.ts` — comportamento basico.
  (O contrato reutilizavel vem em B6.)
- **DoD:** testes verdes; padrao identico as portas de pagamento/logistica ja existentes.
- **Commit:** `feat(front): porta OrderRepository + adapter mock (thread B)`

### B6 — `front/`: contract test `runOrderRepositoryContract`  [dep: B5, B2]
- **Create:** `front/src/lib/ports/__tests__/order-repository.contract.ts` (suite reutilizavel que
  qualquer `OrderRepository` deve passar: list vazio; create -> aparece no list; create define
  status `aguardando`; cancel em `aguardando` -> `cancelado`; cancel fora de `aguardando` -> erro).
- **Modify:** o teste do mock (B5) passa a rodar `runOrderRepositoryContract(new MockOrderRepository())`.
- **Produces:** `runOrderRepositoryContract(makeRepo, opts)`.
- **Test:** roda contra o mock (verde). (Rodar contra um adapter D1 local fica documentado como alvo do
  backend; nesta fatia o D1 e exercido pelos testes do `back/` em B3/B4.)
- **DoD:** contract test verde para o mock; suite do front continua >=258 verde.
- **Commit:** `test(front): contract test reutilizavel de OrderRepository (thread B)`

### B7 — `front/`: `HttpOrderRepository` + `api-client`  [dep: B5, B4]
- **Create:** `front/src/lib/api-client.ts` (fetch base; injeta `Authorization: Bearer <getIdToken()>`
  do Firebase; base URL de `NEXT_PUBLIC_BACKEND_URL`; erros tipados por status 401/403/409),
  `front/src/lib/adapters/http-order-repository.ts` (implementa a porta chamando os endpoints).
- **Produces:** `HttpOrderRepository`.
- **Test:** `front/src/lib/adapters/__tests__/http-order-repository.test.ts` — `fetch` mockado:
  envia o token no header; mapeia 403/409 para os erros tipados; parseia resposta com `OrderSchema`.
  Rodar tambem `runOrderRepositoryContract` contra o `HttpOrderRepository` com `fetch` mockado.
- **DoD:** testes verdes; nenhuma chamada de rede real nos testes.
- **Commit:** `feat(front): HttpOrderRepository + api-client com Firebase ID Token (thread B)`

### B8 — `front/`: `OrdersProvider` assincrono + skeleton/erro + flag de adapter  [dep: B5, B7]
- **Modify:** `front/src/contexts/orders-context.tsx` (usa `OrderRepository`; escolhe adapter por
  `NEXT_PUBLIC_USE_BACKEND`; `orders` carrega via `list()` num effect; adiciona `loading`/`error`;
  `createOrdersFromCart` faz `buildOrdersFromCart` (T1) e `await repo.create()` por pedido — DEC-A;
  `cancelOrder` -> `await repo.cancel()`); os callers do checkout (S5b) e do OrderCard (U2) passam a
  `await` — **Modify:** os componentes que chamam esses metodos (localizar via grep na execucao).
  **Create:** skeleton e tela de erro na aba Pedidos (`front/src/components/minha-conta/...`).
- **Produces:** contexto assincrono com `{ orders, loading, error, createOrdersFromCart, cancelOrder }`.
- **Test:** RTL — com `NEXT_PUBLIC_USE_BACKEND` off, injeta `MockOrderRepository` e a suite existente
  (>=258) continua verde; loading mostra skeleton; erro de `list` mostra a tela de erro; confirmar
  checkout chama `create` N vezes (1 por fornecedor) e limpa a sacola so no sucesso.
- **DoD:** suite verde; nenhuma regressao nas telas de Pedidos/checkout; lint/tsc/build 0.
- **Commit:** `feat(front): OrdersProvider assincrono (porta) + loading/erro + flag de backend (thread B)`

### B9 — Deploy do Worker + validacao HUMANA  [dep: B1..B8]  (coordenador + cliente, NAO Haiku)
- **Cliente (pre-requisito):** cria conta/projeto Cloudflare, cria o D1 (`wrangler d1 create`), faz
  `wrangler login`. O agente **nao cria conta**.
- **Coordenador:** aplica migration no D1 remoto (`wrangler d1 migrations apply <db> --remote`);
  configura `FIREBASE_PROJECT_ID` e secrets; `wrangler deploy`; seta `NEXT_PUBLIC_BACKEND_URL` e
  `NEXT_PUBLIC_USE_BACKEND=true` no front (worktree, [[worktree-env-local-gotcha]]).
- **Validacao humana:** login Google -> cria pedido no checkout -> **refresh mantem o pedido** (vem do
  D1) -> cancela so em `aguardando` (confirmado bloqueia). Testar com 2 contas que uma nao ve pedido da
  outra (RN-02).
- **DoD:** criterio de sucesso da spec atendido no navegador; feature 016 backend-persistido.
- **Commit/registro:** atualizar `feature_list.json` (006 -> avanco), `progresso.md`, `integration-guide.md`
  reescrito (fluxo Firebase ID Token -> Worker -> Drizzle -> D1).

---

## Coerencia do app entre etapas
Ate B8, o front roda com `NEXT_PUBLIC_USE_BACKEND` **off** (MockOrderRepository) — comportamento atual
preservado, suite verde. So B9 liga o backend. Nenhuma etapa deixa o app quebrado.

## Fora desta thread (fatias seguintes)
Sync do pedido no painel do fornecedor (sup-001, exige auth de fornecedor + query por `supplierId`);
Produtos no D1 (habilita o servidor a revalidar preco — fecha a limitacao de DEC-A); Perfis; Estoque
(decremento transacional). `createDirectOrder` (legado S5b/D-023): avaliar remocao em B8.

## Verificacao por tarefa (D-008) — ordem
1. `back/`: `npm test` (Vitest workers pool). `front/`: `cd front && npm run lint && npm run build`.
2. Verificacoes especificas da tarefa (greps, criterios de aceite).
3. Loop de ate 3 tentativas; apos a 3a falha, PARAR e reportar (D-008).
Revisao pela sessao-mae com `git show --stat` + build/lint proprios (D-012), nunca so o relatorio.
