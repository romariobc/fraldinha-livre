# B2 — back/: scaffold do Worker (Hono + Wrangler + D1) + migration 0000_orders

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-pedidos-cloudflare.md` (seção "Modelo de dados (D1)")
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B2, dep: B1 — **APROVADO**,
commit `b908dfe`, `packages/contracts` já existe com os schemas Zod).

## Objetivo

Criar `back/` como Worker Cloudflare (Hono) com binding D1, schema Drizzle das tabelas `orders` e
`order_items`, e a migration inicial gerada por `drizzle-kit generate`. Tudo roda **local** (Wrangler
emula o D1) — não há conta Cloudflare real ainda (isso é B9, prerequisito humano).

## Contexto mínimo

- Worktree ativo: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`. O
  `back/` do REPO PRINCIPAL (`E:\Labdev\Projetos\fraldinha-livre\back`) é outro diretório (branch
  `main`) — **não tocar nele**. Tudo desta tarefa vai no `back/` deste worktree.
- D-026/D-027 (Cloudflare Workers + D1) decididos — não redecidir arquitetura.
- Dinheiro em centavos (INTEGER). `uid` sempre do token (isso entra em B3, não aqui — B2 não tem auth
  ainda, só o scaffold + `/health`).
- `packages/contracts` (B1) já define os schemas Zod de `Order`/`OrderItem`/`Address` — este B2 **não
  precisa importar `@contracts` ainda** (isso entra em B3/B4 nas rotas reais); B2 é infraestrutura pura.
- Monorepo (D-005): `back/` é um pacote irmão de `front/` e `packages/contracts/`, sem workspaces npm
  no root (mesma decisão do B1 — não criar `package.json`/workspaces na raiz).

## Tarefas (nesta ordem)

### 1. `back/package.json`
Instalar (versões estáveis mais recentes via `npm install`, sem pinar major arriscado):
- dependencies: `hono`, `drizzle-orm`
- devDependencies: `drizzle-kit`, `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`,
  `vitest`, `typescript`
- scripts: `"test": "vitest run"`, `"db:generate": "drizzle-kit generate"`,
  `"dev": "wrangler dev"`, `"deploy": "wrangler deploy"`

⚠️ `@cloudflare/vitest-pool-workers` tem faixa de compatibilidade estrita com a versão do `vitest`
(peer dependency). Se `npm install` reportar conflito de peer deps, ajuste a versão do `vitest`
instalada para a que o `@cloudflare/vitest-pool-workers` pede — isso é ajuste tático de versão, não
decisão de arquitetura.

### 2. `back/wrangler.jsonc`
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "fraldinha-livre-backend",
  "main": "src/index.ts",
  "compatibility_date": "<DATA ATUAL DO SISTEMA, formato YYYY-MM-DD>",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "fraldinha-livre-db",
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ]
}
```
O `database_id` é **placeholder** — só vira real na B9 (`wrangler d1 create fraldinha-livre-db`,
prerequisito humano, o agente não cria conta/banco real). Deixar um comentário no arquivo (se o
formato jsonc permitir comentário na linha) ou documentar no relatório final que esse campo é
placeholder para B9. Use `database_name: "fraldinha-livre-db"` exatamente — B9 vai referenciar esse
nome.

### 3. `back/drizzle.config.ts`
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/orders.ts',
  out: './migrations',
  dialect: 'sqlite',
})
```

### 4. `back/src/schema/orders.ts`
Schema Drizzle das duas tabelas, fiel ao modelo da spec (`spec-backend-pedidos-cloudflare.md`, seção
"Modelo de dados (D1)"):
```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  product: text('product').notNull(),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
  price: integer('price'),
  supplierId: text('supplier_id'),
  supplierName: text('supplier_name'),
  deliveryAddress: text('delivery_address').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  uidIdx: index('idx_orders_uid').on(table.uid),
}))

export const orderItems = sqliteTable('order_items', {
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
})
```
Nomes de coluna (snake_case) devem bater EXATAMENTE com a spec: `supplier_id`, `supplier_name`,
`delivery_address`, `created_at`, `order_id`, `product_id`, `product_name`, `unit_price`.

### 5. Gerar a migration
Rodar `npx drizzle-kit generate` dentro de `back/` (não escrever o SQL à mão) — isso deve produzir
`back/migrations/0000_<algo>.sql` (o nome exato do arquivo é gerado pela ferramenta). Conferir que o
SQL resultante tem as duas tabelas com as colunas acima e o índice `idx_orders_uid` (ou nome
equivalente que o Drizzle gerar para o `index(...)` declarado). Se o nome do índice gerado for
diferente de `idx_orders_uid`, documentar no relatório — não é bloqueio.

### 6. `back/src/index.ts`
```ts
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ ok: true }))

export default app
```

### 7. `back/tsconfig.json`
Config mínima compatível com Workers (usar `@cloudflare/workers-types` nos `types`):
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

### 8. Testes — `back/test/health.test.ts` (Vitest + `@cloudflare/vitest-pool-workers`)
Antes de escrever o teste, **verifique a API atual instalada** lendo o README/types de
`back/node_modules/@cloudflare/vitest-pool-workers/` — essa lib evolui rápido e a assinatura exata de
como aplicar migrations/consultar `env` pode ter mudado desde este prompt. O comportamento esperado
(não a sintaxe exata) é:
- `back/vitest.config.ts` configurado com o pool de Workers, apontando para o `wrangler.jsonc`.
- Um teste que aplica a migration gerada no passo 5 ao D1 local de teste (via o mecanismo que a
  versão instalada da lib oferecer — ex.: `applyD1Migrations` de `cloudflare:test`, ou o padrão atual
  da documentação oficial da lib instalada).
- `GET /health` no app Hono retorna **200** e body `{ ok: true }`.
- Uma query (`SELECT name FROM sqlite_master WHERE type='table'`) confirma que as tabelas `orders` e
  `order_items` existem no D1 local depois da migration.

Se a API exata de setup/migrations da versão instalada divergir do padrão descrito acima, adapte a
sintaxe (isso é detalhe de implementação de uma lib de terceiros em evolução) mas **mantenha o
comportamento exigido** (as 3 asserções acima). Não pule a aplicação da migration nem o teste do
`/health`.

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem, todos dentro de `back/`:
1. `npm install` — sem erro (ajustar versão do vitest se houver conflito de peer dep, ver nota acima).
2. `npx drizzle-kit generate` — gera a migration; colar o SQL gerado no relatório.
3. `npm test` — os testes do passo 8 verdes (health 200 + tabelas existem).
4. `npx wrangler deploy --dry-run` — deve rodar sem precisar de login/conta Cloudflare (é só bundle +
   validação de config, não publica nada). **Se este comando falhar especificamente por exigir
   autenticação/conta Cloudflare** (não por erro de código/config), isso é um bloqueio EXTERNO
   esperado (a conta Cloudflare só existe na B9, feita pelo cliente) — documente a saída exata do erro
   no relatório como "bloqueado por prerequisito humano da B9", NÃO conte isso como uma das 3
   tentativas de correção, e NÃO tente fazer login/criar conta.
5. (Opcional, se quiser confirmar migrations localmente fora do vitest) `npx wrangler d1 migrations
   apply fraldinha-livre-db --local` — cria as tabelas no D1 emulado local; colar a saída.

**Loop de encerramento:** para falhas de CÓDIGO/CONFIG (não o item 4 quando for bloqueio de conta),
corrigir e re-verificar, MÁXIMO 3 TENTATIVAS. Após a 3ª falha: PARE, não improvise, não mude a
abordagem (ex.: não troque Hono por outro framework, não troque D1 por outro banco, não crie conta
Cloudflare). Relate o que falhou, o que tentou, e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `back/package.json`, `wrangler.jsonc`, `drizzle.config.ts`, `tsconfig.json` criados.
- [ ] `back/src/schema/orders.ts` com as tabelas `orders` e `order_items` fiéis à spec (nomes de
      coluna snake_case exatos).
- [ ] `back/migrations/0000_*.sql` gerado por `drizzle-kit generate` (não escrito à mão), refletindo o
      schema acima.
- [ ] `back/src/index.ts` com o Hono app e rota `GET /health` → `{ ok: true }`.
- [ ] `back/test/health.test.ts` (ou nome equivalente) verde: 200 em `/health`, tabelas confirmadas
      pós-migration.
- [ ] `npm test` verde dentro de `back/`.
- [ ] `wrangler deploy --dry-run` roda sem erro DE CÓDIGO/CONFIG (falha só por auth/conta é aceitável e
      deve ser documentada, não corrigida).
- [ ] Nenhum arquivo fora de `back/` foi modificado (não tocar em `front/`, `packages/contracts/`,
      `.claude/` fora deste prompt, nem no `back/` do repo principal).

## Restrições

- **Não** criar conta Cloudflare, não rodar `wrangler login`, não tentar autenticar.
- **Não** criar `package.json`/workspaces na raiz do repo.
- **Não** importar `@contracts` nesta tarefa (entra em B3/B4).
- **Não** implementar auth, `GET /orders`, `POST /orders` ou `PATCH /orders/:id/cancel` — isso é
  B3/B4. Esta tarefa é só scaffold + `/health` + schema + migration.
- **Não** usar `any`.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(back): scaffold Worker Hono + D1 + migration de pedidos (thread B)`

## Relatório esperado

- Lista de arquivos criados.
- SQL da migration gerada (colar o conteúdo real do arquivo).
- Saída literal dos 5 comandos de verificação (o item 4, se bloqueado por conta, colar o erro exato).
- Hash do commit criado (`git log -1 --oneline`).
- Qualquer ajuste de API que você teve que fazer no `@cloudflare/vitest-pool-workers` por divergência
  de versão, e qualquer bloqueio.
