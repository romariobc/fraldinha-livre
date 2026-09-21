# M3 — back/: tools de dados search_products/get_product para o chat-agent

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M3, dep: nenhuma)

## Objetivo

Criar as duas funções que o chat-agent vai usar para consultar o catálogo REAL (tabela `products` do
D1 — a mesma que `GET /products` já usa, não um catálogo paralelo): `searchProducts` (busca por
nome/marca/categoria) e `getProduct` (detalhe por id). Essas funções são consumidas pela rota
`/chat/message` (tarefa M4, futura) — esta tarefa **não cria a rota**, só as funções e os testes delas.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser este worktree
(`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`), **NUNCA**
o repo principal. Se não bater, PARAR e relatar antes de continuar.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`.
- Padrão a copiar exatamente:
  - `back/src/routes/products.ts`, função `productsGetHandler` — como o projeto já filtra
    `where(eq(products.active, true))` na rota pública de produtos (RN-007-04: produto despublicado não
    aparece pra ninguém fora do dono). As tools desta tarefa seguem a MESMA regra — nunca retornar
    produto `active: false` pro chat, porque o chat é uma superfície voltada ao comprador, igual o
    catálogo público.
  - `back/test/products.get.test.ts` — como os testes deste projeto aplicam as migrations reais
    (`applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`, já configurado) contra o seed real de 24 produtos
    (não um seed inventado pela tarefa), e como inserir uma fixture extra (`db.insert(products).values(...)`)
    quando o teste precisa de um caso que o seed não cobre (ex. produto despublicado).
  - `back/src/schema/products.ts` — schema Drizzle real da tabela `products` (campos: `id`,
    `priceCents`, `supplierId`, `name`, `brand`, `size`, `quantity`, `slug`, `categoria`, `descricao`,
    `atributos`, `badge`, `supplierEmail`, `active`).
- **Produtos reais do seed pra usar nos testes** (conferidos em `front/src/lib/products.ts`, NÃO
  inventar outros): `p1` = nome `Supersec Pants`, marca `Pampers`, categoria `fraldas-descartaveis`,
  tamanho `P`. `h1` = nome `Supreme Care`, marca `Huggies`, categoria `fraldas-descartaveis`. Se algum
  teste abaixo precisar de outro produto real, confira `front/src/lib/products.ts` antes de escrever —
  não invente `id`/`name`/`brand`.
- **Decisão de escopo — NÃO exponha `supplierEmail` nem `supplierId` pras tools desta tarefa.** O
  resultado de `searchProducts`/`getProduct` vai virar contexto de um prompt de LLM (tarefa M4) — não
  faz sentido nem é seguro vazar e-mail de fornecedor pra dentro do histórico de conversa. Selecione só
  as colunas que o agente precisa pra ajudar o comprador: `id`, `name`, `brand`, `size`, `priceCents`,
  `categoria`, `descricao`, `quantity`.

## Tarefas (nesta ordem)

### 1. Criar `back/src/lib/chat-tools.ts`

```ts
import { and, eq, like, or } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/d1'
import { products } from '../schema/products'

const SEARCH_COLUMNS = {
  id: products.id,
  name: products.name,
  brand: products.brand,
  size: products.size,
  priceCents: products.priceCents,
  categoria: products.categoria,
  descricao: products.descricao,
  quantity: products.quantity,
}

export async function searchProducts(db: ReturnType<typeof drizzle>, query: string) {
  const term = `%${query}%`
  return db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(
      and(
        eq(products.active, true),
        or(like(products.name, term), like(products.brand, term), like(products.categoria, term)),
      ),
    )
    .all()
}

export async function getProduct(db: ReturnType<typeof drizzle>, productId: string) {
  const rows = await db
    .select(SEARCH_COLUMNS)
    .from(products)
    .where(and(eq(products.id, productId), eq(products.active, true)))
    .all()
  return rows[0] ?? null
}
```

Comentários no arquivo: **não adicione nenhum** além do que já está acima — o código já é
autoexplicativo.

### 2. Criar `back/test/chat-tools.test.ts`

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { searchProducts, getProduct } from '../src/lib/chat-tools'
import { products } from '../src/schema/products'

describe('searchProducts / getProduct (tools do chat-agent)', () => {
  let despublicadoId: string

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

    const db = drizzle(env.DB)
    despublicadoId = `test-chat-tools-${Date.now()}`
    await db.insert(products).values({
      id: despublicadoId,
      supplierId: 'uid-fornecedor-teste',
      supplierEmail: 'fornecedor@example.com',
      name: 'Fralda Despublicada Teste',
      brand: 'MarcaTeste',
      size: 'M',
      quantity: 10,
      slug: 'fralda-despublicada-teste',
      categoria: 'fraldas-descartaveis',
      descricao: 'Produto de teste, nao deve aparecer nas buscas do chat',
      atributos: { faixaPeso: '5-9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'teste' },
      priceCents: 5000,
      active: false,
    })
  })

  it('searchProducts: termo que bate no nome de um produto real retorna esse produto', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Supersec Pants')

    expect(results.length).toBeGreaterThan(0)
    expect(results.some((p) => p.id === 'p1')).toBe(true)
    expect(results.every((p) => 'name' in p && 'brand' in p && 'priceCents' in p)).toBe(true)
  })

  it('searchProducts: termo que bate na marca retorna produtos dessa marca', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Huggies')

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((p) => p.brand === 'Huggies')).toBe(true)
  })

  it('searchProducts: termo que nao bate em nada retorna array vazio', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'produto-que-nao-existe-xyz123')

    expect(results).toEqual([])
  })

  it('searchProducts: nunca retorna produto despublicado (active=false)', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Fralda Despublicada Teste')

    expect(results).toEqual([])
  })

  it('searchProducts: resultado nao vaza supplierEmail nem supplierId', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Pampers')

    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item).not.toHaveProperty('supplierEmail')
      expect(item).not.toHaveProperty('supplierId')
    }
  })

  it('getProduct: id real retorna o produto com priceCents presente', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, 'p1')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('p1')
    expect(result?.name).toBe('Supersec Pants')
    expect(typeof result?.priceCents).toBe('number')
  })

  it('getProduct: id inexistente retorna null', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, 'produto-fantasma-xyz123')

    expect(result).toBeNull()
  })

  it('getProduct: id de produto despublicado retorna null (nao acessivel pelo chat)', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, despublicadoId)

    expect(result).toBeNull()
  })
})
```

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. Se `node_modules` não estiver instalado (verifique com `ls node_modules/.bin/vitest` a partir da raiz
   do worktree), rode `npm install` na raiz e AGUARDE terminar antes de prosseguir — isso já causou
   demora em tarefas anteriores desta thread (M1) quando não foi verificado antes.
2. `npm test` — todos os testes verdes, incluindo os 8 casos novos de `chat-tools.test.ts`
   (`orders.*`, `products.*`, `cors.*`, `notifications.*`, `chat-completion.*` continuam passando sem
   nenhuma mudança — esta tarefa não toca nesses arquivos).
3. `npx tsc --noEmit` — sem erro de tipo.
4. `npm run lint` — se o script não existir em `back/package.json`, isso é um achado factual
   pré-existente do projeto (já confirmado nas tarefas M1/M2 desta mesma thread), não um erro desta
   tarefa; não crie um script de lint, só registre no relatório.

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade na 3ª tentativa,
PARE e relate o obstáculo exato — não invente workaround.

## Critérios de aceite

- [ ] `back/src/lib/chat-tools.ts` criado, exatamente como especificado no passo 1 (sem comentários
      supérfluos).
- [ ] `back/test/chat-tools.test.ts` com os 8 casos do passo 2, todos verdes.
- [ ] `searchProducts`/`getProduct` NUNCA retornam produto com `active: false`.
- [ ] `searchProducts`/`getProduct` NUNCA incluem `supplierEmail` nem `supplierId` no resultado.
- [ ] `npm test` completo do `back/` verde (novos + existentes); `tsc --noEmit` exit 0.
- [ ] Nenhum arquivo fora de `back/` modificado (não tocar em `front/`, `packages/contracts/`).
- [ ] `back/src/routes/products.ts`, `back/src/routes/orders.ts`, `back/src/index.ts` **não foram
      tocados** nesta tarefa (a rota que vai usar essas funções é a M4, futura).
- [ ] `back/src/lib/chat-completion.ts` (da M2) **não foi tocado**.

## Restrições

- **Não** crie a rota `/chat/message` nem monte nada em `back/src/index.ts` — isso é M4.
- **Não** exponha `supplierEmail`/`supplierId` no resultado das funções.
- **Não** retorne produto despublicado (`active: false`) em nenhuma das duas funções.
- **Não** invente dados de produto — use os ids/nomes/marcas reais conferidos em
  `front/src/lib/products.ts`.
- **Não** use `any`.
- **Não** modifique `front/` nem `packages/contracts/`.
- Commit em português, Conventional Commits, mensagem:
  `feat(back): tools search_products/get_product para o chat-agent (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal de `npm test` e `tsc --noEmit`.
- Confirmação (ou não) da existência de `npm run lint` em `back/` (achado factual, não bloqueante).
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio ou decisão de detalhe tomada.
