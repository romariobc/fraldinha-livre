# C4 — back/: `POST /products` + `PUT /products/:id` + `DELETE /products/:id`

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C4 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C3, commits `70b9ee0` +
`627a86a`, APROVADOS 2026-07-26 via D-012, já no histórico deste worktree/branch).

## Objetivo

CRUD real de produtos para o fornecedor autenticado: criar (`POST`), editar/despublicar/republicar
(`PUT`, via campo `active`), excluir de verdade (`DELETE`). Autorização é **por dono** (compara
`product.supplierId` com o `uid` do token), não por papel genérico.

## Contexto mínimo

- `back/src/routes/products.ts` hoje só tem `productsGetHandler` (C3, já aprovado).
- Contrato (`packages/contracts/src/product.ts`, C1): `ProductSchema`, `CreateProductRequestSchema`
  (omite `id`/`supplierId`/`active` — servidor sempre define esses três, nunca vêm do body, isso já é
  automático via `.omit()` do Zod, só confirmar no teste), `UpdateProductRequestSchema` (tudo
  opcional, inclui `active` opcional — única forma de despublicar/republicar).
- **Decisão sobre `slug` (a spec não define geração automática — resolvido agora, não redecidir):**
  `CreateProductRequestSchema` já EXIGE `slug` no body (`z.string().min(1)`, herdado de
  `ProductSchema`). Ou seja: o cliente sempre envia o slug, o servidor **não gera nem deriva** slug a
  partir de `name`, e esta tarefa **não verifica unicidade** de slug (fora do escopo determinado pela
  spec — se um dia for necessário, é tarefa futura). Usar o valor do body exatamente como vier.
- **Mensagens de erro exatas** (mesmo padrão de `orders.ts`):
  | Situação | Status | Corpo |
  |---|---|---|
  | Sem token | 401 | `{ error: 'unauthorized' }` |
  | Produto não existe (`PUT`/`DELETE`) | 404 | `{ error: 'product not found' }` |
  | `product.supplierId !== uid` | 403 | `{ error: 'forbidden' }` (nunca 404 — mesma disciplina
    anti-enumeração de `orders.ts`/`OrderForbiddenError`) |
  | Body inválido (Zod) | 400 | `{ error: 'invalid request', details: err.errors }` |
- Import do contrato: mesmo padrão relativo de `orders.ts`
  (`import { OrderSchema, CreateOrderRequestSchema } from '../../../packages/contracts/src/order'`)
  — para produtos, `'../../../packages/contracts/src/product'`.
- `generateUUID()` já existe em `orders.ts` mas não é exportado/compartilhado — **duplicar** a mesma
  função em `products.ts` é aceitável aqui (extrair para util compartilhado é refactor fora de
  escopo desta tarefa, não fazer).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que `70b9ee0`/`627a86a` (C3)
estão no histórico — se não, PARAR e relatar.

**Nota de coordenação:** a tarefa C5 (`GET /orders?scope=fornecedor`) também depende de C3 e toca
`back/src/routes/orders.ts` + `back/src/index.ts` — arquivos parcialmente diferentes dos que C4 toca,
mas ambas editam `index.ts`. Se C5 estiver rodando ao mesmo tempo neste mesmo worktree, **não
prosseguir em paralelo** — confirmar com a sessão-mãe qual roda primeiro, para não haver dois commits
concorrentes no mesmo arquivo sem coordenação.

## Tarefas (nesta ordem)

### 1. Modificar `back/src/routes/products.ts` — adicionar os 3 handlers novos
```ts
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env, AppContext } from '../env'
import {
  ProductSchema,
  CreateProductRequestSchema,
  UpdateProductRequestSchema,
} from '../../../packages/contracts/src/product'
import { ZodError } from 'zod'

// (productsGetHandler existente de C3 — não remover, só adicionar os handlers abaixo)

function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`
}

// POST /products — cria produto do fornecedor autenticado. supplierId/active/id sempre
// definidos pelo servidor (RN-007-01/08) — nunca vem do body (CreateProductRequestSchema
// ja os omite via .omit(), Zod descarta silenciosamente se vierem no body).
export const productsPostHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const body = await c.req.json()
    const createRequest = CreateProductRequestSchema.parse(body)

    const db = drizzle(c.env.DB)
    const id = generateUUID()

    await db.insert(products).values({
      id,
      supplierId: uid,
      active: true,
      priceCents: createRequest.priceCents,
      name: createRequest.name,
      brand: createRequest.brand,
      size: createRequest.size,
      quantity: createRequest.quantity,
      slug: createRequest.slug,
      categoria: createRequest.categoria,
      descricao: createRequest.descricao,
      atributos: createRequest.atributos,
      badge: createRequest.badge,
    })

    const savedRows = await db.select().from(products).where(eq(products.id, id)).all()
    const validated = ProductSchema.parse(savedRows[0])
    return c.json(validated, 201)
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    throw error
  }
}

// PUT /products/:id — edita produto existente (inclui despublicar/republicar via `active`).
// Autorizacao por dono: 404 se nao existe, 403 se existe mas nao e do uid (nunca o contrario).
export const productsPutHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const db = drizzle(c.env.DB)

  const existingRows = await db.select().from(products).where(eq(products.id, id)).all()
  if (existingRows.length === 0) {
    return c.json({ error: 'product not found' }, 404)
  }
  if (existingRows[0].supplierId !== uid) {
    return c.json({ error: 'forbidden' }, 403)
  }

  try {
    const body = await c.req.json()
    const updateRequest = UpdateProductRequestSchema.parse(body)

    await db.update(products).set(updateRequest).where(eq(products.id, id))

    const updatedRows = await db.select().from(products).where(eq(products.id, id)).all()
    const validated = ProductSchema.parse(updatedRows[0])
    return c.json(validated, 200)
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    throw error
  }
}

// DELETE /products/:id — remocao definitiva (nao e o mesmo que despublicar via active=false).
export const productsDeleteHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const db = drizzle(c.env.DB)

  const existingRows = await db.select().from(products).where(eq(products.id, id)).all()
  if (existingRows.length === 0) {
    return c.json({ error: 'product not found' }, 404)
  }
  if (existingRows[0].supplierId !== uid) {
    return c.json({ error: 'forbidden' }, 403)
  }

  await db.delete(products).where(eq(products.id, id))
  return c.body(null, 204)
}
```

### 2. Modificar `back/src/index.ts`
Substituir o bloco atual (de C3):
```ts
app.use('/products', async (c, next) => {
  if (c.req.query('scope') !== 'fornecedor') {
    return next()
  }
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/products', productsGetHandler)
```
por:
```ts
// Middleware para /products: GET sem scope=fornecedor eh publico; qualquer outro metodo
// (POST) ou GET com scope=fornecedor exige auth.
app.use('/products', async (c, next) => {
  const isPublicGet = c.req.method === 'GET' && c.req.query('scope') !== 'fornecedor'
  if (isPublicGet) {
    return next()
  }
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/products', productsGetHandler)
app.post('/products', productsPostHandler)

// /products/:id (PUT/DELETE) sempre autenticado - checagem de dono feita no handler (403 vs 404).
app.use('/products/:id', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
app.put('/products/:id', productsPutHandler)
app.delete('/products/:id', productsDeleteHandler)
```
E atualizar o import de `./routes/products` para incluir os 3 handlers novos
(`productsPostHandler`, `productsPutHandler`, `productsDeleteHandler`).

### 3. Criar `back/test/products.crud.test.ts`
Casos (mesmo padrão de `orders.get.test.ts`/`products.get.test.ts` para montar app de teste com
`fakeVerify`, aplicando o middleware condicional igual ao de `index.ts`):
- `POST /products` sem token → 401.
- `POST /products` com token válido, body sem campos obrigatórios → 400 (`invalid request`).
- `POST /products` com token válido, body válido, **incluindo `id`/`supplierId`/`active` extras no
  body** → 201; produto criado tem `supplierId` = uid do token (não o do body), `active: true`
  (não o do body), `id` gerado pelo servidor (não o do body) — prova RN-007-01/08 de verdade, não só
  que o campo existe.
- `PUT /products/:id` de produto inexistente → 404 (`product not found`).
- `PUT /products/:id` de produto de outro fornecedor (uid diferente) → 403 (`forbidden`), nunca 404.
- `PUT /products/:id` do próprio produto com `{ active: false }` → 200, produto atualizado some do
  `GET /products` público mas continua aparecendo em `GET /products?scope=fornecedor` do dono
  (reutilizar a infraestrutura de teste de C3 se possível).
- `PUT /products/:id` com `{ active: true }` de volta → reaparece no público.
- `DELETE /products/:id` de produto inexistente → 404.
- `DELETE /products/:id` de produto de outro fornecedor → 403.
- `DELETE /products/:id` do próprio produto → 204 sem corpo; produto não aparece mais em nenhuma
  consulta (nem público, nem `?scope=fornecedor` do dono).
- `POST`/`PUT`/`DELETE` sem token → 401 nos três (se ainda não cobertos pelos casos acima).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd back && npm test` — suíte inteira verde, incluindo `products.crud.test.ts` novo. Nenhum teste
   preexistente (`orders.*`, `products.get.test.ts`, `d1-batch-atomicity`) pode quebrar.
2. `cd back && npx tsc --noEmit` — exit 0.
3. `cd back && npm run lint` — exit 0, ou confirmar "script inexistente" (mesmo achado documentado em
   C2/C3, não criar script novo).
4. Confirmar que **`front/`/`packages/contracts/` não foram tocados**.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não invente geração de slug, não extraia `generateUUID` para um util
compartilhado. Relate o que falhou, o que tentou e o estado atual.

## Critérios de aceite

- [ ] `POST /products` cria com `supplierId`/`active`/`id` sempre definidos pelo servidor, ignorando
      esses campos se vierem no body.
- [ ] `PUT`/`DELETE /products/:id`: 404 se não existe, 403 se não é do dono (nunca o contrário), 200/
      204 se é do dono.
- [ ] Despublicar (`active:false`) via `PUT` some do público, continua em `?scope=fornecedor`;
      republicar reaparece.
- [ ] Mensagens de erro exatas conforme a tabela acima.
- [ ] `npm test`/`tsc` em `back/` exit 0. Lint exit 0 ou gap documentado.
- [ ] Nenhum arquivo em `front/`/`packages/contracts/` modificado.

## Restrições

- **Não** verificar unicidade de slug nem gerar slug automaticamente — usar o do body como vier.
- **Não** extrair `generateUUID` para um util compartilhado — duplicar é aceitável aqui.
- **Não** tocar em `front/`/`packages/contracts/`.
- **Não** usar `any`.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(back): CRUD de products (POST/PUT/DELETE) com autorizacao por dono (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 4 comandos de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido, e qualquer bloqueio.
