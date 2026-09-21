# B4 — back/: POST /orders + PATCH /orders/:id/cancel

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-pedidos-cloudflare.md` (RN-01, RN-03, RN-04, RN-05, RN-06)
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B4, dep: B3 — APROVADO,
commits `2af35f6`+`20c62dc`, middleware de auth + `GET /orders` já existem).

## Objetivo

Implementar `POST /orders` (criar pedido) e `PATCH /orders/:id/cancel` (cancelar, com trava logística)
no Worker. O servidor é autoritativo sobre `id`/`uid`/`createdAt`/`status` — o cliente nunca escolhe
esses valores.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`.
- `back/src/routes/orders.ts` já tem `ordersGetHandler` (`GET /orders`) — adicione os 2 handlers novos
  nesse mesmo arquivo, não crie um arquivo separado.
- `back/src/middleware/auth.ts` já existe — as rotas novas usam o mesmo middleware (`c.get('uid')`).
- `packages/contracts/src/order.ts` (import relativo `../../../packages/contracts/src/order`, mesmo
  padrão da B3) já tem `CreateOrderRequestSchema` e `OrderSchema` — use-os, não redefina campos.
- `back/src/schema/orders.ts` (Drizzle) já tem as tabelas `orders`/`order_items`.
- D-025 (trava logística): cancelar só é permitido com `status === 'aguardando'`.

### Lições das tarefas anteriores — aplicar aqui também
- Verificar a API real da versão instalada de `drizzle-orm` antes de escrever código de transação
  (ler `node_modules/drizzle-orm/` se necessário) — não assumir de memória.
- Nunca esconder falha em `try/catch` silencioso.
- Não duplicar dado à mão quando existe uma fonte única de verdade (aqui: os schemas de `@contracts` e
  Drizzle já existentes).

## Ponto crítico desta tarefa — atomicidade real (RN-03)

RN-03 exige que a order e seus items sejam gravados **numa única transação** — se a gravação dos items
falhar, a order não pode ficar "órfã" (persistida sem nenhum item). Isso **precisa ser code E testado**,
não só assumido. D1 oferece atomicidade via `D1Database.batch()` (todas as statements de um batch
executam como uma unidade — se uma falhar, TODAS são revertidas), e o Drizzle expõe isso via
`db.batch([...])` recebendo um array de queries não-executadas (ex.: `db.insert(orders).values(...)`).

**Antes de implementar:** confirme lendo o `.d.ts`/README do `drizzle-orm` instalado (driver D1,
`drizzle-orm/d1`) se `db.batch()` está disponível e qual a assinatura exata. Use `db.batch()` (não
`db.transaction()` — historicamente o driver D1 do Drizzle não suporta `.transaction()` da forma
tradicional; **confirme isso você mesmo lendo os tipos**, não repita esta frase de cor).

**Prova obrigatória de atomicidade (teste dedicado, separado do teste do endpoint):** escreva um teste
que NÃO passa pelo endpoint HTTP — chama `db.batch([...])` diretamente com duas queries que
inevitavelmente conflitam (ex.: dois `db.insert(orders).values(...)` com o **mesmo `id`**, violando a
PRIMARY KEY na segunda statement) e comprova que:
1. A chamada rejeita/lança erro.
2. Depois do erro, **nenhuma das duas linhas foi persistida** (`SELECT * FROM orders WHERE id = ...`
   não retorna nada) — prova que a primeira statement do batch também foi revertida, não só a segunda.

Esse teste prova que a primitiva de atomicidade do D1/Drizzle realmente funciona como uma transação.
Só depois disso, implemente `POST /orders` usando `db.batch()` para gravar a order + todos os items numa
única chamada.

## Tarefas (nesta ordem)

### 1. Teste de atomicidade (ver seção acima) — `back/test/d1-batch-atomicity.test.ts`

### 2. `POST /orders` em `back/src/routes/orders.ts`
- Handler protegido pelo mesmo middleware de auth de `/orders/*` (já montado em `index.ts` — só
  adicionar a rota).
- Lê o body, valida com `CreateOrderRequestSchema.parse()` (de `@contracts`) — se inválido, Zod lança;
  capture e responda **400** com uma mensagem de erro (não deixe o erro do Zod vazar cru pro cliente,
  mas também não esconda — logue/inclua o motivo da validação falhar na resposta).
- Servidor define (RN-03): `id = crypto.randomUUID()`, `uid = c.get('uid')` (do token, nunca do body —
  mesmo que o body malicioso tente mandar `uid`, o Zod `CreateOrderRequestSchema` não tem esse campo,
  então já é ignorado no parse, mas confirme isso no teste), `type = 'compra-direta'`,
  `status = 'aguardando'`, `createdAt = new Date().toISOString()`.
- Monta a linha de `orders` (lembrando: `deliveryAddress` vira `JSON.stringify` na coluna
  `delivery_address`; `price`/`supplierId`/`supplierName` ausentes viram `null`, não `undefined`, pro D1) e
  as linhas de `order_items` (um insert por item de `body.items`).
- Grava tudo com **um único `db.batch([...])`** (order + todos os items).
- Responde **201** com o objeto completo, validado por `OrderSchema.parse()` antes de responder (mesmo
  padrão do `GET /orders`).

### 3. `PATCH /orders/:id/cancel` em `back/src/routes/orders.ts`
- Handler protegido pelo mesmo middleware.
- Busca a order por `id` (do path param). Não existe → **404**.
- Existe mas `order.uid !== c.get('uid')` → **403** (RN-04 — não é dono).
- Existe, é do dono, mas `order.status !== 'aguardando'` → **409** (trava logística, D-025).
- Senão: `UPDATE orders SET status = 'cancelado' WHERE id = ...`, responde **200** com a order
  atualizada (validada por `OrderSchema.parse()`).

### 4. Modificar `back/src/index.ts`
Montar as 2 rotas novas (mesmo grupo `/orders/*` já protegido pelo middleware).

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. `npm test` — TODOS os testes verdes: os 8 já existentes (health + orders.get) + o novo
   `d1-batch-atomicity.test.ts` + os novos de `POST`/`PATCH` (ver critérios abaixo).
2. `npx tsc --noEmit` — sem erro de tipo.

**Casos obrigatórios em `back/test/orders.mutations.test.ts` (arquivo novo):**
- `POST /orders` sem token → 401.
- `POST /orders` com body inválido (ex.: `items: []`) → 400.
- `POST /orders` com body válido que inclui `id`/`uid`/`status` "maliciosos" no JSON bruto (fora do
  schema — teste que o servidor ignora esses campos e usa os seus próprios) → 201, e o `uid` da order
  criada é o do TOKEN, não o do body.
- `POST /orders` bem-sucedido: ler de volta via `SELECT` direto em `order_items` (não só confiar na
  resposta HTTP) e confirmar que os items foram persistidos.
- `PATCH /orders/:id/cancel` de uma order de OUTRO uid → 403.
- `PATCH /orders/:id/cancel` de uma order com `status = 'confirmado'` (seed manual) → 409.
- `PATCH /orders/:id/cancel` de uma order `aguardando` do dono → 200, `status` vira `cancelado`.
- `PATCH /orders/:id/cancel` de um id inexistente → 404.

**Loop:** máximo 3 tentativas para problemas de código. Se `db.batch()` não se comportar como esperado
(não for atômico, ou a API divergir), isso é motivo de PARAR e relatar — não implemente uma versão não-
atômica "só pra passar no teste".

## Critérios de aceite

- [ ] Teste dedicado prova que `db.batch()` do D1/Drizzle é atômico (reverte statement anterior num
      batch que falha no meio).
- [ ] `POST /orders`: valida body (400 se inválido), servidor define id/uid/createdAt/status/type,
      grava order+items num único `db.batch()`, responde 201 com `OrderSchema.parse()`.
- [ ] `PATCH /orders/:id/cancel`: 404/403/409/200 conforme especificado, `OrderSchema.parse()` na
      resposta de sucesso.
- [ ] Todos os 8 casos de teste listados acima, verdes.
- [ ] Suíte completa (`npm test`) verde — incluindo os 8 testes já existentes de B2/B3.
- [ ] `tsc --noEmit` exit 0.
- [ ] Nenhum SQL/dado duplicado à mão fora do padrão Drizzle já estabelecido.
- [ ] Nenhum arquivo fora de `back/` modificado.

## Restrições

- **Não** aceite `id`/`uid`/`status`/`createdAt` vindos do body — sempre do servidor/token.
- **Não** use `db.transaction()` sem antes confirmar que o driver D1 do Drizzle instalado suporta (é
  esperado que NÃO suporte — use `db.batch()`).
- **Não** implemente qualquer outra rota (produtos, perfis, estoque) — fora de escopo desta fatia.
- **Não** use `any`.
- **Não** esconda falhas em `try/catch` silencioso.
- Commit em português, Conventional Commits, mensagem:
  `feat(back): POST /orders + PATCH cancelar com trava logistica no servidor (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Confirmação explícita: `db.batch()` é a primitiva usada, e o teste de atomicidade dedicado passou
  (colar o nome do `it(...)` e o resultado).
- Saída literal de `npm test` (suíte completa) e `npx tsc --noEmit`.
- Lista dos `it(...)` de `orders.mutations.test.ts`, confirmando que cobrem os 8 casos pedidos.
- Hash do commit (`git log -1 --oneline`).
- Qualquer bloqueio, ajuste de API ou decisão de detalhe tomada.
