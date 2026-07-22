# Thread P — Backend de Produtos (fatia 2 da feature 006)

> **Para workers agenticos:** cada tarefa P-N vira um prompt Haiku completo (P1.md, P2.md, ...)
> escrito pela sessao-mae **na hora do disparo** (padrao D-006), seguindo o template de
> `README.md`. Revisao de entrega obrigatoria pelo `../review-checklist.md` (D-012).

**Spec:** `../specs/spec-backend-produtos-cloudflare.md` (APROVADA 2026-07-22, com emendas RN-P2b/P2c)
**Decisoes:** D-026 (Cloudflare Workers+D1), D-005 (monorepo), DEC-A do plano B (split por fornecedor
no front — RN-P2c so confere que o backend recebeu o `supplierId` coerente, nao reabre essa decisao).

**Objetivo da fatia:** fechar a divida DEC-A da fatia 1 (Pedidos) — o servidor passa a ter uma copia
minima do catalogo (`products`: id/preco/fornecedor) no D1 e revalida `POST /orders` contra ela antes
de gravar. Escopo estritamente backend: `front/` e `packages/contracts/` **nao mudam nesta fatia**.

**Stack:** igual a fatia 1 — Hono, Drizzle ORM + drizzle-kit (D1), Wrangler (`npx -y wrangler@4.86.0`,
pin documentado no integration-guide por causa do Node 20). Node >=20.19 (D-021).

---

## Constraints globais (valem para TODA tarefa)

- **Dinheiro em centavos** (INTEGER no D1; `number` inteiro no TS). Nunca float.
- **Rejeitar, nunca corrigir silenciosamente.** Toda divergencia (preco, fornecedor, total, campo
  ausente) e **400**, nunca um valor substituido sem avisar.
- **Falha rapido no primeiro item invalido** (RN-P3) — nao agregar erros de multiplos itens numa lista.
- **Busca em lote** (`WHERE id IN (...)`) — nunca uma query por item (achado da revisao da spec).
- **Checagem de produto roda ANTES do `db.batch()`** de criacao do pedido (RN-P4) — nao interage com
  a atomicidade ja provada em `d1-batch-atomicity.test.ts` (B4), so acontece antes dela.
- **`front/` e `packages/contracts/` INTOCADOS.** Nenhuma tarefa desta thread cria ou modifica arquivo
  fora de `back/`. Se algo parecer exigir isso, PARE e relate — e sinal de que saiu do escopo da spec.
- **Migration em duas partes:** schema via `drizzle-kit generate` (nunca escrito a mao), seed via
  script proprio — nunca no mesmo arquivo (achado da revisao: dessincroniza o snapshot do drizzle-kit).
- **Sem `any`.** `lint`/`tsc` exit 0 antes de todo relatorio (D-008, max 3 tentativas por problema).
- **Commits em pt-BR** (Conventional Commits).

---

## Interfaces canonicas (definidas UMA vez — DRY; todas as tarefas usam estas)

### Schema Drizzle (produzido por P1, consumido por P2)
```ts
// back/src/schema/products.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  priceCents: integer('price_cents').notNull(),
  supplierId: text('supplier_id').notNull(),
})
```

### Mensagens de erro 400 (produzidas por P2 — nomes exatos, para os testes baterem)
| Situacao | Mensagem (`{ error: string }`) |
|---|---|
| Produto do `productId` nao existe | `produto nao encontrado: <productId>` |
| `item.unitPrice !== product.priceCents` | `preco divergente para produto: <productId>` |
| `product.supplierId !== body.supplierId` | `fornecedor divergente para produto: <productId>` |
| `body.price` ausente | `price ausente` |
| `body.price !== soma dos itens` | `total divergente` |
| `body.supplierId` ausente | `supplierId ausente` |

### Contrato HTTP (produzido por P1/P2)
| Metodo | Rota | Auth | Resp OK | Erros novos |
|---|---|---|---|---|
| GET | `/products` | Nao | `200 { id, priceCents, supplierId }[]` | — |
| POST | `/orders` | Sim (ja existia) | `201 Order` (inalterado) | `400` (tabela acima) |

---

## Tarefas (ordem e dependencias)

```
P1 (schema + seed + GET /products) ──> P2 (validacao em POST /orders)
```
Sequencial — P2 depende da tabela `products` existir e estar populada (P1) para validar contra ela.

### P1 — `back/`: schema `products` + migrations + seed + `GET /products`  [dep: —]
- **Create:**
  - `back/src/schema/products.ts` (schema Drizzle acima).
  - `back/migrations/0001_products.sql` — **gerada por `npx drizzle-kit generate`** a partir do
    schema acima (nao escrever a mao). Conferir que o SQL resultante tem `id TEXT PRIMARY KEY`,
    `price_cents INTEGER NOT NULL`, `supplier_id TEXT NOT NULL`.
  - `back/scripts/generate-products-seed.ts` — script Node standalone (roda com `npx tsx` ou
    equivalente ja disponivel no projeto) que **importa/le** `front/src/lib/products.ts` (caminho
    relativo `../../front/src/lib/products.ts`), itera o array `PRODUCTS`, e escreve em stdout (ou
    direto no arquivo de migration) um `INSERT INTO products (id, price_cents, supplier_id) VALUES
    (...)` por produto, usando `p.id`, `p.priceInCents`, `p.supplierId`. **Nao e import de runtime do
    Worker** — so roda uma vez, na hora de gerar a migration; commitado para reprodutibilidade.
  - `back/migrations/0002_seed_products.sql` — saida do script acima, com os 24 INSERTs reais
    (confira contra `front/src/lib/products.ts` real antes de finalizar — os ids/precos/fornecedores
    tem que bater exatamente, incluindo os já vistos: `p1`/1800/`sup-001`, etc.).
  - `back/src/routes/products.ts` — handler `productsGetHandler`: `drizzle(c.env.DB).select().from(products).all()`,
    retorna `200` com o array (mapear `priceCents`/`supplierId` — Drizzle ja usa esses nomes de campo
    em camelCase no resultado, conferir).
  - `back/test/products.get.test.ts` — aplica as migrations reais (mesmo padrao de `readD1Migrations`
    ja usado em `health.test.ts`/B2), testa: `GET /products` sem nenhum header `Authorization` → 200
    (rota publica, nao e 401); resposta e array; `length === 24`; cada item tem `id`/`priceCents`/
    `supplierId` do tipo certo.
- **Modify:** `back/src/index.ts` — monta `app.get('/products', productsGetHandler)` **fora** do grupo
  `/orders/*` (sem o middleware de auth).
- **Produces:** tabela `products` real (local via migrations no D1 de teste; documentar comando pra
  aplicar no D1 remoto tambem, mesmo padrao `npx -y wrangler@4.86.0 d1 migrations apply
  fraldinha-livre-db --remote` do integration-guide).
- **DoD:** `npm test` (back) verde incluindo o novo arquivo; `GET /products` retorna os 24 produtos
  reais; `tsc`/lint exit 0; `front/`/`packages/contracts/` sem nenhuma mudanca.
- **Commit:** `feat(back): tabela products + seed + GET /products publico (thread P)`

### P2 — `back/`: `POST /orders` revalida preco/existencia/fornecedor  [dep: P1]
- **Modify:** `back/src/routes/orders.ts`, função `ordersPostHandler` — apos `CreateOrderRequestSchema.parse(body)`
  e antes de montar `orderInsert`/`itemInserts` (antes do `db.batch()`):
  1. Se `createRequest.price === undefined` → 400 `price ausente`.
  2. Se `createRequest.supplierId === undefined` → 400 `supplierId ausente`.
  3. Busca **todos** os produtos citados em `createRequest.items[].productId` numa unica query
     (`db.select().from(products).where(inArray(products.id, ids)).all()` — `inArray` de
     `drizzle-orm`), monta um `Map<id, ProductRow>` a partir do resultado.
  4. Para cada item, nesta ordem, primeiro item que falhar interrompe (RN-P3):
     - Produto nao esta no Map → 400 `produto nao encontrado: <productId>`.
     - `item.unitPrice !== product.priceCents` → 400 `preco divergente para produto: <productId>`.
     - `product.supplierId !== createRequest.supplierId` → 400 `fornecedor divergente para produto: <productId>`.
  5. Soma `Σ item.unitPrice * item.quantity` sobre os itens; se `!== createRequest.price` → 400
     `total divergente`.
  6. Só ai monta e grava via `db.batch()` (logica ja existente de B4, sem mudar).
- **Modify:** `back/test/orders.mutations.test.ts` — os fixtures atuais usam `productId: 'prod-1'`
  (fictício) — **trocar por um id real do seed** (ex.: `p1`, `priceInCents: 1800`, `supplierId:
  'sup-001'`, conferir os valores reais em `front/src/lib/products.ts` antes de escrever, nao
  assumir). Isso vale para TODOS os testes existentes de `POST /orders` que hoje passam (eles vao
  falhar com a validacao nova se continuarem usando produto fictício — atualizar os fixtures é
  correção, não invenção de caso novo).
- **Create (casos novos, no mesmo arquivo `orders.mutations.test.ts`):**
  - `POST /orders` com preço/fornecedor corretos de produto real → 201 (regressão, confirma que P2
    não quebrou o caminho feliz).
  - `POST /orders` com `unitPrice` de item errado (produto real, preço trocado) → 400 `preco
    divergente para produto: <id>`.
  - `POST /orders` com `productId` inexistente (ex.: `'produto-fantasma'`) → 400 `produto nao
    encontrado: produto-fantasma`.
  - `POST /orders` com `supplierId` do body diferente do `supplierId` real do produto → 400
    `fornecedor divergente para produto: <id>`.
  - `POST /orders` sem `price` no body → 400 `price ausente`.
  - `POST /orders` sem `supplierId` no body → 400 `supplierId ausente`.
  - `POST /orders` com `price` que não bate com a soma dos itens (preço/fornecedor OK, só o total
    errado) → 400 `total divergente`.
- **DoD:** `npm test` (back) verde — suíte inteira, incluindo os 7 casos novos + os fixtures
  corrigidos; `tsc`/lint exit 0; teste de atomicidade (`d1-batch-atomicity.test.ts`) continua
  passando sem mudança (prova que a validação nova não interferiu na transação).
- **Commit:** `feat(back): POST /orders revalida preco/existencia/fornecedor contra products (thread P)`

---

## Coerencia do app entre etapas
Depois de P1, `GET /products` ja funciona e `POST /orders` continua exatamente como estava (sem
validacao nova ainda) — nada quebra. So P2 liga a validacao. Se algum teste existente de `POST
/orders` quebrar em P1 (nao deveria, P1 nao toca `orders.ts`), isso e sinal de erro fora do escopo da
tarefa.

## Fora desta thread (fica pra fatias futuras, ja registrado na spec)
Feature 007 (cadastro/edicao/remocao de produto pelo fornecedor); migracao de `/catalogo` para
consumir o backend (`ProductRepository` porta+adapter, mesmo arco de B5-B8); `Product` em
`packages/contracts`; Estoque; validacao de `unit`/`productName`/`quantity`/`product` (agregado).

## Verificacao por tarefa (D-008) — ordem
1. Dentro de `back/`: `npm test`, depois `npx tsc --noEmit`, depois `npm run lint`.
2. Verificacoes especificas da tarefa (grep de mensagens de erro exatas, criterios de aceite da spec).
3. Loop de ate 3 tentativas POR PROBLEMA encontrado; apos a 3a falha no mesmo ponto, PARAR e reportar
   (D-008) — nao contornar com um workaround nao documentado (licao de B7: nunca esconder falha real
   atras de um try/catch ou de dado nao validado).
4. Revisao pela sessao-mae com `git show --stat` + rodar os comandos de novo por conta propria (D-012),
   nunca so o relatorio do executor.
