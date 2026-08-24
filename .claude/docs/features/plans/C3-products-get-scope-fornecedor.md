# C3 — back/: `GET /products` filtra `active` + `GET /products?scope=fornecedor`

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C3 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C2, commits `c4ae8dd` +
`46f4d05`, APROVADOS 2026-07-26 via D-012, já no histórico deste worktree/branch).

## Objetivo

`GET /products` hoje (thread P) retorna TODOS os produtos, sem filtro. Esta tarefa faz duas coisas
na mesma rota, distinguidas por query string:
1. `GET /products` (sem `scope`) — público, sem auth, retorna **só** `active=true` (RN-007-04).
2. `GET /products?scope=fornecedor` — autenticado, retorna **todos** os produtos do `uid` do token
   (ativos + inativos), sem o filtro de `active`.

## Contexto mínimo

- `back/src/routes/products.ts` hoje só tem `productsGetHandler` sem filtro nenhum (ver arquivo).
- `back/src/index.ts` hoje monta `app.get('/products', productsGetHandler)` **fora** de qualquer
  middleware de auth (rota pública). O middleware de auth (`createAuthMiddleware` +
  `verifyFirebaseIdToken`, em `back/src/middleware/auth.ts`) hoje só é aplicado via
  `app.use('/orders/*', ...)`.
- **Decisão de arquitetura já tomada por mim (sessão-mãe) — não redecidir:** como `/products` e
  `/products?scope=fornecedor` são o MESMO path (só a query string muda), um middleware
  `app.use('/products', authMiddleware)` aplicaria auth também na chamada pública, quebrando-a. A
  solução é um middleware condicional em `index.ts` que só invoca o auth quando `scope=fornecedor`
  está presente, deixando o handler ler `c.get('uid')` do mesmo jeito que `ordersGetHandler` já faz
  (mesmo padrão, não inventar um novo). Ver código exato abaixo — seguir literalmente.
- `priceCents`/`price_cents` (nunca `priceInCents`) — nome já em produção desde a thread P.
- Zero `firebase-admin`; auth é sempre via `jose`/JWKS (D-observado no código, não redecidir).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar que o resultado é este worktree, nunca o repo principal. Depois, `git log --oneline -3`
para confirmar que os commits `c4ae8dd`/`46f4d05` (C2) estão no histórico — se não estiverem, PARAR e
relatar (não deveria acontecer, já que C3 roda no mesmo worktree que já executou C2).

## Tarefas (nesta ordem)

### 1. Modificar `back/src/routes/products.ts`
```ts
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env, AppContext } from '../env'

// GET /products — publico, so active=true (RN-007-04).
// GET /products?scope=fornecedor — autenticado (uid do middleware condicional em index.ts),
// retorna TODOS os produtos do uid (ativos + inativos), sem filtro de active.
export const productsGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope')

  if (scope === 'fornecedor') {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const rows = await db.select().from(products).where(eq(products.supplierId, uid)).all()
    return c.json(rows)
  }

  const rows = await db.select().from(products).where(eq(products.active, true)).all()
  return c.json(rows)
}
```
Ajustar o import de `Context`/tipos conforme necessário para bater com o resto do arquivo (o tipo
`AppContext['Variables']` já é usado em `orders.ts`, mesmo padrão).

### 2. Modificar `back/src/index.ts`
Adicionar o middleware condicional ANTES de `app.get('/products', productsGetHandler)` (que continua
existindo, sem mudar a linha):
```ts
// Middleware condicional: /products so exige auth quando scope=fornecedor esta presente.
// GET /products (sem scope) continua publico - NAO pode virar 401 por engano.
app.use('/products', async (c, next) => {
  if (c.req.query('scope') !== 'fornecedor') {
    return next()
  }
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
```
Colocar esse bloco logo antes de `app.get('/products', productsGetHandler)` (a ordem de
`app.use`/`app.get` no Hono importa). `createAuthMiddleware`/`verifyFirebaseIdToken` já estão
importados no arquivo (usados por `/orders/*`) — não duplicar o import.

### 3. Estender `back/test/products.get.test.ts` (arquivo já existe da thread P)
Adicionar (sem remover os testes existentes):
- Fixture: usar o seed real (24 produtos, todos `active=true` desde o backfill da C2) + inserir via
  SQL direto (mesmo padrão de `orders.get.test.ts`, `db.insert`/`db.update`) **um produto de teste
  despublicado** (`active=false`) associado a um `supplierId` de teste (ex. `'uid-fornecedor-teste'`)
  antes de rodar os casos abaixo — não modificar o seed de produção.
- `GET /products` sem token → 200, **não inclui** o produto despublicado (prova o filtro de `active`
  de verdade, já que o seed original é todo `active=true`).
- `GET /products?scope=fornecedor` sem token → 401 (usar o mesmo padrão de `createTestApp()` com
  `fakeVerify` de `orders.get.test.ts` — criar um Hono de teste equivalente montando o middleware
  condicional + `productsGetHandler`, já que testar via `app` real de `index.ts` exige mockar
  `verifyFirebaseIdToken`, mais difícil; replicar a abordagem de teste unitário isolado já usada em
  `orders.get.test.ts`).
- `GET /products?scope=fornecedor` com token válido de `'uid-fornecedor-teste'` → 200, retorna **só**
  os produtos daquele `supplierId`, incluindo o despublicado (prova RN-007-04: sem filtro de
  `active` nesse modo).
- `GET /products` (regressão) continua retornando os produtos públicos normalmente — não quebrar o
  teste existente que espera 24 (ajustar a contagem esperada se o fixture de teste adicionar produtos
  novos ao total, documentar a mudança no relatório).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd back && npm test` — suíte inteira verde, incluindo `products.get.test.ts` estendido. Nenhum
   teste preexistente (`orders.*`, `d1-batch-atomicity`) pode quebrar.
2. `cd back && npx tsc --noEmit` — exit 0.
3. `cd back && npm run lint` — exit 0 (ou confirmar que o script não existe, mesmo achado
   documentado em C2 — não criar script de lint novo, fora de escopo).
4. Confirmar manualmente (grep ou teste explícito) que `GET /products` sem `scope` **nunca** retorna
   401 — regressão crítica, a rota pública não pode ter virado autenticada por engano.
5. Confirmar que **`front/`/`packages/contracts/` não foram tocados**.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não invente um padrão de middleware diferente do especificado acima.
Relate o que falhou, o que tentou em cada tentativa e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `GET /products` sem `scope` → público (sem auth), só `active=true`.
- [ ] `GET /products?scope=fornecedor` sem token → 401.
- [ ] `GET /products?scope=fornecedor` com token válido → só produtos do `uid`, ativos+inativos.
- [ ] Middleware condicional em `index.ts` exatamente como especificado (não um middleware
      incondicional em `/products`, não uma rota separada tipo `/products/fornecedor`).
- [ ] `npm test`/`tsc` em `back/` — exit 0. Lint exit 0 ou "script inexistente" documentado (mesmo
      achado de C2).
- [ ] Nenhum arquivo em `front/`/`packages/contracts/` modificado.

## Restrições

- **Não** criar uma rota separada (ex. `/products/fornecedor`) — é o mesmo path `/products`,
  distinguido por query string, como já decidido acima.
- **Não** tocar em `front/` ou `packages/contracts/`.
- **Não** usar `any`.
- **Não** decidir arquitetura além do que está escrito aqui — se algo parecer exigir uma decisão
  nova, PARE e relate a dúvida.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(back): GET /products filtra active + GET /products?scope=fornecedor (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 5 itens de verificação (não resumir).
- Hash do commit criado.
- Qualquer decisão de detalhe tomada dentro do permitido (ex.: nome exato de um teste, uid de
  fixture), e qualquer bloqueio, se houver.
