# P1 — back/: schema products + migrations + seed + GET /products

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-22) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-produtos-cloudflare.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/P-backend-produtos-breakdown.md` (tarefa P1, dep: nenhuma)

## Objetivo

Criar a tabela `products` no D1 (schema mínimo: id/preço/fornecedor), semeada com os 24 produtos reais
de `front/src/lib/products.ts`, e expor `GET /products` público (sem auth) no Worker. Isso destrava a
P2 (validação de `POST /orders`), que depende desta tabela existir e estar populada.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`.
- Padrão a copiar exatamente: `back/src/schema/orders.ts` (schema Drizzle), `back/src/routes/orders.ts`
  (handler Hono), `back/test/health.test.ts` (padrão de teste com `readD1Migrations`/
  `applyD1Migrations`, já configurado em `back/vitest.config.ts` — não precisa mexer nesse arquivo).
- **Fonte da verdade dos dados de seed:** `front/src/lib/products.ts`, array `PRODUCTS` — 24 produtos,
  campos relevantes: `id` (string), `priceInCents` (number), `supplierId` (string). **Leia esse
  arquivo de verdade antes de gerar o seed — não invente valores.**
- D-026/D-027 (Cloudflare Workers + D1) decididos — não redecidir arquitetura.

## Tarefas (nesta ordem)

### 1. Criar `back/src/schema/products.ts`
```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  priceCents: integer('price_cents').notNull(),
  supplierId: text('supplier_id').notNull(),
})
```

### 2. Gerar `back/migrations/0001_products.sql`
Rodar `npx drizzle-kit generate` dentro de `back/` (mesmo comando usado na B2 para gerar
`0000_charming_mordo.sql`) — **não escrever o SQL à mão**. Confira que o resultado tem `id TEXT
PRIMARY KEY`, `price_cents INTEGER NOT NULL`, `supplier_id TEXT NOT NULL`, e que
`back/migrations/meta/` foi atualizado (novo snapshot) — isso é o que garante que o próximo
`drizzle-kit generate` não tente recriar a tabela.

### 3. Adicionar `tsx` como devDependency e criar `back/scripts/generate-products-seed.ts`
```
cd back && npm install -D tsx
```
Script (ajuste o caminho relativo se necessário, mas a intenção é ler o arquivo real do front):
```ts
// back/scripts/generate-products-seed.ts
import { PRODUCTS } from '../../front/src/lib/products'

const rows = PRODUCTS.map(
  (p) => `INSERT INTO products (id, price_cents, supplier_id) VALUES ('${p.id}', ${p.priceInCents}, '${p.supplierId}');`
)

console.log(rows.join('\n'))
```
Rodar com `npx tsx scripts/generate-products-seed.ts` (dentro de `back/`) e redirecionar a saída para
`back/migrations/0002_seed_products.sql`. Se o import direto de um arquivo `.ts` de fora de `back/`
não funcionar com `tsx` por causa de configuração de módulos, ajuste o script (ex.: copiar só o array
via um require dinâmico, ou ler o arquivo como texto e fazer parse) — mas o objetivo final é o mesmo:
os 24 INSERTs precisam refletir os valores REAIS de `front/src/lib/products.ts`, não valores
inventados. Se depois de tentar não conseguir importar diretamente, é aceitável escrever no script um
array literal copiado manualmente do arquivo real (copie exatamente `id`/`priceInCents`/`supplierId`
dos 24 produtos, conferindo cada um) — o que NÃO é aceitável é inventar valores sem conferir a fonte.

### 4. Criar `back/src/routes/products.ts`
```ts
import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { products } from '../schema/products'
import type { Env } from '../env'

// GET /products — cataogo minimo (id/preco/fornecedor), publico. Usado hoje so
// internamente pela validacao de POST /orders; nao tem consumidor no front ainda.
// Serve tambem como superficie de smoke-test operacional (thread P).
export const productsGetHandler = async (c: Context<{ Bindings: Env }>) => {
  const db = drizzle(c.env.DB)
  const rows = await db.select().from(products).all()
  return c.json(rows)
}
```
Confirme o nome exato dos campos que o Drizzle retorna (deve ser `id`, `priceCents`, `supplierId` em
camelCase, herdado do schema do passo 1) rodando o teste do passo 6 antes de fechar esta tarefa.

### 5. Modificar `back/src/index.ts`
Montar a rota nova **fora** do grupo `/orders/*` (sem middleware de auth):
```ts
import { productsGetHandler } from './routes/products'
// ...
app.get('/products', productsGetHandler)
```

### 6. Criar `back/test/products.get.test.ts`
Mesmo padrão de `health.test.ts` (aplicar migrations reais via `applyD1Migrations`/
`env.TEST_MIGRATIONS`, já configurado no `vitest.config.ts` do projeto):
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import app from '../src/index'

describe('GET /products', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('retorna 200 sem Authorization (rota publica)', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
  })

  it('retorna os 24 produtos com o shape esperado', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const body = await response.json()

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(24)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('priceCents')
    expect(body[0]).toHaveProperty('supplierId')
    expect(typeof body[0].priceCents).toBe('number')
  })
})
```

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. `npm test` — todos os testes verdes, incluindo os novos de `products.get.test.ts` (health.test.ts,
   orders.get.test.ts, orders.mutations.test.ts, d1-batch-atomicity.test.ts, cors.test.ts continuam
   passando sem nenhuma mudança — P1 não toca `orders.ts`).
2. `npx tsc --noEmit` — sem erro de tipo.
3. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade (ex.: o import
de `../../front/src/lib/products` não funcionar de jeito nenhum no ambiente do `tsx`), tente a
alternativa descrita no passo 3 (array copiado manualmente, conferido contra a fonte); se ainda assim
travar, PARE e relate o obstáculo exato.

## Critérios de aceite

- [ ] `back/src/schema/products.ts` criado, exatamente como especificado.
- [ ] `back/migrations/0001_products.sql` gerado por `drizzle-kit generate` (não escrito à mão).
- [ ] `tsx` adicionado como devDependency; `back/scripts/generate-products-seed.ts` criado e commitado.
- [ ] `back/migrations/0002_seed_products.sql` com exatamente 24 INSERTs, valores conferidos contra
      `front/src/lib/products.ts` real.
- [ ] `back/src/routes/products.ts` com `productsGetHandler`.
- [ ] `back/src/index.ts` monta `GET /products` sem auth.
- [ ] `back/test/products.get.test.ts` com os 2 casos acima, verdes.
- [ ] `npm test` completo verde (todos os arquivos, novos e existentes), `tsc`/lint exit 0.
- [ ] Nenhum arquivo fora de `back/` modificado (não tocar em `front/`, `packages/contracts/`, nem no
      `back/`/`front/` do repo principal fora deste worktree).
- [ ] `back/src/routes/orders.ts` **não foi tocado** nesta tarefa (isso é P2).

## Restrições

- **Não** escreva a migration de schema à mão — só via `drizzle-kit generate`.
- **Não** misture schema e seed no mesmo arquivo de migration — são dois arquivos (`0001`/`0002`).
- **Não** invente valores de preço/fornecedor — sempre a partir do `front/src/lib/products.ts` real.
- **Não** implemente validação em `POST /orders` nem toque em `back/src/routes/orders.ts` — isso é P2.
- **Não** modifique `front/` nem `packages/contracts/`.
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `feat(back): tabela products + seed + GET /products publico (thread P)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Confirmação de que os 24 INSERTs do seed batem com `front/src/lib/products.ts` (colar uma amostra,
  ex.: os 3 primeiros produtos, e confirmar visualmente contra o arquivo real).
- Saída literal de `npm test`, `tsc --noEmit`, `lint`.
- Hash do commit (`git log -1 --oneline`).
- Qualquer bloqueio, ajuste de mecanismo (ex.: como o import do script de seed acabou funcionando) ou
  decisão de detalhe tomada.
