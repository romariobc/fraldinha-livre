# C5 — back/: `GET /orders?scope=fornecedor`

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C5 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C3, commits `70b9ee0` +
`627a86a`, APROVADOS 2026-07-26 via D-012, já no histórico deste worktree/branch).

## Objetivo

Dar ao fornecedor autenticado uma forma de ver os pedidos que envolvem os seus produtos —
`GET /orders?scope=fornecedor` retorna só os pedidos cujos itens referenciam produtos do
`supplierId` = uid do token. **Sem** o parâmetro, `GET /orders` continua exatamente como está hoje
(comportamento de comprador — pedidos do próprio uid) — regressão explícita a testar, não assumir.

## Contexto mínimo

- `back/src/routes/orders.ts`: `ordersGetHandler` hoje sempre filtra por `eq(orders.uid, uid)` (lado
  comprador). `back/src/index.ts` já aplica `createAuthMiddleware`/`verifyFirebaseIdToken` em TODO
  `/orders/*` via `app.use('/orders/*', ...)` — **não precisa de middleware novo nem condicional**
  aqui (diferente de C3/C4 em `/products`), já que `/orders` sempre exigiu auth pros dois lados
  (comprador e fornecedor).
- Imports já existentes em `orders.ts` que esta tarefa reaproveita sem duplicar: `eq`, `inArray` de
  `drizzle-orm`; `products` de `../schema/products` (já importado pra validação de `POST /orders`,
  thread P).
- Schema `orderItems` (`back/src/schema/orders.ts`, não confundir com `products.ts`) tem
  `productId`/`orderId` — é o elo entre pedido e produto que esta tarefa usa pra filtrar por
  fornecedor.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que `70b9ee0`/`627a86a` (C3)
estão no histórico — se não, PARAR e relatar.

**Nota de coordenação:** a tarefa C4 (`POST`/`PUT`/`DELETE /products`) também depende de C3 e edita
`back/src/index.ts` (seção `/products`, diferente da seção `/orders` que C5 toca, mas é o mesmo
arquivo). Se C4 estiver rodando ao mesmo tempo neste mesmo worktree, **não prosseguir em paralelo**
— confirmar com a sessão-mãe qual roda primeiro.

## Tarefas (nesta ordem)

### 1. Modificar `back/src/routes/orders.ts` — estender `ordersGetHandler`
Substituir o início da função (a parte que busca `userOrders`) por:
```ts
export const ordersGetHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const db = drizzle(c.env.DB)
    const scope = c.req.query('scope')

    let userOrders
    if (scope === 'fornecedor') {
      // Busca order_items cujo product_id pertence a um produto do uid autenticado (fornecedor).
      const matchingItems = await db
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(products.supplierId, uid))
        .all()

      const orderIds = [...new Set(matchingItems.map((row) => row.orderId))]
      userOrders =
        orderIds.length > 0
          ? await db.select().from(orders).where(inArray(orders.id, orderIds)).all()
          : []
    } else {
      // Comportamento existente (comprador) — inalterado.
      userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.uid, uid))
        .all()
    }

    // A partir daqui, o resto da função (busca de items por order, mapeamento D1→contrato,
    // validacao contra OrderSchema) continua EXATAMENTE como esta hoje — nao reescrever,
    // so reusar `userOrders` calculado acima no lugar do `db.select()...where(eq(orders.uid, uid))`
    // que existia antes.
    // ... (manter o restante do corpo da função sem mudanca)
```
Manter todo o resto do corpo (o `Promise.all(userOrders.map(...))`, a validação `OrderSchema.parse`,
o `return c.json(...)`, o `catch`) **exatamente como está** — só a origem de `userOrders` muda.

### 2. `back/src/index.ts` — nenhuma mudança necessária
`/orders/*` já está sob o middleware de auth existente; `GET /orders` já está montada. Confirmar (não
modificar) que nada precisa mudar aqui — se parecer que precisa, PARAR e relatar em vez de mudar.

### 3. Criar `back/test/orders.scope-fornecedor.test.ts`
Seguir o padrão de fixture de `orders.get.test.ts` (inserção direta via `db.insert` de
orders/orderItems/products de teste, sem depender do seed de produção). Casos:
- Seed: 2 fornecedores de teste (`uid-fornecedor-a`, `uid-fornecedor-b`), cada um com 1 produto de
  teste; 1 pedido com item referenciando o produto do fornecedor A, outro pedido com item
  referenciando o produto do fornecedor B.
- `GET /orders?scope=fornecedor` com token do fornecedor A → retorna só o pedido que referencia o
  produto do fornecedor A, **não** o do fornecedor B (mesmo espírito do RN-02 já testado no lado
  comprador em `orders.get.test.ts`).
- `GET /orders?scope=fornecedor` com token do fornecedor B → retorna só o pedido dele.
- `GET /orders?scope=fornecedor` sem token → 401 (middleware existente já cobre, mas testar
  explicitamente).
- **Regressão explícita:** `GET /orders` (sem `scope`) continua retornando pedidos por `uid`
  comprador, comportamento idêntico ao já testado em `orders.get.test.ts` — rodar (ou referenciar) um
  caso equivalente aqui para provar que nada mudou nesse caminho.

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd back && npm test` — suíte inteira verde, incluindo `orders.scope-fornecedor.test.ts` novo.
   **`orders.get.test.ts` (comprador) e `d1-batch-atomicity` têm que passar sem nenhuma mudança de
   resultado** — regressão crítica desta tarefa.
2. `cd back && npx tsc --noEmit` — exit 0.
3. `cd back && npm run lint` — exit 0, ou "script inexistente" (mesmo gap de C2/C3).
4. Confirmar que **`front/`/`packages/contracts/` não foram tocados**.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não reescreva a parte do handler que já funciona (mapeamento de items,
validação). Relate o que falhou, o que tentou e o estado atual.

## Critérios de aceite

- [ ] `GET /orders?scope=fornecedor` retorna só pedidos cujos itens referenciam produtos do uid
      autenticado.
- [ ] Fornecedor A não vê pedidos do fornecedor B (teste explícito).
- [ ] `GET /orders` sem `scope` — comportamento de comprador **inalterado**, testado explicitamente.
- [ ] `GET /orders?scope=fornecedor` sem token → 401.
- [ ] `npm test`/`tsc` em `back/` exit 0. Lint exit 0 ou gap documentado.
- [ ] Nenhum arquivo em `front/`/`packages/contracts/` modificado. Nenhuma mudança em
      `back/src/index.ts` (a menos que algo genuinamente exija — nesse caso, PARAR e relatar em vez
      de mudar por conta própria).

## Restrições

- **Não** reescrever o mapeamento D1→contrato nem a validação `OrderSchema` já existentes — só a
  origem de `userOrders`.
- **Não** adicionar middleware novo em `index.ts` — `/orders/*` já exige auth.
- **Não** tocar em `front/`/`packages/contracts/`.
- **Não** usar `any`.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(back): GET /orders?scope=fornecedor filtra pedidos por produtos do fornecedor (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 4 comandos de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido, e qualquer bloqueio.
