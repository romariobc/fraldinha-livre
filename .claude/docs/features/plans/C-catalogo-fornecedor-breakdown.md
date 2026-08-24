# Thread C — Catálogo do Fornecedor: cadastro de produtos + sync do painel (feature 007)

> **Para workers agenticos:** cada tarefa C-N vira um prompt Haiku completo (C1.md, C2.md, ...)
> escrito pela sessao-mae **na hora do disparo** (padrao D-006), seguindo o template de
> `README.md`. Revisao de entrega obrigatoria pelo `../review-checklist.md` (D-012).

**Spec:** `../specs/spec-catalogo-fornecedor-produtos.md` (APROVADA 2026-07-25, commits `e39b329` →
`7227f4b` → `f96d54d`)
**Decisoes:** D-026/D-027 (Cloudflare Workers+D1), D-009 (Modelo A, multi-vendedor),
D-013 (Firestore rules, role imutavel), D-007/D-014 (leilao reverso INATIVO — nao mexer nesse fluxo).

**Objetivo da fatia:** resolver a amarracao `uid↔supplierId` que faltava desde o Perfil do Fornecedor,
dar ao fornecedor CRUD real de produtos (com despublicar/deletar), migrar `/catalogo` e
`/produto/[slug]` do array estatico pro backend real, e fazer o painel do fornecedor mostrar pedidos
reais (nao mais os arrays `MOCK_DIRECT_ORDERS`/`MOCK_MARKET_ORDERS`/`MOCK_OFFERS`).

**Escopo explicitamente EXCLUIDO** (ver spec, secao "Fora de escopo"): estoque transacional,
migracao/aposentadoria de `sup-001..sup-004`, notificacoes, upload de imagem. **`MOCK_MARKET_ORDERS`/
`MOCK_OFFERS` (fluxo de leilao/cotacao) permanecem mock** — o leilao esta inativo (D-007/D-014), so
`DirectOrder` (compra-direta) precisa de sync real (RN-007-05 so cobre pedidos, nao ofertas).

**Stack:** igual as fatias B/P — Hono, Drizzle ORM + drizzle-kit (D1), Wrangler
(`npx -y wrangler@4.86.0`). Node >=20.19 (D-021). Front: mesmo padrao porta+adapter+contract-test já
provado em `OrderRepository` (B5-B8).

---

## Achado da sessao-mae que nao esta na spec (ler antes de escrever C10)

A spec descreve `GET /orders?scope=fornecedor` como a fonte do "sync do painel", mas **não menciona
uma peça de código já existente que compete com ela**: `front/src/lib/order-adapters.ts`
(`orderToDirectOrder`) é chamado hoje em `front/src/app/(main)/checkout/page.tsx` logo após a criação
do pedido, pra materializar um `DirectOrder` **otimisticamente, só na memória do navegador que fez a
compra** (`addDirectOrder` do `MarketProvider`). Isso nunca persiste entre sessões/reloads e nunca
aparece pra um fornecedor logado numa aba/sessão diferente — é exatamente o buraco que RN-007-05
fecha de verdade. **C10 precisa decidir e documentar** (não adivinhar): manter esse bridge otimista
como complemento do fetch real (UX mais rápida no primeiro instante) ou removê-lo de vez agora que
existe fonte real. De qualquer forma, `orderToDirectOrder` hoje importa `Order` de
`@/lib/account-mock` (tipo antigo do lado comprador) — **não** de `@contracts`; C10 precisa checar se
dá pra reusar essa função para o `Order` vindo de `GET /orders?scope=fornecedor` (tipo `@contracts`)
ou se precisa de um mapeador novo (`contractOrderToDirectOrder`, mesmo espírito de
`contractOrderToAccountMockOrder` já usado do lado comprador, B8).

---

## Constraints globais (valem para TODA tarefa)

- **Dinheiro em centavos** (`priceCents`, INTEGER no D1). Nunca float.
- **`supplierId` nunca vem do body** em `POST /products` — sempre `c.get('uid')` do middleware de
  auth já existente (`back/src/middleware/auth.ts`, reutilizado sem mudança).
- **`active` nunca vem do body em `POST /products`** — servidor sempre cria com `true` (RN-007-08).
  Só é editável depois via `PUT`.
- **Autorizacao por dono, nao por papel generico** — `PUT`/`DELETE /products/:id` primeiro busca o
  produto, compara `product.supplierId` com o uid do token; diverge → **403** (nunca 404, mesma
  disciplina anti-enumeracao já usada em `orders.ts`/`OrderForbiddenError`).
- **Rejeitar, nunca corrigir silenciosamente.** Zod invalido → 400, nunca um valor substituido.
- **Migration em duas partes:** schema via `drizzle-kit generate` (nunca escrito a mao), backfill do
  seed existente em arquivo separado — mesma disciplina da thread P (achado da revisao P1).
- **`atributos` é JSON serializado em `TEXT`** — Drizzle usa `mode: 'json'`; Zod valida o objeto
  completo ANTES de serializar (nunca grava JSON arbitrario nao validado).
- **Migracao de `/catalogo`/`/produto/[slug]`: nunca cair silenciosamente pro array estatico antigo
  em caso de erro** (RN-007-07 — mesmo veto de catch-all silencioso ja registrado na memoria do
  projeto, [[feedback-catch-all-silencioso]]). Estado de erro explicito, mesmo padrao ja resolvido em
  B8 (`OrdersProvider`).
- **`MOCK_MARKET_ORDERS`/`MOCK_OFFERS` INTOCADOS** — leilao/cotacao continua mock (D-007/D-014). Só
  `MOCK_DIRECT_ORDERS` e substituido por dado real. Se alguma tarefa parecer exigir mexer no fluxo de
  oferta/leilao, PARE e relate — sinal de que saiu do escopo da spec.
- **Sem `any`.** `lint`/`tsc` exit 0 antes de todo relatorio (D-008, max 3 tentativas por problema).
- **Commits em pt-BR** (Conventional Commits).
- **Passo 0 obrigatorio** (ver `README.md`) — confirmar `git rev-parse --show-toplevel` antes de
  tocar em qualquer arquivo. Este worktree (`eloquent-montalcini-2dff41`) está sendo usado
  concorrentemente por outra sessão ("[FR]Master session") — reforçar ainda mais a checagem de
  diretório e **puxar (`git log --oneline -3`) antes de cada commit desta thread**, para não commitar
  em cima de um commit concorrente sem perceber.

---

## Interfaces canonicas (definidas UMA vez — DRY; todas as tarefas usam estas)

### Schema Drizzle estendido (produzido por C2, consumido por C3/C4)
```ts
// back/src/schema/products.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  priceCents: integer('price_cents').notNull(),
  supplierId: text('supplier_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  size: text('size').notNull(),
  quantity: integer('quantity').notNull(),
  slug: text('slug').notNull(),
  categoria: text('categoria').notNull(),
  descricao: text('descricao').notNull(),
  atributos: text('atributos', { mode: 'json' }).notNull(), // objeto ProductAtributos serializado
  badge: text('badge'), // nullable
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})
```

### Contrato Zod (produzido por C1, consumido por back/C3-C4 e front/C6-C9)
```ts
// packages/contracts/src/product.ts
import { z } from 'zod'

export const ProductAtributosSchema = z.object({
  faixaPeso: z.string(),
  genero: z.literal('unissex'),
  absorcao: z.string(),
  tecnologia: z.string(),
})

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  brand: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  supplierId: z.string(),
  slug: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string(),
  atributos: ProductAtributosSchema,
  badge: z.string().optional(),
  active: z.boolean(),
})
export type Product = z.infer<typeof ProductSchema>
export const ProductListSchema = z.array(ProductSchema)

// Body do POST /products — servidor define id/supplierId/active (RN-007-01/08), nunca do body.
export const CreateProductRequestSchema = ProductSchema.omit({ id: true, supplierId: true, active: true })
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>

// Body do PUT /products/:id — tudo opcional exceto o que muda; inclui `active` (unica forma de
// editar despublicar/republicar, RN-007-04).
export const UpdateProductRequestSchema = CreateProductRequestSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>
```
> Nomes exatos de campo (`priceCents`, `supplierId`, `atributos.faixaPeso` etc.) espelham
> `front/src/lib/products.ts` (`Product`/`ProductAtributos` atuais) — não inventar nomes novos, é
> migração de fonte de dados, não redesenho de schema.

### Mensagens de erro (nomes exatos — para os testes baterem, mesmo padrao de orders.ts)
| Situação | Status | Mensagem (`{ error: string }`) |
|---|---|---|
| Sem token em rota autenticada | 401 | `unauthorized` |
| Produto não existe (`PUT`/`DELETE`) | 404 | `product not found` |
| `product.supplierId !== uid` do token | 403 | `forbidden` |
| Body inválido (Zod) | 400 | `{ error: 'invalid request', details: err.errors }` (mesmo shape de `orders.ts`) |

### Contrato HTTP (produzido por C3/C4/C5)
| Método | Rota | Auth | Resp OK | Erros novos |
|---|---|---|---|---|
| GET | `/products` | Não | `200 Product[]` (só `active=true`) | — |
| GET | `/products?scope=fornecedor` | Sim | `200 Product[]` (todos do uid, ativos+inativos) | `401` |
| POST | `/products` | Sim | `201 Product` (`active:true`) | `401`, `400` |
| PUT | `/products/:id` | Sim (dono) | `200 Product` | `401`, `403`, `404`, `400` |
| DELETE | `/products/:id` | Sim (dono) | `204` | `401`, `403`, `404` |
| GET | `/orders?scope=fornecedor` | Sim | `200 Order[]` (filtrado por supplierId) | `401` |

### Porta front (produzida por C6, mesmo molde de `order-repository.ts`)
```ts
// front/src/lib/ports/product-repository.ts
export interface ProductRepository {
  list(): Promise<Product[]>                              // publico, so active=true
  listForSupplier(): Promise<Product[]>                    // autenticado, todos do uid
  create(req: CreateProductRequest): Promise<Product>
  update(id: string, req: UpdateProductRequest): Promise<Product>
  remove(id: string): Promise<void>
}

export class ProductNotFoundError extends Error { /* mesmo molde de OrderNotFoundError */ }
export class ProductForbiddenError extends Error { /* mesmo molde de OrderForbiddenError */ }
```

---

## Tarefas (ordem e dependências)

```
C1 (contracts: Product/CreateProductRequest/UpdateProductRequest)
  │
  ├──> C2 (back: schema estendido + migrations 0003/0004) ──> C3 (back: GET /products + ?scope=fornecedor)
  │                                                              │
  │                                                              ├──> C4 (back: POST/PUT/DELETE /products)
  │                                                              │
  │                                                              └──> C5 (back: GET /orders?scope=fornecedor)
  │
  └──> C6 (front: ProductRepository porta + Mock + contract test) ──> C7 (front: HttpProductRepository)
                                                                          │
                                    ┌─────────────────────────────────────┤
                                    ▼                                     ▼
                    C8 (front: /catalogo + /produto/[slug]      C9 (front: CatalogoTab.tsx
                        migram pro repository)                      no painel do fornecedor)

C7 + C5 ──> C10 (front: MarketProvider sync real — GET /orders?scope=fornecedor)

C2..C10 (revisados/aprovados) ──> C11 (deploy real + validação humana — coordenador+cliente, NAO Haiku)
```
C1 é a raiz (back e front dependem do contrato). C3 depende de C2 (schema tem que existir antes do
handler). C4/C5 podem rodar em paralelo depois de C3 (tocam arquivos diferentes:
`routes/products.ts` vs `routes/orders.ts`). C8/C9 podem rodar em paralelo depois de C7 (páginas
diferentes do front). C10 é a única tarefa que depende de DUAS pernas (C7 front + C5 back) — não
disparar antes das duas estarem aprovadas.

### C1 — `packages/contracts/`: `ProductSchema` + `CreateProductRequestSchema` + `UpdateProductRequestSchema`  [dep: —]
- **Create:** `packages/contracts/src/product.ts` (conteúdo exato na seção "Interfaces canônicas"
  acima). Exportar tudo em `packages/contracts/src/index.ts` (mesmo padrão de `order.ts`).
- **Create:** `packages/contracts/test/product.test.ts` — valida que `ProductSchema.parse()` aceita um
  produto real (usar um dos 24 de `front/src/lib/products.ts` como fixture, ex. `p1`, com `active:
  true` adicionado), rejeita `priceCents` negativo, rejeita `atributos.genero` != `'unissex'`.
  `CreateProductRequestSchema.parse()` num body com `id`/`supplierId`/`active` extras **não falha**
  (Zod não-strict) mas o `.parse()` resultante não tem esses campos (confirma que são ignorados, não
  só "não obrigatórios").
- **DoD:** `npm test` (packages/contracts) verde; `tsc` exit 0; `back/`/`front/` sem nenhuma mudança.
- **Commit:** `feat(contracts): schemas de Product/CreateProductRequest/UpdateProductRequest (thread C)`

### C2 — `back/`: schema `products` estendido + migrations 0003/0004  [dep: C1]
- **Modify:** `back/src/schema/products.ts` (schema Drizzle estendido, seção "Interfaces canônicas").
- **Create:** `back/migrations/0003_products_full.sql` — **gerada por `npx drizzle-kit generate`** a
  partir do schema estendido (não escrever a mão). Conferir que todas as colunas da spec aparecem
  (`name`, `brand`, `size`, `quantity`, `slug`, `categoria`, `descricao`, `atributos`, `badge`,
  `active`), com os `DEFAULT` corretos pra não quebrar as 24 linhas existentes (`id`/`price_cents`/
  `supplier_id` já populados desde a thread P).
- **Create:** `back/scripts/backfill-products-seed.ts` (mesmo mecanismo de execução de
  `generate-products-seed.ts` da thread P — `npx tsx`, já é devDependency desde P1) — lê
  `front/src/lib/products.ts` (`PRODUCTS`), gera um `UPDATE products SET name=..., brand=..., ...,
  active=1 WHERE id = '<id>'` por produto (24 linhas), preenchendo as colunas novas dos produtos que
  a thread P só criou com `id`/`price_cents`/`supplier_id`.
- **Create:** `back/migrations/0004_backfill_products_seed.sql` — saída do script acima. Conferir
  contra `front/src/lib/products.ts` real (nome/marca/tamanho/slug/categoria/descrição/atributos/
  badge de cada um dos 24) antes de finalizar.
- **DoD:** aplicar as migrations no D1 de teste (mesmo padrão `readD1Migrations`/`TEST_MIGRATIONS` já
  usado em `health.test.ts`); `SELECT * FROM products` mostra as 24 linhas com todas as colunas
  preenchidas (nenhuma com os valores `DEFAULT` vazios da migration 0003, exceto os campos que
  legitimamente são assim no dado real, ex. `badge` nulo pros produtos sem badge). `npm test` (back)
  verde; `tsc`/lint exit 0; `front/`/`packages/contracts/` sem mudança.
- **Commit:** `feat(back): estende schema products (nome/marca/atributos/active) + backfill do seed (thread C)`

### C3 — `back/`: `GET /products` (só `active=true`) + `GET /products?scope=fornecedor`  [dep: C2]
- **Modify:** `back/src/routes/products.ts` — `productsGetHandler` agora filtra
  `where(eq(products.active, true))` quando **não** houver `?scope=fornecedor`; quando houver,
  exige auth (reutilizar o mesmo padrão de middleware de `/orders/*` em `index.ts`, aplicado só a essa
  query string — decisão de implementação: ou um handler novo `productsGetForSupplierHandler` com rota
  própria, ou um `if` dentro do handler existente checando `c.req.query('scope')` **depois** de já ter
  passado por um middleware condicional; escolher o caminho mais parecido com o resto do arquivo e
  documentar a escolha no relatório) e retorna `where(eq(products.supplierId, uid))` **sem** o filtro
  de `active` (RN-007-04).
- **Modify:** `back/src/index.ts` — se o caminho escolhido for rota própria, montar com o middleware de
  auth já existente (mesmo padrão de `/orders/*`); se for `if` dentro do mesmo handler, aplicar auth
  condicionalmente (só quando `scope=fornecedor` está presente — `GET /products` sem esse parâmetro
  continua público, **não pode virar 401 por engano**).
- **Create/Modify:** `back/test/products.get.test.ts` (existente da thread P, estender) — `GET
  /products` sem token retorna só produtos `active=true` (seed backfillado tem todos `active:true`,
  então adicionar um fixture despublicado no teste pra provar o filtro de verdade); `GET
  /products?scope=fornecedor` sem token → 401; com token de `sup-001`-equivalente (mock de
  `verifyToken` no teste) → retorna só os produtos daquele supplierId, incluindo um despublicado de
  teste.
- **DoD:** `npm test` (back) verde; `tsc`/lint exit 0; `GET /products` público continua funcionando
  (regressão — smoke test já usado na thread P).
- **Commit:** `feat(back): GET /products filtra active + GET /products?scope=fornecedor (thread C)`

### C4 — `back/`: `POST /products` + `PUT /products/:id` + `DELETE /products/:id`  [dep: C3]
- **Modify:** `back/src/routes/products.ts` — três handlers novos:
  - `productsPostHandler`: `CreateProductRequestSchema.parse(body)`; gera `id` (mesma
    `generateUUID()` já usada em `orders.ts` — considerar extrair pra um util compartilhado se isso já
    não existir; se não existir, duplicar é aceitável aqui, não é escopo desta tarefa refatorar) e
    `slug` (a spec não define geração automática de slug — **decisão a documentar**: usar o `slug` que
    vier no body, validado único? Ou derivar de `name`? Resolver consultando a spec/perguntando na
    revisão se ambíguo; não inventar sem registrar). `supplierId = c.get('uid')`, `active = true`
    sempre (RN-007-01/08, ignora esses campos do body mesmo que enviados — `CreateProductRequestSchema`
    já não os inclui, então isso é automático via `.omit()`, só confirmar no teste). Retorna `201`.
  - `productsPutHandler`: busca produto por `:id` → não existe → `404 'product not found'`;
    `product.supplierId !== uid` → `403 'forbidden'`; senão `UpdateProductRequestSchema.parse(body)`,
    `UPDATE` só os campos presentes, retorna `200` com o produto atualizado.
  - `productsDeleteHandler`: mesma checagem de dono (404/403); `DELETE FROM products WHERE id = :id`;
    `204` sem corpo.
- **Modify:** `back/src/index.ts` — monta as 3 rotas dentro do grupo autenticado (mesmo padrão de
  `/orders/*`, middleware de auth reutilizado sem mudança).
- **Create:** `back/test/products.crud.test.ts` (novo, casos listados na spec seção "Testes" — copiar
  literalmente): criação com `supplierId`/`active` ignorados do body; `PUT`/`DELETE` por não-dono →
  403; por dono → 200/204; inexistente → 404; sem token → 401 nos três; `PUT` com `active:false` some
  de `GET /products` mas aparece em `?scope=fornecedor`; `active:true` de volta reaparece no público.
- **DoD:** `npm test` (back) verde incluindo o arquivo novo; `tsc`/lint exit 0; `d1-batch-atomicity` e
  os testes de `orders` continuam passando sem mudança (regressão — este arquivo não toca `orders.ts`).
- **Commit:** `feat(back): CRUD de products (POST/PUT/DELETE) com autorizacao por dono (thread C)`

### C5 — `back/`: `GET /orders?scope=fornecedor`  [dep: C3]
- **Modify:** `back/src/routes/orders.ts` — novo handler `ordersGetForSupplierHandler` (ou `if` no
  `ordersGetHandler` existente checando `c.req.query('scope')`, mesma decisão de padrão de C3):
  busca `order_items` cujo `product_id` está em `SELECT id FROM products WHERE supplier_id = :uid`,
  junta com `orders` pelos `order_id` resultantes, mapeia pro mesmo shape de `OrderSchema` já usado
  em `ordersGetHandler` (reaproveitar o bloco de mapeamento D1→contrato, extrair pra função auxiliar
  se ficar duplicado — julgamento do executor, documentar a escolha).
- **Modify:** `back/src/index.ts` — se rota própria, monta dentro do grupo autenticado existente
  (`/orders/*` já tem o middleware — só adicionar a rota, sem mudar o middleware).
- **Create:** `back/test/orders.scope-fornecedor.test.ts` (casos da spec): retorna só pedidos cujos
  itens referenciam produtos do uid autenticado (seed com produtos de 2 fornecedores diferentes,
  confirma que um não vê pedido do outro — mesmo espírito de RN-02 da fatia 1); sem o parâmetro,
  `GET /orders` comportamento de comprador **inalterado** (teste de regressão explícito, não assumir).
- **DoD:** `npm test` (back) verde; `tsc`/lint exit 0; suíte de `orders.get.test.ts` (comprador)
  passa sem nenhuma mudança de resultado.
- **Commit:** `feat(back): GET /orders?scope=fornecedor filtra pedidos por produtos do fornecedor (thread C)`

### C6 — `front/`: `ProductRepository` (porta) + `MockProductRepository` + contract test  [dep: C1]
- **Create:** `front/src/lib/ports/product-repository.ts` (interface + erros, seção "Interfaces
  canônicas" acima).
- **Create:** `front/src/lib/adapters/mock-product-repository.ts` — seed opcional injetável (mesmo
  padrão de `MockOrderRepository`, `seed?: Product[]`), implementa as 5 operações em memória,
  `listForSupplier` filtra pelo `supplierId` recebido no construtor/seed (decisão: como o mock sabe
  "qual fornecedor está logado"? Mesmo padrão de outros mocks — receber via parâmetro no construtor,
  não via singleton global).
- **Create:** `front/src/lib/ports/__tests__/product-repository.contract.ts` —
  `runProductRepositoryContract(name, makeRepo)`, mesmo padrão de `order-repository.contract.ts`:
  criar→aparece em `list()` (se `active`) e em `listForSupplier()`; `update` com `active:false` some
  de `list()` mas não de `listForSupplier()`; `remove` some dos dois; `update`/`remove` de id
  inexistente lança `ProductNotFoundError`.
- **Create:** `front/src/lib/adapters/__tests__/mock-product-repository.test.ts` — roda o contract
  test acima contra `MockProductRepository`.
- **DoD:** `npm test` (front) verde com os arquivos novos; `tsc`/lint exit 0; nenhum arquivo de
  produção existente (`/catalogo`, `market-context.tsx`, etc.) tocado ainda — só a camada nova,
  isolada, sem consumidor ainda (mesmo padrão de B5).
- **Commit:** `feat(front): ProductRepository (porta) + MockProductRepository + contract test (thread C)`

### C7 — `front/`: `HttpProductRepository`  [dep: C6]
- **Create:** `front/src/lib/adapters/http-product-repository.ts` — mesmo padrão de
  `http-order-repository.ts` (usa `apiFetch` de `@/lib/api-client`, injeta `Authorization: Bearer` via
  `auth.currentUser?.getIdToken()`): `list()` → `GET /products`; `listForSupplier()` → `GET
  /products?scope=fornecedor`; `create()` → `POST /products`; `update()` → `PUT /products/:id`;
  `remove()` → `DELETE /products/:id` (204, sem `.json()`); mapeia 403/404 pros erros tipados da
  porta (`ProductForbiddenError`/`ProductNotFoundError`), mesmo padrão de `HttpOrderRepository.cancel`.
- **Create:** `front/src/lib/adapters/__tests__/http-product-repository.test.ts` — roda o mesmo
  contract test de C6 contra `HttpProductRepository` com `apiFetch` mockado (mesmo padrão do
  equivalente de `http-order-repository.test.ts`, se existir esse padrão — conferir antes de escrever
  do zero).
- **DoD:** `npm test` (front) verde; `tsc`/lint exit 0; zero import de `'zod'` direto (mesma lição
  registrada em [[feedback-zod-versao-packages-contracts]] — usar só os schemas prontos de
  `@contracts`).
- **Commit:** `feat(front): HttpProductRepository (thread C)`

### C8 — `front/`: `/catalogo` e `/produto/[slug]` migram pro `ProductRepository`  [dep: C7]
**Maior risco da fatia (registrado na spec) — revisão humana no navegador obrigatória antes de aprovar.**
- **Modify:** `front/src/app/(main)/catalogo/page.tsx` (e componentes relacionados que hoje importam
  `PRODUCTS`/`filterProducts` direto de `front/src/lib/products.ts`) — troca leitura síncrona do array
  por `await productRepository.list()` (via contexto/provider novo, mesmo padrão de
  `OrdersProvider`/B8: `loading`/`error`/dado). `filterProducts` continua sendo lógica pura (recebe o
  array já carregado, não muda a assinatura) — só a **origem** do array muda.
- **Modify:** `front/src/app/(main)/produto/[slug]/page.tsx` — `getProductBySlug` (hoje síncrono sobre
  `PRODUCTS`) vira busca no repository (ou filtro sobre o resultado de `list()` já carregado, se a
  página pai já buscou — decisão de implementação, documentar a escolhida).
- **Modify:** provider novo ou extensão de contexto existente pra expor o `ProductRepository`
  (`MockProductRepository` por padrão, `HttpProductRepository` se `NEXT_PUBLIC_USE_BACKEND=true`,
  mesmo flag já usado por `OrdersProvider`).
- **Verificar:** loading state (skeleton, RN-007-07) e erro explícito (nunca cai pro array estático —
  o array `PRODUCTS` de `front/src/lib/products.ts` pode até continuar existindo no repo como fixture
  de teste do `MockProductRepository`, mas a página de produção não lê mais dele diretamente).
- **DoD:** `npm test` (front) verde (adaptar testes existentes de `/catalogo`/`/produto/[slug]` pro
  novo padrão async, mesmo trabalho que B8 fez pra `OrdersProvider`); `tsc`/lint exit 0; **`npm run
  build` sem erro** (SSR/SSG dessas páginas muda de estático pra precisar de dado em runtime — conferir
  que não quebra o build).
- **Commit:** `feat(front): /catalogo e /produto/[slug] migram para ProductRepository (thread C)`

### C9 — `front/`: `CatalogoTab.tsx` no painel do fornecedor  [dep: C7]
- **Create:** `front/src/components/fornecedor/CatalogoTab.tsx` (mesmo padrão estrutural de
  `PerfilTab.tsx` já existente no painel) — lista os produtos do próprio fornecedor
  (`listForSupplier()`, ativos e despublicados, com indicação visual clara do estado), formulário de
  criar/editar (campos da spec: nome/marca/tamanho/quantidade/preço/categoria/descrição/atributos/
  badge), toggle "Despublicar"/"Republicar" (chama `update(id, { active: !atual })`), botão "Excluir"
  com Dialog de confirmação explicitando que é definitivo (mesmo padrão de cancelamento de pedido,
  D-025) chamando `remove(id)`.
- **Modify:** `front/src/app/(main)/fornecedor/painel/page.tsx` — adiciona a aba nova (mesmo padrão de
  wiring das abas existentes, Pedidos Diretos/Ofertas/Perfil).
- **Create:** `front/src/components/fornecedor/__tests__/CatalogoTab.test.tsx` — criar produto aparece
  na lista; despublicar remove da lista pública mock (se o teste tiver acesso a essa verificação) e
  marca como despublicado na própria lista; excluir some da lista com confirmação; formulário rejeita
  submit com campos obrigatórios vazios.
- **DoD:** `npm test` (front) verde; `tsc`/lint exit 0; aba nova acessível só na role `fornecedor`
  (mesmo guard das abas existentes do painel).
- **Commit:** `feat(front): CatalogoTab no painel do fornecedor (CRUD de produtos, thread C)`

### C10 — `front/`: `MarketProvider` sync real (`GET /orders?scope=fornecedor`)  [dep: C7, C5]
**Ler a seção "Achado da sessão-mãe" no topo deste documento antes de começar — decisão sobre
`order-adapters.ts` precisa ser tomada e documentada no relatório, não pulada.**
- **Modify:** `front/src/lib/ports/order-repository.ts` — adiciona `listForSupplier(): Promise<Order[]>`
  à interface `OrderRepository` (mesmo padrão de `listForSupplier` em `ProductRepository`, C6).
- **Modify:** `front/src/lib/adapters/mock-order-repository.ts` e `http-order-repository.ts` —
  implementam o método novo (`GET /orders?scope=fornecedor` no HTTP; filtro em memória no mock).
- **Decidir e documentar** (ver achado acima): manter/adaptar/remover o bridge otimista
  `orderToDirectOrder` em `checkout/page.tsx`. Se adaptado, `order-adapters.ts` passa a aceitar
  `@contracts.Order` (não mais `@/lib/account-mock.Order`) — conferir todos os call sites antes de
  mudar a assinatura.
- **Modify:** `front/src/contexts/market-context.tsx` — `directOrders` deixa de nascer de
  `useState(MOCK_DIRECT_ORDERS)` e passa a carregar via `orderRepository.listForSupplier()` +
  mapeamento pra `DirectOrder` (função decidida no passo anterior), com `loading`/`error` explícitos
  (RN-007-07, mesmo padrão de B8). **`marketOrders`/`offers` (`MOCK_MARKET_ORDERS`/`MOCK_OFFERS`)
  continuam exatamente como estão — não tocar.**
- **Modify:** `front/src/components/fornecedor/PedidosDiretosTab.tsx` — se consumir `directOrders` do
  contexto sem mudança de shape, não precisa mudar; se assumir que os dados já chegam síncronos,
  precisa de loading/erro (verificar antes de assumir que não precisa).
- **DoD:** `npm test` (front) verde; `tsc`/lint exit 0; fornecedor A logado não vê pedidos de produtos
  do fornecedor B (teste explícito, mesmo espírito do RN-02 da fatia 1 do lado comprador).
- **Commit:** `feat(front): MarketProvider carrega pedidos diretos reais via GET /orders?scope=fornecedor (thread C)`

### C11 — Deploy real + validação humana  [dep: C2..C10 revisados e aprovados]  (coordenador + cliente, NAO Haiku)

**Mesma ordem de risco já registrada em P3 — migrations remotas ANTES do deploy, sempre:**
1. `npx -y wrangler@4.86.0 d1 migrations apply fraldinha-livre-db --remote` (aplica 0003+0004; 0000-0002
   já marcadas, não rodam de novo).
2. `npx -y wrangler@4.86.0 deploy` (back).
3. Se o front também precisar de rebuild/redeploy por causa de C8/C9 (Cloudflare Containers, H-010) —
   **checar se o H-010 já está em produção antes desta tarefa começar**; se não estiver, coordenar
   com quem estiver executando o deploy do front (não duplicar esforço).
4. **Smoke test:** `GET /products` → 200, só produtos `active=true`; `GET
   /products?scope=fornecedor` sem token → 401; `GET /orders?scope=fornecedor` sem token → 401.
5. **Regressão em produção no navegador:** login Google com conta fornecedor real → aba Catálogo →
   cadastrar produto → abrir `/catalogo` (outra aba, sem login ou como comprador) → produto aparece →
   despublicar → some do catálogo público mas continua na aba do fornecedor → editar → excluir →
   confirma sumiço definitivo. Login com conta compradora → comprar um produto → login como o
   fornecedor dono → pedido aparece na aba Pedidos Diretos.
6. **Registro:** `feature_list.json` (007 → done), `progresso.md`, nota no `integration-guide.md`
   documentando os endpoints novos de `/products` e o parâmetro `?scope=fornecedor` em `/orders`.

**DoD:** os 3 smoke tests + a regressão completa no navegador confirmados; registro escrito.
**Pré-requisito humano:** nenhum novo — Workers Paid confirmado ativo (2026-07-25), D1/Cloudflare já
em uso desde B9.

---

## Coerência do app entre etapas
C1 sozinha não muda nada visível. C2 (schema+backfill) não quebra nada — `GET /products` da thread P
continua funcionando (ainda sem filtro de `active`, que só C3 liga). C3 liga o filtro público — a
partir daqui, qualquer produto criado com `active:false` por engano (não deveria acontecer antes de
C4 existir) sumiria do catálogo; como o backfill de C2 marca todos os 24 como `active:true`, não há
regressão visível. C4 é a primeira vez que existe CRUD de verdade — antes disso, nada no front pode
depender dele. C6/C7 (front, camada isolada) não têm consumidor até C8/C9/C10 — mesmo padrão de
"camada pronta, sem efeito ainda" já usado em B5/B7. C8 é o primeiro ponto onde `/catalogo` para de
funcionar se o backend estiver fora do ar (mesma trade-off já aceita para `/minha-conta` desde B8).

## Fora desta thread (fica pra fatias futuras, já registrado na spec)
Estoque transacional (decremento no checkout, concorrência, "esgotado"); migração/aposentadoria de
`sup-001..sup-004`; notificações (feature 010); upload de imagem de produto; qualquer mudança no
fluxo de leilão/cotação (`MOCK_MARKET_ORDERS`/`MOCK_OFFERS`, D-007/D-014 — continua inativo).

## Verificação por tarefa (D-008) — ordem
1. Dentro do pacote tocado (`back/`, `front/`, ou `packages/contracts/`): `npm test`, depois `npx tsc
   --noEmit`, depois `npm run lint`.
2. Verificações específicas da tarefa (grep de mensagens de erro exatas, critérios de aceite da spec).
3. Loop de até 3 tentativas POR PROBLEMA encontrado; após a 3ª falha no mesmo ponto, PARAR e reportar
   (D-008) — não contornar com workaround não documentado.
4. Revisão pela sessão-mãe com `git show --stat` + rodar os comandos de novo por conta própria
   (D-012), nunca só o relatório do executor. **Nesta thread, adicionar um passo extra**: antes de
   revisar, `git log --oneline -5` pra confirmar que nenhum commit da "[FR]Master session" (worktree
   compartilhado) ficou intercalado de um jeito que confunda o `git show --stat` da tarefa.
