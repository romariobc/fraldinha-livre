# P2 — back/: POST /orders revalida preço/existência/fornecedor contra products

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-22) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-produtos-cloudflare.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/P-backend-produtos-breakdown.md` (tarefa P2, dep: P1 — APROVADA,
commits `6a0c9f4`+`ed1e9bb`+`7d08f46`, tabela `products` existe e está populada com os 24 produtos reais).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Rode agora, antes de tocar em qualquer arquivo:
```
git rev-parse --show-toplevel
```
O resultado **tem que ser** `E:/Labdev/Projetos/fraldinha-livre/.claude/worktrees/blissful-lamport-ccb562`
(ou o caminho equivalente com barras invertidas no Windows). **Se vier
`E:/Labdev/Projetos/fraldinha-livre` sem `.claude/worktrees/...` no caminho, PARE imediatamente** — você
está no repo principal, não no worktree. Não crie, não edite, não commite nada até confirmar que está
no lugar certo. (Na tarefa anterior desta mesma thread, P1, um executor commitou no repo principal por
engano, avançando a branch `main` local sem nenhuma revisão — só foi corrigido depois, com
`reset`+`cherry-pick`. Não repita isso.)

## Objetivo

`POST /orders` deixa de confiar cegamente em `items[].unitPrice`, `price` (total) e `supplierId` do
corpo da requisição — passa a revalidar tudo contra a tabela `products` (criada na P1) antes de gravar
qualquer coisa. Fecha de vez a dívida DEC-A da fatia 1 (Pedidos).

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`.
- `back/src/schema/products.ts` (P1) já existe: `products` com `id`, `priceCents`, `supplierId`.
- `back/src/routes/orders.ts` já existe (`ordersGetHandler`, `ordersPostHandler`,
  `ordersCancelHandler`) — você vai **modificar só `ordersPostHandler`**, os outros dois handlers não
  mudam.
- D-026/D-027 decididos — não redecidir arquitetura. RN-03 (id/uid/createdAt/status sempre do
  servidor) já está implementada — não mexer nisso, só adicionar a validação de produto ANTES dela.

### Mensagens de erro exatas (para os testes baterem — não parafrasear)
| Situação | Mensagem (`{ error: string }`) |
|---|---|
| Produto do `productId` não existe | `produto nao encontrado: <productId>` |
| `item.unitPrice !== product.priceCents` | `preco divergente para produto: <productId>` |
| `product.supplierId !== body.supplierId` | `fornecedor divergente para produto: <productId>` |
| `body.price` ausente | `price ausente` |
| `body.price !== soma dos itens` | `total divergente` |
| `body.supplierId` ausente | `supplierId ausente` |

## Tarefas (nesta ordem)

### 1. Modificar `back/src/routes/orders.ts` — `ordersPostHandler`
Logo após `const createRequest = CreateOrderRequestSchema.parse(body)` e **antes** de montar
`orderInsert`/`itemInserts`/chamar `db.batch()`, adicionar, nesta ordem exata:

```ts
// RN-P2b: price (total) e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
if (createRequest.price === undefined) {
  return c.json({ error: 'price ausente' }, 400)
}

// RN-P2c: supplierId e obrigatorio nesta rota, mesmo sendo .optional() no schema compartilhado.
if (createRequest.supplierId === undefined) {
  return c.json({ error: 'supplierId ausente' }, 400)
}

// Busca em lote (nao 1 query por item) - RN-P2/P2c.
const productIds = createRequest.items.map((item) => item.productId)
const productRows = await db.select().from(products).where(inArray(products.id, productIds)).all()
const productById = new Map(productRows.map((p) => [p.id, p]))

// Falha rapido no primeiro item invalido (RN-P3), antes de qualquer escrita (RN-P4).
for (const item of createRequest.items) {
  const product = productById.get(item.productId)
  if (!product) {
    return c.json({ error: `produto nao encontrado: ${item.productId}` }, 400)
  }
  if (item.unitPrice !== product.priceCents) {
    return c.json({ error: `preco divergente para produto: ${item.productId}` }, 400)
  }
  if (product.supplierId !== createRequest.supplierId) {
    return c.json({ error: `fornecedor divergente para produto: ${item.productId}` }, 400)
  }
}

// RN-P2b: total tem que bater com a soma dos itens.
const computedTotal = createRequest.items.reduce(
  (sum, item) => sum + item.unitPrice * item.quantity,
  0,
)
if (createRequest.price !== computedTotal) {
  return c.json({ error: 'total divergente' }, 400)
}
```
Precisa importar no topo do arquivo: `import { products } from '../schema/products'` e
`import { inArray } from 'drizzle-orm'` (o arquivo já importa `eq`/`sql` de `drizzle-orm` — adicionar
`inArray` ao mesmo import, não criar um import duplicado).

### 2. Modificar `back/test/orders.mutations.test.ts` — atualizar fixtures do handler
Os testes que chamam `POST /orders` de verdade (via `app.fetch`/`testApp.request`, não os que fazem
`INSERT` direto no D1) hoje usam produto fictício (`productId: 'prod-1'`, `unitPrice: 1000` ou
parecido). **Trocar por um produto real do seed**, por exemplo:
```ts
{
  productId: 'p1',
  productName: 'Fralda P',   // nome livre, nao e validado nesta fatia
  unitPrice: 1800,           // tem que bater com o priceCents real de 'p1' (P1: 1800)
  quantity: 1,
  unit: 'cx',
}
```
E o corpo da requisição precisa incluir `supplierId: 'sup-001'` (o fornecedor real de `p1`) e
`price` igual à soma dos itens (`unitPrice * quantity` somado por todos os itens do pedido).

**NÃO mexer** nos `INSERT` diretos no D1 usados como seed de outros fluxos (ex.: o `INSERT INTO
order_items ... 'prod-test' ...` da suíte de `PATCH /orders/:id/cancel`) — esses não passam pelo
handler novo, são fixture de outro teste, fora do alcance desta tarefa.

### 3. Criar os 5 casos novos em `orders.mutations.test.ts`
- `POST /orders` com `unitPrice` de item errado (produto real `p1`, preço trocado pra algo diferente
  de 1800) → 400, body `{ error: 'preco divergente para produto: p1' }`.
- `POST /orders` com `productId` inexistente (ex.: `'produto-fantasma'`) → 400, body
  `{ error: 'produto nao encontrado: produto-fantasma' }`.
- `POST /orders` com `supplierId` do body diferente do real (`p1` é `sup-001`, mandar `sup-999`) → 400,
  body `{ error: 'fornecedor divergente para produto: p1' }`.
- `POST /orders` sem `price` no body → 400, body `{ error: 'price ausente' }`.
- `POST /orders` sem `supplierId` no body → 400, body `{ error: 'supplierId ausente' }`.
- `POST /orders` com `price` que não bate com a soma dos itens (produto/fornecedor corretos, só o
  total errado) → 400, body `{ error: 'total divergente' }`.

O caso de sucesso (produto real, tudo certo → 201) já é coberto pelo fixture atualizado do passo 2 —
não precisa duplicar, mas confirme que pelo menos um teste existente cobre esse caminho feliz.

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. `npm test` — suíte inteira verde: os 24 já existentes (de P1) + os casos novos/ajustados desta
   tarefa. **Confirme especificamente que `d1-batch-atomicity.test.ts` continua passando sem
   nenhuma mudança** — ele testa `db.batch()` direto, não passa pelo handler, não deveria ser afetado.
2. `npx tsc --noEmit` — sem erro de tipo.

**Loop:** máximo 3 tentativas por problema específico. Se travar, PARE e relate — não implemente uma
versão que aceite dado inválido só para o teste passar (lição da B7/B2: nunca mascarar falha real).

## Critérios de aceite

- [ ] `ordersPostHandler` valida, nesta ordem: `price` ausente, `supplierId` ausente, busca em lote
      (`WHERE id IN`), produto inexistente, preço de item divergente, fornecedor divergente, total
      divergente — tudo **antes** de `db.batch()`.
- [ ] As 6 mensagens de erro batem exatamente com a tabela acima.
- [ ] Fixtures de `orders.mutations.test.ts` que passam pelo handler usam produto real (`p1`/1800/
      `sup-001` ou outro do seed, à sua escolha, desde que os valores batam com o seed real).
- [ ] Os 6 casos novos de teste, verdes.
- [ ] `INSERT`s diretos de outros testes (cancelamento) **intocados**.
- [ ] `npm test` completo verde, `tsc` exit 0.
- [ ] `d1-batch-atomicity.test.ts` passa sem modificação.
- [ ] Nenhum arquivo fora de `back/test/orders.mutations.test.ts` e `back/src/routes/orders.ts`
      modificado.

## Restrições

- **Não** redecida arquitetura.
- **Não** toque em `ordersGetHandler` nem `ordersCancelHandler`.
- **Não** use `any`.
- **Não** esconda falha em try/catch silencioso.
- **Não** adicione dependências novas (zod, lint fantasma, etc. — lição da P1: só adicione o que a
  tarefa realmente precisa, e nada disso é necessário aqui).
- Commit em português, Conventional Commits, mensagem:
  `feat(back): POST /orders revalida preco/existencia/fornecedor contra products (thread P)`

## Relatório esperado

- Confirmação do passo 0 (colar a saída de `git rev-parse --show-toplevel`).
- Lista de arquivos modificados (devem ser só os 2 do critério de aceite).
- Saída literal de `npm test` e `tsc --noEmit`.
- Confirmação explícita de que `d1-batch-atomicity.test.ts` passou sem mudança.
- Hash do commit (`git log -1 --oneline`).
- Qualquer bloqueio ou decisão de detalhe tomada.
