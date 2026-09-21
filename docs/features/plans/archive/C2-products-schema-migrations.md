# C2 — back/: schema `products` estendido + migrations 0003/0004

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — seção
"Interfaces canônicas" e tarefa C2 de `.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md`
(dependência: C1, `packages/contracts` — commit `32a4ae7`, APROVADO 2026-07-26 via D-012).

## Objetivo

Estender o schema Drizzle da tabela `products` (hoje só tem `id`/`price_cents`/`supplier_id`, criada
na thread P) com as colunas que a feature 007 precisa (`name`, `brand`, `size`, `quantity`, `slug`,
`categoria`, `descricao`, `atributos`, `badge`, `active`), gerar as migrations correspondentes e
fazer o backfill dos 24 produtos existentes.

## Contexto mínimo — LER ANTES DE COMEÇAR

- **Pré-requisito de sincronização de branch:** este worktree pode estar numa branch que ainda não
  tem a migração para npm workspaces nem o commit de C1. **Antes de tocar em qualquer arquivo**,
  confirmar que o commit `32a4ae7` (que cria `packages/contracts/src/product.ts` com `ProductSchema`)
  está presente no histórico local:
  ```
  git log --oneline --all | grep 32a4ae7
  ```
  Se **não** aparecer, dar merge da branch `Romir/master-session-restart-535624` (mesmo repositório
  local, não precisa de fetch remoto) antes de continuar:
  ```
  git merge Romir/master-session-restart-535624
  ```
  Resolver qualquer conflito com cuidado (não deveria haver, já que os arquivos de `back/` não foram
  tocados por essa branch) e confirmar com `npm test`/`npm run build` no `back/` que nada quebrou
  antes de iniciar as tarefas abaixo. Se o merge falhar de um jeito inesperado, PARE e relate — não
  force nada.
- Dinheiro em **centavos** (`priceCents`/`price_cents`), nunca float. Já é o padrão em produção desde
  a thread P (`back/src/schema/products.ts:5`, `back/src/routes/orders.ts:134`).
- `packages/contracts/src/product.ts` (C1) já define `ProductSchema`/`CreateProductRequestSchema`/
  `UpdateProductRequestSchema` com os nomes de campo canônicos — **esta tarefa (C2) não precisa
  importar esses schemas** (é só o schema Drizzle + migrations), mas os nomes de coluna devem
  corresponder aos campos do contrato (ex. `priceCents`→`price_cents`, já existente).
- Stack: Hono, Drizzle ORM + drizzle-kit (D1), Wrangler (`npx -y wrangler@4.86.0`). Node >=20.19.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho:
```
git rev-parse --show-toplevel
```
O resultado tem que ser o worktree deste repositório (não o repo principal
`E:\Labdev\Projetos\fraldinha-livre` sem `.claude\worktrees\...`). Se não bater, PARAR e relatar.
Depois de confirmar o diretório, seguir a checagem de sincronização de branch da seção anterior
(merge de C1 se ainda não estiver presente) ANTES de qualquer criação/edição de arquivo.

## Tarefas (nesta ordem)

### 1. Modificar `back/src/schema/products.ts`
Schema Drizzle estendido (conteúdo exato):
```ts
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
Manter `id`/`priceCents`/`supplierId` exatamente como já estão (não renomear, não mudar tipo) — só
adicionar as colunas novas.

### 2. Gerar `back/migrations/0003_products_full.sql`
Rodar `npx drizzle-kit generate` a partir do schema modificado — **não escrever a migration à mão**.
Conferir que a saída tem todas as colunas novas (`name`, `brand`, `size`, `quantity`, `slug`,
`categoria`, `descricao`, `atributos`, `badge`, `active`) com os `DEFAULT`/`NULL` corretos para não
quebrar as 24 linhas existentes que já têm `id`/`price_cents`/`supplier_id` populados.

### 3. Criar `back/scripts/backfill-products-seed.ts`
Mesmo mecanismo de execução de `generate-products-seed.ts` (thread P, já usa `npx tsx`, devDependency
existente). Lê `PRODUCTS` de `front/src/lib/products.ts` e gera, para cada um dos 24 produtos, um
`UPDATE products SET name=..., brand=..., size=..., quantity=..., slug=..., categoria=...,
descricao=..., atributos=..., badge=..., active=1 WHERE id = '<id>'`.

**Atenção ao nome do campo de preço:** `front/src/lib/products.ts` usa `priceInCents`, mas a coluna
já existente no D1 é `price_cents` (mapeada de `priceCents` no schema Drizzle) — este script **não
toca na coluna de preço** (ela já está populada desde a thread P), só preenche as colunas novas. Não
confundir os dois nomes.

Gerar a saída SQL do script em `back/migrations/0004_backfill_products_seed.sql`. Conferir cada um
dos 24 produtos contra `front/src/lib/products.ts` (nome/marca/tamanho/slug/categoria/descrição/
atributos/badge) antes de finalizar — nenhuma linha deve ficar com os `DEFAULT` vazios da migration
0003, exceto onde isso é legitimamente o dado real (ex. `badge` nulo nos produtos sem badge).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. Aplicar as migrations 0003+0004 no D1 de teste (mesmo padrão `readD1Migrations`/`TEST_MIGRATIONS`
   já usado em `back/test/health.test.ts`).
2. `SELECT * FROM products` no D1 de teste — as 24 linhas aparecem com todas as colunas preenchidas.
3. `cd back && npm test` — suíte inteira verde (nenhum teste preexistente pode quebrar, especialmente
   os de `orders`/`products` da thread P).
4. `cd back && npx tsc --noEmit` (ou equivalente) — exit 0.
5. `cd back && npm run lint` — exit 0.
6. Confirmar que **`front/` e `packages/contracts/` não foram tocados** (`git status --short` só
   deve mostrar mudanças em `back/`).

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise. Relate o que falhou, o que tentou em cada tentativa e o estado atual.

## Critérios de aceite

- [ ] Branch sincronizada com o commit `32a4ae7` (C1) antes de qualquer edição — confirmado no
      relatório.
- [ ] `back/src/schema/products.ts` estendido exatamente como especificado.
- [ ] `back/migrations/0003_products_full.sql` gerada por `drizzle-kit generate` (não escrita à mão).
- [ ] `back/scripts/backfill-products-seed.ts` criado.
- [ ] `back/migrations/0004_backfill_products_seed.sql` criada, conferida linha a linha contra
      `front/src/lib/products.ts`.
- [ ] D1 de teste com as migrations aplicadas mostra as 24 linhas completas.
- [ ] `npm test`/`tsc`/`lint` em `back/` — todos exit 0.
- [ ] Nenhum arquivo em `front/`/`packages/contracts/` modificado.

## Restrições

- **Não** escrever migrations SQL à mão — sempre `drizzle-kit generate`.
- **Não** renomear ou mudar o tipo de `id`/`priceCents`/`supplierId` já existentes.
- **Não** tocar em `front/` ou `packages/contracts/` — esta tarefa é só `back/`.
- **Não** usar `any`.
- **Não** decidir arquitetura — se algo parecer exigir uma decisão nova fora do que está escrito
  aqui, PARE e relate a dúvida em vez de decidir sozinho.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(back): estende schema products (nome/marca/atributos/active) + backfill do seed (thread C)`

## Relatório esperado

- Confirmação do merge/sincronização de branch (ou que já estava sincronizada).
- Lista de arquivos criados/modificados.
- Saída literal dos 6 comandos/verificações de teste (não resumir).
- Hash do commit criado.
- Qualquer decisão de detalhe tomada dentro do permitido, e qualquer bloqueio, se houver.
