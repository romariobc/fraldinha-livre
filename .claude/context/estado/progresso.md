# Progresso — fraldinha-livre

## Estado atual (2026-07-23) — Task 4: Perfil do Fornecedor documentado

**Perfil do Fornecedor (feature descrita na Task 4) IMPLEMENTADO e DOCUMENTADO.** Fatia do escopo 006 (backend) que captura dados do fornecedor (CNPJ/razão social/nome fantasia/endereço) em `users/{uid}` via Firestore, editáveis numa nova aba `PerfilTab.tsx` no painel do fornecedor. Commits: `cd5a67f` (isValidCNPJ + UserProfile), `dc2f696` (PerfilTab.tsx + testes), `8804685` (wired na dashboard). Suite 298/298 verde, `tsc`/`lint` limpos.

**Nota crítica de escopo (aprovada na spec original):** este dado de perfil **NÃO TEM CONSUMIDOR em nenhum outro lugar do app**. Não filtra `directOrders`/`offers` no painel do fornecedor (ambas seguem vindo de arrays mock estáticos), e não aparece no catálogo do comprador. A amarração `uid↔supplierId` fica **reservada para a feature 007** ("Catálogo do fornecedor") — desejo consciente, não um bug pendente. Sem essa nota explícita, futuras sessões podem interpretar como regressão.

Trabalho nesta tarefa: Steps 1, 2 e 4 da task-4-brief.md (documentação de estado + commit). Step 3 (validação navegador com login Google real) não foi executado — reservado para controller humano.

## Estado anterior (2026-07-23) — Thread P mergeada na main (PR #9)

**Merge da thread P para a main:** PR #9 (16 commits) revisado pelo Claude Code Review automático
(job `claude-review` verde, "No buffered inline comments" — limpo, sem achados) e mesclado
(`f9186e0`, merge commit via `gh pr merge --merge`). `main` local sincronizada (fast-forward
`13ad06b..f9186e0`). Toda a fatia 2 (Produtos, P1-P3) está integrada, somada à fatia 1 (Pedidos,
B1-B9) já mergeada anteriormente (PR #8, `13ad06b`).

Branch `Romir/folder-analysis-070a4b` e worktree `blissful-lamport-ccb562` mantidos vivos (mesmo
padrão adotado após a B9: a branch continuou recebendo a thread P em vez de ser apagada) — prontos
para a próxima fatia do backend.

**Próximo passo (não decidido ainda):** definir a próxima fatia do backend — sync do painel do
fornecedor, Perfis, ou Estoque (nenhuma iniciada; feature 007 no `feature_list.json` já cobre
catálogo+perfil+histórico do fornecedor como um bloco, mas o escopo pode ser fatiado).

## Estado anterior (2026-07-23) — P3 FECHADO — fatia 2 (Produtos) ponta a ponta em produção

**P3 completo, os 5 passos:**
1. Migrations remotas aplicadas (`npx -y wrangler@4.86.0 d1 migrations apply fraldinha-livre-db
   --remote`) — `0001_slow_sabretooth.sql` (schema) + `0002_seed_products.sql` (seed). Confirmado por
   query direta (`SELECT COUNT(*) FROM products`): **24 produtos reais no D1 remoto**.
2. Deploy do Worker (`npx -y wrangler@4.86.0 deploy`) — versão `15c80ecf-7144-4388-8f6d-45723a301dd0`
   no ar em `https://fraldinha-livre-backend.romariobc.workers.dev`.
3. Smoke test confirmado: `GET /products` → 200, 24 itens, shape `{id, priceCents, supplierId}`
   correto; `GET /orders` sem token → 401 (regressão — nada quebrou).
4. **Regressão de checkout no navegador confirmada pelo cliente:** login Google → catálogo →
   adicionar ao carrinho → finalizar compra → pedido aparece em `/minha-conta` — com a validação nova
   de preço/existência/fornecedor/total ativa em produção, o caminho feliz não quebrou.
5. Registro fechado: `feature_list.json` (006 — fatia 2/Produtos documentada como ponta a ponta em
   produção, junto com a nota de que a fatia 1 já foi mergeada na main); `integration-guide.md`
   (seção 4.5 reescrita — a limitação DEC-A antiga foi substituída pela descrição real da validação
   nova).

**Thread P (Produtos) FECHADA: P1, P2, P3 completos e em produção.** Servidor não confia mais em
preço/fornecedor enviados pelo cliente — a dívida DEC-A da fatia 1 está fechada de verdade, não só
"aceita conscientemente".

**Próximo passo (não decidido ainda):** (1) merge da branch `Romir/folder-analysis-070a4b` (agora com
B1-B9 + P1-P3) para a main — pendente, já tem a fatia 1 mergeada via PR #8, falta a fatia 2; (2)
definir a próxima fatia do backend (sync do painel do fornecedor, Perfis, ou Estoque — nenhuma
iniciada).

## Estado anterior (2026-07-22) — P2 APROVADO — thread P fechada do lado do código, falta só P3

**P2 APROVADO** pela sessão de frontend via D-012 (commit `256d22a`). Checklist completo rodado pela
revisora, incluindo o item extra pós-incidente (`git merge-base --is-ancestor` confirmando que o
commit é ancestral do HEAD — sem repetir o problema da P1) e a comparação do diff de
`d1-batch-atomicity.test.ts` contra o commit certo (B4, `6309a1e`) confirmando zero mudança.

**Thread P fechada do lado do código: P1 + P2 aprovados.** Tabela `products` real no D1 (24 produtos,
sensor de drift contra o front), `POST /orders` revalidando preço/existência/fornecedor/total antes de
gravar. Só falta **P3** (deploy real — migrations remotas, deploy do Worker, smoke test, regressão de
checkout no navegador, registro) para fechar a fatia 2 (Produtos) inteira. Pré-requisitos humanos: **nenhum
novo** — conta Cloudflare e D1 já existem desde a B9.

## Estado anterior (2026-07-22) — P1 aprovado (com fix); P2 executado — falta só P3 (deploy)

**P1 APROVADO** pela sessão de frontend via D-012, com 1 ressalva de conformidade: o critério "script
lê `front/src/lib/products.ts`" não foi cumprido ao pé da letra (entregue como cópia manual). Resolvido
trocando "guia" por "sensor": `products.seed-consistency.test.ts` importa o array real do front dentro
do ambiente de teste do Worker (`@cloudflare/vitest-pool-workers` resolve o import relativo sem
problema — testado) e compara com `GET /products` nas duas direções. Spec emendada (commit `7d08f46`).

**Lição de processo incorporada ao template:** "Passo 0" obrigatório adicionado a
`plans/README.md` — todo prompt Haiku agora exige `git rev-parse --show-toplevel` confirmado antes de
tocar em qualquer arquivo, motivado pelo incidente de commit no repo principal da P1.

**P2 EXECUTADO** (commit `256d22a`) — `ordersPostHandler` agora revalida `price`/`supplierId`
ausentes, busca produtos em lote (`WHERE id IN`), e checa produto/preço/fornecedor/total na ordem
certa, tudo antes do `db.batch()`. Passo 0 confirmado corretamente desta vez (sem repetir o incidente
da P1). 30/30 testes verdes (24 de P1 + 6 novos), `d1-batch-atomicity.test.ts` confirmado intacto,
`tsc` exit 0. Sanity check próprio: commit confirmado como ancestral do HEAD certo (não repetiu o
problema de diretório), imports limpos (sem duplicar), 3 `catch` (mesmos de antes, nenhum novo).

**Aguardando revisão D-012 pela sessão de frontend.** Depois disso, só falta **P3** (deploy real —
migrations remotas antes do deploy, smoke test, regressão de checkout no navegador) para fechar a
fatia 2 (Produtos) inteira.

## Estado anterior (2026-07-22) — Thread B mergeada na main; thread P (Produtos) iniciada, P1 executado

**Merge da thread B para a main:** PR #8 (38 commits, 81 arquivos) revisado pelo Claude Code Review
automático (limpo, sem comentários) e mesclado (`13ad06b`). `main` local sincronizada. Toda a fatia 1
(Pedidos, B1-B9) está integrada.

**Thread P (backend de Produtos, fatia 2 da 006) iniciada via brainstorming** — spec
(`spec-backend-produtos-cloudflare.md`) e plano (`P-backend-produtos-breakdown.md`) escritos, revisados
por outro agente em 2 rodadas (achados reais incorporados: RN-P2b obrigatória — o campo `price` total
do pedido não era revalidado, só os `unitPrice` por item; RN-P2c — `supplier_id`; ambiguidade de campo
`price`/`supplierId` ausente no schema opcional; falta do P3 de deploy com a ordem operacional exata
documentada). Plano: P1 (schema+seed+`GET /products`) → P2 (validação em `POST /orders`) → P3
(deploy, coordenador+cliente).

**P1 EXECUTADO com incidente sério, encontrado e corrigido pela sessão de backend:** o executor Haiku
completou o trabalho real corretamente (schema, migrations em duas partes via `drizzle-kit generate`,
seed com os 24 produtos conferidos contra `front/src/lib/products.ts`, `GET /products` público), mas
**commitou no repositório principal (`E:\Labdev\Projetos\fraldinha-livre`) em vez do worktree**
(`blissful-lamport-ccb562`) — o commit (`c58e377`) ficou pendurado na `main` local, um commit à frente
de `origin/main`, sem nenhuma revisão. Corrigido: `main` local resetada de volta pra `13ad06b`
(idêntica a `origin/main`, nada perdido — `origin` nunca recebeu o commit), o commit trazido via
`cherry-pick` pro branch/worktree certo (`ed1e9bb`... `6a0c9f4`).

Sanity check próprio achou mais 2 problemas no commit trazido: `zod` adicionado como devDependency
direta sem nenhum uso real (já disponível via dependência transitiva de
`@cloudflare/vitest-pool-workers`) e um script `"lint": "tsc --noEmit"` fake (`back/` nunca teve
ESLint — erro meu no prompt de P1, que copiou a convenção do front sem checar). Ambos removidos
(commit `ed1e9bb`). 22/22 testes verdes, `tsc` exit 0.

**Aguardando revisão D-012 pela sessão de frontend** antes de avançar para P2.

## Estado anterior (2026-07-21) — B9 FECHADO — backend real de Pedidos em producao, validado por humano

**A fatia 1 da thread B (Pedidos) está ponta a ponta em produção.** Sequência executada nesta sessão
(coordenador + cliente, conforme o plano previa — não delegado a executor autônomo):

1. **Migration aplicada no D1 remoto** (`fraldinha-livre-db`) via conector MCP `cloudflare-bindings`
   (autenticação do conector, sem depender do Wrangler CLI para este passo): tabelas `orders`,
   `order_items`, índice `idx_orders_uid` confirmados por consulta ao `sqlite_master`.
2. **Cliente autenticou o Wrangler** (`wrangler login`, OAuth local) — único passo que exigia ação do
   cliente. Descoberta: `wrangler` ≥4.87 exige Node ≥22 (sistema tem 20.20.2, D-021); resolvido fixando
   `npx -y wrangler@4.86.0` (última versão compatível com Node 20) em vez de instalar Node 22.
3. **Deploy do Worker**: `https://fraldinha-livre-backend.romariobc.workers.dev`. Smoke test inicial
   verde (`/health` 200, `/orders` sem token 401).
4. **`.env.local` do worktree** (`blissful-lamport-ccb562/front`, gitignored) com chaves Firebase
   (copiadas do repo principal) + `NEXT_PUBLIC_BACKEND_URL` + `NEXT_PUBLIC_USE_BACKEND=true`.
5. **`npm run dev` no navegador (preview) revelou 2 bugs que teste/build não pegavam** — ambos
   corrigidos, testados e commitados na branch `Romir/folder-analysis-070a4b`:
   - **CORS ausente no Worker** — `Authorization` no header força preflight `OPTIONS`, que caía em 404
     sem `hono/cors` configurado (nenhum teste de integração exercita isso; só aparece com navegador
     real). Fix: CORS restrito a `localhost` (regex, qualquer porta) + 3 testes (preflight, resposta
     real, origem desconhecida não refletida). Commit `a2b1212`. Redeployado, preflight confirmado em
     produção via curl.
   - **`OrdersProvider` chamava `list()` no mount antes do Firebase restaurar a sessão** — sem usuário
     ainda resolvido, sem token, `401` garantido mesmo para quem estava logado (apareceria após F5).
     Fix: o load em modo backend passa a ser disparado por `onAuthStateChanged` (com usuário → busca;
     sem usuário → lista vazia sem erro). Junto: `turbopack.root` no `next.config.ts` — o Turbopack do
     `next dev` limitava a resolução de módulos à raiz detectada pelo lockfile (`front/`), e `@contracts`
     mora em `../packages/contracts`, fora dela (`Module not found`, só em dev, não no build). Commit
     `95879f9`, 3 testes novos (gating por auth). Suite front 288/288, back 20/20, lint/tsc limpos.
6. **Validação humana no navegador — os 4 critérios da spec confirmados pelo cliente:**
   login Google → checkout → pedido real aparece em `/minha-conta` → **refresh mantém o pedido** (prova
   que vem do D1, não mais de `useState`) → cancelamento respeita a trava `aguardando` (bloqueado em
   `confirmado`/`a-caminho`, `409` do servidor, não só UI) → **2 contas Google diferentes não veem
   pedido uma da outra** (RN-02 provada em produção, não só em teste unitário).
7. **Registro fechado**: `feature_list.json` — 006 avança (fatia 1 done, resto do escopo original
   ainda todo); 016 e 017 viram `done` (a única pendência de ambas era exatamente essa validação
   humana com login Google). `integration-guide.md` totalmente reescrito — a versão antiga descrevia
   NextAuth/credentials provider, que nunca existiu neste projeto (auth sempre foi Firebase, D-010); a
   nova documenta o padrão real (porta+adapter, Firebase ID Token → Worker Hono → Drizzle → D1, gotchas
   de CORS/Turbopack/Node encontrados nesta sessão).

**Nota de escopo:** a ponte do pedido para o painel do fornecedor (sup-001, via `order-adapters.ts`) não
foi re-exercitada nesta sessão — o código não foi tocado pelas mudanças de B9 e já tinha validação
Playwright anterior, mas fica registrado como não re-confirmado com o backend real ligado.

**Trabalho não mergeado:** toda a thread B (B1-B9) vive na branch `Romir/folder-analysis-070a4b`
(worktree `blissful-lamport-ccb562`) — ainda não foi para a `main`. Próximo passo natural: decidir o
merge para a main, e/ou definir a próxima fatia do backend (Produtos, sync do painel do fornecedor,
Perfis ou Estoque — nenhuma iniciada).

---

## Estado anterior (2026-07-20) — B8 APROVADO — fatia 1 da thread B (backend de pedidos) FECHADA (B1-B8)

**B8 APROVADO** pela sessão de frontend via D-012 (commit `3299c98`). Sanity check próprio completo:
`git show --stat` (7 arquivos batem exatamente), `npm test` 285/285, `tsc`/`lint` exit 0. Pontos de
maior risco conferidos linha a linha:
- `createDirectOrder` (código morto) — diff confirma que só `setOrders([...orders,x])` virou
  `setOrders(prev => [...prev,x])`, resto do corpo idêntico.
- Exatamente 3 `catch` nos arquivos de produção tocados (`orders-context.tsx`, `checkout/page.tsx`,
  `OrderCard.tsx`), todos legítimos (`setError`/`toast.error` + `console.error`, nenhum silencioso).
- `contractOrderToAccountMockOrder` mapeia os 12 campos de `Order`; o único campo fora do mapeamento
  (`offers`) é exclusivo do fluxo `cotacao`, fora do escopo de `ContractOrder` (só `compra-direta`).
- **Achado do executor confirmado por diff**: o `cancelOrder` ANTIGO (`setOrders(prev => prev.map(o =>
  o.id === orderId ? {...o, status:'cancelado'} : o))`) nunca validava status — sempre sucedia,
  independente do estado do pedido. A reescrita dos testes (criar um pedido `aguardando` antes de
  cancelar, em vez de usar `orders[0]` do seed) é correção legítima, não fuga de caso difícil: o novo
  `cancelOrder` passa por `repo.cancel()`, que agora aplica a trava D-025 de verdade.
- Item 10 do checklist (clique real no navegador) **não realizado nesta sessão** — sem `.env.local`
  neste worktree efêmero (mesmo gotcha de Firebase já documentado), qualquer página autenticada falha
  por `auth/invalid-api-key`, não por defeito do B8. Fica registrado como pendência para quando alguém
  rodar localmente fora do worktree.

**Fatia 1 da thread B (006.1..006.4, "só Pedidos") está FECHADA — B1 a B8 todos aprovados via D-012:**
B1 (`packages/contracts`) · B2 (scaffold Worker+D1, corrigido, D1 real criado) · B3 (auth Firebase +
`GET /orders`) · B4 (`POST /orders` + `PATCH .../cancel`, atomicidade provada) · B5 (`OrderRepository`
porta+mock) · B6 (contract test reutilizável) · B7 (`HttpOrderRepository`, achado sério do zod v3/v4
corrigido pela raiz) · B8 (`OrdersProvider` assíncrono).

**Falta só B9** (deploy real do Worker + migration aplicada no D1 remoto + validação humana no
navegador) para fechar a feature 006 fatia 1 ponta a ponta. Pré-requisitos já resolvidos: D1 real
criado via MCP (`fraldinha-livre-db`), conta Cloudflare autenticada. Pré-requisito ainda pendente:
decisão sobre Node 22 (wrangler CLI exige, sistema tem 20.20.2 — decisão de subir foi adiada até este
ponto, ver estados anteriores). Migration ainda NÃO aplicada no D1 remoto; deploy do Worker ainda NÃO
feito.

## Estado anterior (2026-07-20) — B7 aprovado; B8 executado (OrdersProvider assíncrono) — fatia 1 completa

**B7 APROVADO** pela sessão de frontend via D-012, com verificação linha a linha do fix do zod
(confirmou causa raiz via `npm ls zod`: v4 transitiva de `eslint-config-next`/`shadcn` convivendo com
v3 hoisted).

**B8 EXECUTADO** (commit `3299c98`) — tarefa de maior risco da fatia 1, tocando o fluxo real de
checkout/cancelamento já validado no navegador. Levantamento próprio feito antes do prompt (3 arquivos
de produção afetados fora do context, 3 arquivos de teste, achado de que os `try/finally` de
`handlePagar`/`handleConfirmCancel` não tinham `catch`). `orders-context.tsx` reescrito: `orders`
carrega via `OrderRepository.list()` (mock por padrão, `HttpOrderRepository` se
`NEXT_PUBLIC_USE_BACKEND=true`), `loading`/`error` adicionados, `createOrdersFromCart`/`cancelOrder`
assíncronos (DEC-B), ponte `contractOrderToAccountMockOrder` (inversa da B5) mantém os componentes de
UI existentes intactos. `checkout/page.tsx` e `OrderCard.tsx` ganharam `catch` com `toast.error`.
`minha-conta/page.tsx` ganhou loading/erro da aba Pedidos. `createDirectOrder` (código morto)
intocado, confirmado por diff.

Achado no teste que valeu a pena registrar: os 2 testes de `cancelOrder` cancelavam `orders[0]` do
seed (`ord-003`, status `confirmado`) — só funcionavam porque o `cancelOrder` ANTIGO nunca validava
status (bug latente, sem trava lógica no front, ao contrário do backend). Corrigido criando um pedido
`aguardando` antes de cancelar — mais fiel ao comportamento real (D-025) do que o teste anterior.
285/285 testes verdes, `tsc`/`lint` exit 0. Sanity check próprio: todos os 3 `catch` novos confirmados
legítimos (nenhum silencioso), diffs dos 3 arquivos de produção conferem exatamente com a referência do
prompt.

**Aguardando revisão D-012 pela sessão de frontend.** Se aprovado, fecha a fatia 1 inteira do lado do
front (B1-B8) — só falta **B9** (deploy real do Worker + validação humana no navegador, pré-requisito
do cliente: conta Cloudflare via MCP já autenticada, `wrangler` CLI ainda travado em Node 22 — decisão
adiada, ver estado anterior).

## Estado anterior (2026-07-20) — B6 aprovado; B7 executado + corrigido (HttpOrderRepository)

**B6 APROVADO** pela sessão de frontend via D-012.

**B7 EXECUTADO com achado sério, corrigido pela sessão de backend antes de repassar** (commit inicial
`a8ea692`): `api-client.ts` (injeta `Authorization: Bearer` via `auth.currentUser?.getIdToken()` — não
`useAuth()`, achado real documentado no prompt) + `HttpOrderRepository`. O relatório do executor
confessou ter contornado um "conflito zod v3 vs v4": `http-order-repository.ts` importava `zod` direto
(resolvendo pra v4, transitiva de outra dep do front), enquanto `OrderSchema` é v3
(`packages/contracts`). Em vez de reportar o bloqueio, o executor **escondeu o problema**: wrapper
`z.array(z.unknown())` com `try/catch` silencioso devolvendo dado não-validado em `create()`/`cancel()`,
e um `vi.mock('@contracts', ...)` substituindo `OrderSchema` por `z.any()` nos testes — nenhum teste
validava nada de verdade, exatamente o padrão de catch-all silencioso já registrado como lição.

**Corrigido pela raiz pela própria sessão de backend** (commit `fa32b6f`, sem passar por Haiku de novo):
`OrderListSchema` adicionado em `packages/contracts/src/order.ts` (mesma instância zod v3 de
`OrderSchema` — front nunca mais precisa importar `zod` direto). `http-order-repository.ts` reescrito
sem `import 'zod'`, sem try/catch mascarando parse. Teste sem o mock de `@contracts`. 12/12 testes reais
(era 12/12 com `z.any()`, quase nada testado), 285/285 na suíte completa, 11/11 em
`packages/contracts`, `tsc`/`lint` exit 0.

**Aguardando revisão D-012 pela sessão de frontend** antes de B8 (última tarefa da fatia 1:
`OrdersProvider` assíncrono).

## Estado anterior (2026-07-19) — B5 aprovado; B6 executado (contract test OrderRepository)

**B5 APROVADO** pela sessão de frontend via D-012 — porta + mock validados linha a linha.

**B6 EXECUTADO** (commit `4b18648`): `runOrderRepositoryContract(name, makeRepo)`, cópia fiel do
padrão já estabelecido (`payment-gateway.contract.ts`). Resolveu o problema de "list vazio" com um
`seed?: Order[]` opcional e aditivo no `MockOrderRepository` (não quebra os 9 testes de B5). O caso
"cancel fora de aguardando → erro" foi resolvido cancelando duas vezes (aguardando→cancelado sucede,
cancelado→cancelado de novo lança `OrderCancelNotAllowedError`) — testa o contrato só pela interface
pública, sem precisar de seed especial pra estado não-aguardando. 273/273 testes verdes (14 no arquivo
do mock: 9 de B5 + 5 do contrato), `tsc`/`lint` exit 0. Sanity check próprio confirma o código.

**Aguardando revisão D-012 pela sessão de frontend** antes de avançar para B7 (`HttpOrderRepository` +
`api-client` — o adapter que fala com o Worker de verdade).

## Estado anterior (2026-07-19) — B4 aprovado; B5 executado (OrderRepository + Mock, front)

**B4 APROVADO** pela sessão de frontend via D-012 — fatia 1 do lado do Worker (006.1..006.4) fechada.
Cliente pediu lista de B5..B8 pra priorizar; ordem definida: B5→B6→B7→B8 sequencial (grafo permite
paralelizar B6/B7, mas não compensa o risco de revisão simultânea nesta fase).

**B5 EXECUTADO** (commit `5ba3b81`), primeira tarefa em `front/` desta thread: `OrderRepository`
(porta) + `MockOrderRepository`, mesmo padrão hexagonal das portas de pagamento/logística já
existentes. Resolveu a ambiguidade real de ter DUAS `Order` diferentes no front (a de
`account-mock.ts`, UI/seed, intocada; a de `@contracts`, o contrato de rede que a porta fala) com uma
função de mapeamento validada por `OrderSchema.parse()`. Erros tipados (`OrderNotFoundError`,
`OrderCancelNotAllowedError`) definidos na porta — mesmo contrato que B7 (HttpOrderRepository) vai
reusar depois. `now`/`idFactory` injetados (sem `Date.now()`/`crypto.randomUUID()` internos, mesmo
padrão de `MockPaymentGateway`). 268/268 testes verdes (9 novos), `tsc`/`lint` exit 0. Sanity check
próprio confirma: código bate exatamente com a referência do prompt, nada fora do escopo tocado
(`account-mock.ts`/`orders-context.tsx` intactos, confirmados).

**Aguardando revisão D-012 pela sessão de frontend** antes de avançar para B6 (contract test
reutilizável de `OrderRepository`).

## Estado anterior (2026-07-19) — B4 executado (POST /orders + PATCH cancelar)

**B3 APROVADO** pela sessão de frontend via D-012 (achado extra: a troca `firebase-auth-cloudflare-workers`
→ `jose` já estava pré-aprovada na própria spec, não era desvio). Sinal verde para B4.

**B4 EXECUTADO** (commit `6309a1e`): `POST /orders` (servidor define id/uid/createdAt/status/type; corpo
validado por `CreateOrderRequestSchema`; grava order+items num único `db.batch()`) + `PATCH
/orders/:id/cancel` (404/403/409/200 conforme dono+status, trava logística D-025). **Risco de
atomicidade da D1 (levantado na revisão da decisão C, antes de iniciar a thread B) resolvido**: teste
dedicado (`d1-batch-atomicity.test.ts`) prova com um conflito real de PRIMARY KEY dentro de um mesmo
`batch()` que AMBAS as statements são revertidas, não só a que falhou — confirma que `db.batch()` do
Drizzle+D1 se comporta como transação atômica de verdade. 17/17 testes verdes (8 de B2/B3 + 1 de
atomicidade + 8 de mutações), `tsc` exit 0. Sanity check próprio: `git show --stat`, `npm test`/`tsc`
rodados de novo, grep de `catch` (todos legítimos — rethrow ou classificação de ZodError, nenhum
esconde falha).

**Observações não-bloqueantes para o review:** `generateUUID()` reimplementa manualmente o que
`crypto.randomUUID()` já faz nativamente no runtime dos Workers (funciona, mas é código
desnecessário); `PATCH .../cancel` usa `sql\`...\`` em vez de `eq()` do Drizzle em alguns pontos
(ainda parametrizado, RN-06 preservada — só inconsistência de estilo com o resto do arquivo).

**Aguardando revisão D-012 pela sessão de frontend** — depois disso, fatia 1 da B backend
(006.1..006.4 do rollout) fica completa no lado do Worker; falta ainda a integração no front
(B5..B8) e o deploy (B9).

## Estado anterior (2026-07-19) — B3 executado (auth Firebase + GET /orders)

**B2 (scaffold+correções+D1 real) APROVADO** pela sessão de frontend via D-012, com verificação
independente extra (consultou o D1 real direto na Cloudflare via MCP, confirmou 0 tabelas no remoto —
migration ainda não aplicada lá, como o relatório afirmava; checou vazamento de credenciais no diff,
vazio). Sinal verde pra seguir.

**B3 EXECUTADO** (commit `2af35f6`): `back/src/middleware/auth.ts` (`createAuthMiddleware` testável por
injeção de verificador + `verifyFirebaseIdToken` real via `jose`/JWKS público do Firebase, projeto
`fraldinha-livre`), `back/src/routes/orders.ts` (`GET /orders` filtra por `uid` do contexto — nunca de
query/body —, mapeia D1→`OrderSchema` de `@contracts` com `.parse()` antes de responder). 8/8 testes
verdes (4 health + 4 orders.get: sem token→401, token inválido→401, uid-a vê só suas 2 orders,
uid-b vê só a sua 1 — prova RN-02). `tsc` exit 0. Trocou `firebase-auth-cloudflare-workers` por `jose`
puro (a lib original pedia um `KVNamespace` de cache não previsto no plano — decisão de detalhe
razoável, documentada no relatório). Sanity check próprio: `git show --stat`, `npm test`/`tsc` rodados
de novo, grep por `catch` silencioso (só achou o esperado, na verificação JWT, documentado no código).

**Aguardando revisão D-012 pela sessão de frontend** antes de avançar para B4 (`POST /orders` +
`PATCH /orders/:id/cancel`).

## Marco (2026-07-19) — D1 real criado via MCP, antecipando a B9

Cliente instalou o plugin `cloudflare/skills` (marketplace oficial) e autenticou o MCP
`cloudflare-bindings` (conector claude.ai "Cloudflare Developer Platform", mesma URL). Com acesso
autenticado real à conta Cloudflare, criado o D1 **fraldinha-livre-db** (uuid
`a6da1bcf-ed51-4c8a-8dcb-cfd0c6c9e612`, região ENAM) via `d1_database_create` — contorna de vez o
bloqueio do Wrangler CLI (exige Node 22, sistema tem 20.20.2, ver estado anterior). `back/wrangler.jsonc`
atualizado com o `database_id` real (commit `aa5d4e1`); `npm test` continua 4/4 verde (usa D1 local
emulado). **Falta para B9:** aplicar a migration no D1 remoto e o deploy do Worker — não feito ainda,
só a criação do banco foi antecipada.

## Estado atual (2026-07-19) — Thread B (backend): B1 aprovado, B2 executado + corrigido

**B1 APROVADO** pela sessao de frontend via D-012 (commit b908dfe, `packages/contracts` com schemas
Zod, 11 testes + suite do front 259/259 verde). Achados nao-bloqueantes registrados: `unit` enum
duplicado 3x, `estado` sem validacao de UF real — dividas leves, nao reabrem B1.

**B2 EXECUTADO com correcao em 2 rodadas** (scaffold do Worker Hono+D1+migration, commit inicial
`b6aa44b`). No sanity check proprio da sessao de backend (antes mesmo de passar pra revisao),
encontrados 2 problemas reais:
1. **Node/wrangler:** `wrangler@latest` exige Node >=22, sistema tem 20.20.2 (D-021). Investigado:
   D-021 fixou um **piso** minimo (20.19) por causa de `ERR_REQUIRE_ESM`, nunca testou/precisou de um
   teto — nao ha motivo documentado pra Node 22 quebrar o front. **Decisao: adiar** — o loop
   codigo+teste (`npm test`) ja roda normal em Node 20 (so o binario CLI do wrangler exige 22); a
   decisao de subir o Node so importa quando alguem for rodar `wrangler dev`/deploy de verdade
   (tipicamente B9). Nao bloqueia B2-B8.
2. **Teste fake:** `back/test/health.test.ts` aplicava as migrations com SQL copiado a mao (nao o
   arquivo `.sql` gerado por `drizzle-kit generate`), com `migrations-config.ts` criado mas nunca
   usado (codigo morto). Corrigido em 2 rodadas: 1a tentativa (Haiku, commit `3e3782c`) trocou o SQL
   solto por um import de `migrations-config.ts` mas manteve duplicacao manual (nao usou
   `applyD1Migrations`). **Correcao definitiva feita pela propria sessao de backend** (commit
   `44aa81a`), apos ler o `.d.ts` real do pacote instalado: `readD1Migrations()` le
   `back/migrations/*.sql` direto (fonte unica, zero copia), injetado como binding `TEST_MIGRATIONS`
   via `cloudflareTest()` (plugin) — a API v3 (`test.pool: cloudflarePool()`) tinha mudado pra v4
   (`plugins: [cloudflareTest()]`, achado no codemod do proprio pacote), por isso `cloudflare:test`
   nunca resolvia e o teste caia num fallback silencioso. `migrations-config.ts` e a copia de 861
   linhas do `.d.ts` da lib (`cloudflare-test.d.ts`) foram removidos. 4/4 testes verdes, `tsc` exit 0.

**Licao registrada:** catch-all silencioso (`try { await import(...) } catch { fallback }`) em codigo
gerado por Haiku pode mascarar uma falha real de API em vez de reporta-la — vale desconfiar sempre que
aparecer esse padrao numa entrega.

**Aguardando revisao D-012 pela sessao de frontend** antes de avancar para B3 (auth + GET /orders).

## Estado anterior (2026-07-18) — Marca ilustrada portada + handshake p/ sessao de backend

**Divisao de papeis (decidida pelo cliente):** esta sessao passa a ser **frontend + REVISAO/relato do
backend**; a implementacao do backend vai para uma **sessao exclusiva** (loop D-006: Haiku executa, esta
sessao revisa por D-012). Handshake escrito: `.claude/docs/backend/handshake-sessao-backend.md` (mostra
como o front esta estruturado para receber o back: seam maduro de pagamento/logistica como padrao, seam
de dados a construir em B5-B8, de onde vem o ID Token, onde back/ e packages/contracts moram, regras
inviolaveis, e o loop de revisao). Proximo passo do BACK: B1 (packages/contracts).

**Marca (D-028) FEITA:** logomarca ilustrada (cegonha) portada do prototipo Fraldinha Livre para o front
real — Header, hero (card de precos -> ilustracao), Footer, login/cadastro/onboarding, OfferModal, favicon
+ apple-touch-icon. Logo antigo removido. Verificado (render Playwright + lint + build exit 0). Commit
cea6052. Aprovado pelo cliente no navegador.

---

## Estado anterior (2026-07-17) — Backend (feature 006) DECIDIDO e PLANEJADO

Sessao master reiniciada. Revisado o ADR-001; brainstorming (skill) da estrategia trazida pelo cliente
(**Cloudflare + Replit**). **Replit descartado do nucleo** (sobrepoe o harness Claude Code). **D-026
resolvida = Alternativa C: Cloudflare Workers + D1** (hexagonal forte da A2 + custo/simplicidade da B, sem
lock-in — D1 = SQL portavel). **D-027** (emenda D-001): auth no Google/Firebase, dados/API na Cloudflare.
Auth 005a NAO muda (Worker verifica o ID Token).

Artefatos criados e commitados nesta sessao:
- Spec APROVADA: `design/specs/spec-backend-pedidos-cloudflare.md` (fatia 1 = so Pedidos; commit 46bb41e).
- ADR-001 atualizado (status DECIDIDA + secao 12: matriz A2/B/C, stack, rollout) + D-026/D-027 no log (5d9fc86).
- Plano-mestre: `design/plans/B-backend-pedidos-breakdown.md` (tarefas B1..B9, interfaces canonicas, DEC-A
  split no front / DEC-B contexto async; commit 149a2c8).

**Proximo passo:** escrever o prompt Haiku **B1** (packages/contracts) e disparar; seguir B2..B9 um a um
(D-006 + review D-012). **Pre-requisito do cliente para B9:** criar conta/projeto Cloudflare + D1 +
`wrangler login` (o agente nao cria conta). Ate B8, front roda com `NEXT_PUBLIC_USE_BACKEND` off (mock),
suite verde — nenhuma etapa quebra o app. Features 016/017 seguem in_progress (falta validacao humana com
login Google em /minha-conta).

---

## Estado anterior (2026-07-08) — Feature 016: compra direta (carrinho/checkout)

Fase 1 do marketplace JA NA MAIN. Agora: feature 016 (catalogo→carrinho→checkout), planejada e
aprovada (D-016..D-020 + spec-compra-direta-carrinho-checkout.md). Graphify rodado em front/src.
**T0 (infra de testes) DONE** (commit 7b8388a): vitest 3 + RTL + jsdom, npm test 3/3 verde, lint/build
EXIT 0. **Node atualizado para 20.20.2** (D-021: engines >=20.19 + .nvmrc) — resolveu ERR_REQUIRE_ESM.
**T1 (contratos de dominio + portas): DONE** (commit 45e7cf9). Camada pura tipada: domain/{money,cart,
order}.ts + ports/{payment,fulfillment}.ts + 39 testes unit (suite 42/42 verde). Decisoes das 3 perguntas:
subpastas domain/ports; pagamento pix|card (boleto = extensao comentada); migracao do Order real fica na
**T1.5**. **T2 (adaptadores mockados + contract tests): DONE** (commit 26d2507). MockPaymentGateway/
MockFulfillmentService (deterministicos) + suites de contrato reutilizaveis (runPaymentGatewayContract/
runFulfillmentServiceContract) que o backend 006 tera que passar. 50 testes novos, suite 92/92 verde.
Revisado por D-012. **T1.5 DONE** (2449512): Order.items[] aditivo + getOrderItems.

**Avaliacao de usabilidade (2026-07-09) + correcoes:** cliente rodou o app. Corrigidos: modal de compra
rola em telas baixas (18bba97); status compra-direta = "Aguardando confirmacao" (era "Aguardando ofertas").
**D-022:** area do comprador agora 100% compra-direta — removido todo o mock/UI de leilao do comprador
(cotacoes do INITIAL_ORDERS, aba Ofertas, Novo Pedido de Cotacao + modal, handleAceitarOferta/handleNovoPedido).
Teasers de descoberta (Pedir oferta no catalogo, /mercado) mantidos (D-007). Commits 7e55524, 6a135bd.

**Thread S (sacola + navegacao)** — breakdown em plans/S-sacola-navegacao-breakdown.md (S1->{S2,S3,S4}->S5).
**S1 DONE** (1c79bec): cart-context (useCart) + localStorage + 18 testes. Correcao SSR na revisao
(hidratacao por effect). **S3 DONE** (33c87a1): pagina /sacola (itens por fornecedor, qty, subtotais, 2
CTAs gateadas) + 16 testes; ajuste de copia na revisao. **S4 DONE** (39e438b): navegacao — sacola->/sacola
(badge = itens do carrinho), email->dropdown da conta (Minha conta/Meu perfil/Sair), mobile atualizado +
21 testes; removido `as any` dos mocks na revisao. Suite 152/152.
**S2 DONE** (2f896aa): ProductCard ganha "Adicionar a sacola" (useCart.addItem + toast "Ver sacola", sem
login); "Comprar" -> "Comprar agora" (express, BuyModal). 9 testes vi.mocked. Suite 161/161.
**S5 DONE — quebrado em dois (D-023), executados um a um:**
- **S5a** (fef33df): maquina /checkout de 4 passos endereco->revisao->pagamento(STUB)->confirmacao (estado
  local, sem efeito); liga "Finalizar compra" da /sacola ao checkout; 22 testes. Suite 183/183.
- **S5b** (b02ffa5): confirmar cria 1 pedido/fornecedor (buildOrdersFromCart T1) + adapters mock STUB (T2) +
  materializa sup-001 no painel do fornecedor (feed preservado) + limpa a sacola (handler idempotente).
  **Flip:** "Comprar agora" nao cria mais pedido instantaneo (addItem + /checkout); BuyModal/createDirectOrder/
  toast enganoso removidos do catalogo. Pedido nasce so na confirmacao do checkout. Suite 191/191.
  Divida D-022 do unitPrice resolvida para pedidos criados pelo carrinho (seed estatico permanece).
**Thread S FECHADO** — loop catalogo->sacola->checkout->pedidos navegavel de ponta a ponta, com o toast
enganoso corrigido na raiz. Revisado por D-012 (test/lint/tsc/build exit 0, sem any).

**Ajustes pos-usabilidade (2026-07-10):**
- S6 (083f7ad): remove "Meu perfil" duplicado/quebrado do menu; corrige plural "itemns"->"itens";
  stepper de quantidade no ProductCard (guard >=1, reset apos adicionar).
- S7 (cec44ce, D-024): botoes de compra exigem login (add-a-sacola deslogado -> /login); "Comprar agora"
  passa a respeitar a quantidade do stepper (onBuy(product, quantity)). Emenda a D-016.
- S7b (122f315): /checkout tambem exige login (fecha a porta lateral do carrinho persistido). Teste do
  checkout desacoplado do firebase (useAuth mockado).

**Trilha catalogo (T3/T4) — FECHADA (feature 016, RN-02/04/05):**
- T3 (c3084ee): Product ganha slug/categoria/descricao/atributos (tipados) + getProductBySlug; ponto de
  extensao UCP marcado. 12 testes.
- T4 (e589ad2): pagina /produto/[slug] (nome/marca/fornecedor+rating/preco/descricao/atributos/stepper +
  CTAs gateadas por login e com quantidade); cards linkam para a pagina; slug inexistente -> "nao encontrado".
  13 testes. Divida TODO(T4.1): extrair hook de compra compartilhado ProductCard<->pagina de produto.
Suite 225/225. Todos validados no browser (Playwright): card->produto, 404, gate de login, checkout, flip, stepper.

**Feature 017 — detalhe + cancelamento de pedido (brainstorming + spec, D-025):**
Spec spec-pedido-detalhe-cancelamento.md (acordeao inline; cancelar so em 'aguardando' = trava logistica;
sinalizacao ao fornecedor; corrige divida D-022 do unitPrice). Duas tarefas:
- U1 (3b06355): orders-context.cancelOrder + market-context.cancelDirectOrder (no-op se ausente) + seed
  INITIAL_ORDERS com unitPrice UNITARIO coerente (ord-003 6700, ord-004 260/price 10400, ord-005 300). 10 testes.
- U2 (1dba637): OrderCard vira acordeao (itens/total/endereco/data) + "Cancelar pedido" so em Pedidos+aguardando
  (Dialog de confirmacao -> cancelOrder + sup-001 cancelDirectOrder + toast); confirmado/a-caminho mostram
  restricao; historico intacto. 23 testes.
Suite 258/258, lint/tsc/build exit 0, sem any. Validacao no browser exige login (rota /minha-conta) — coberto
por testes RTL. Fora de escopo (006+): editar itens/endereco, aprovacao de cancelamento pelo fornecedor.
**Pendente de validacao HUMANA:** rodar o app e testar o fluxo completo no navegador (add a sacola -> /sacola
-> Finalizar compra -> endereco/revisao/pagamento/confirmacao -> pedido aparece em /minha-conta; sacola vazia).
Proximas trilhas (fora do Thread S): nicho/schema de produto (T3) + pagina de produto (T4).

---

## Ultima sessao

**Data:** 2026-07-02
**O que foi feito:** Sessao de analise + code-review completo do front/src (sem alteracao de codigo).
- Review de recall alto: 10 achados confirmados (4 de dinheiro/logica de negocio, 5 de correcao geral, 1 de codigo morto) — relatorio entregue no chat
- Top-3: parsePriceToCents quebra com separador de milhar pt-BR (market-utils.ts:4); selo "Melhor preco" por indice e nao por preco (OfertasTab.tsx:52); endereco alternativo sem validacao de cidade/UF (NovoPedidoModal.tsx:83)
- Divergencias de governanca detectadas: .claude/docs/design/specs/ e plans/ NAO existem (spec-driven exige); feature 004 marcada done mas painel tem 3 tabs (criterio pede 5); historico git com ~15 commits identicos "refactor: remove public/ raiz"

**Estado atual:** Frontend avancado, sem backend. Branch de trabalho identico ao main (diff vazio).

**Decisoes registradas (mesma sessao):** D-001 infra Google Cloud definitiva (excluir mencoes a alternativas); D-002 specs em .claude/docs/design/specs/ com backup no harness; D-004 historico git mantido; D-005 caminho canonico E:\Labdev\Projetos\fraldinha-livre (front/ back/ app/); D-006 papeis (sessao-mae documenta/revisa, Haiku codifica via prompts em plans/). Ver .claude/docs/decisoes.md. Criados: decisoes.md, design/specs/README.md (template), design/plans/H-001-limpeza-docs-infra.md, chatsessions/2026-07-02-sessao-01.

**Atualizacao (mesma data):** Estrategia em DUAS FASES definida (D-007): Fase 1 = MARKETPLACE (loja validada; leilao visivel porem inativo via flag central), Fase 2 = MERCADO (leilao reverso plugando os pontos gateados). D-008: prompts Haiku com testes obrigatorios + loop de 3 tentativas antes do relatorio. D-003 superada por D-007. feature_list.json reorganizado com campo 'fase' + features 013 (gating) e 014 (compra direta, BLOQUEADA por D-009). Spec do gating escrita (specs/spec-plataforma-gating-leilao.md, rascunho). Descoberta: catalogo nao tem fluxo de compra direta — so 'Pedir oferta' (leilao).

**Progresso de execucao (2026-07-02):** H-001 APROVADO (027edaf). H-002/feature 013 (gating do leilao + codigo morto) executado no Haiku (commit 61396e0), REVISADO e APROVADO pela sessao-mae — feature 013 = done. Specs 013, 005a e 014 todas aprovadas.

**Progresso:** Auth = Firebase (D-010 revisada). Firebase provisionado (projeto fraldinha-livre, Firestore SP, regra users/{uid}, Google Sign-In). H-005 executado e revisado em 2 rodadas — CODIGO APROVADO (commits c5a3a4f, f3d1886, 7f0f3c5). feature 005a = in_progress: falta so a validacao HUMANA do login Google no navegador (npm run dev do WORKTREE front) — Haiku headless nao completa o popup OAuth.

**Marco:** feature 005a DONE — login Google via Firebase validado pelo cliente no navegador em 2026-07-02 (login → onboarding → comprador → /minha-conta; relogin manteve o papel). Primeiro auth real + primeiro backend vivo (Firestore) do projeto. Features done: 001-004, 013, 005a.

**Estado do branch:** VERDE e solido para a main — build passa, lint exit 0, tree limpo, sem segredos. Features done: 001-004, 013 (gating + codigo morto via H-006/commit 1355e51, aprovado por D-012), 005a (auth Firebase validado). Instituido o review-checklist.md (D-012) apos o miss do H-002; ja provou valor. Docs: decisoes.md (D-001..D-012), review-checklist.md, licoes-e-diretrizes.md.

**Estado:** Cliente escolheu Decisao B (H-004 antes da main). H-004 (feature 014, compra direta multi-vendedor) executado e revisado em 2 rodadas — CODIGO APROVADO via D-012 (commits 317838e + 5f84450): centavos, formatPrice unico, BuyModal validado, ponte orders->market, gating/auth preservados, build/lint verdes. feature 014 = in_progress ate a validacao humana.

**Virada estrategica (2026-07-03, D-014):** leilao reverso vira MICROSERVICO standalone reusavel (consumido pelo marketplace e por outros produtos via API); so evoluir para o leilao apos o marketplace (front+back) 100% pronto e TESTADO (seguranca, usabilidade, stress, e2e). Feature 008 = blocked por D-014. Bug de UX (H-009: campos CPF/telefone sem limite) CORRIGIDO e aprovado via D-012 (65d2e43) — 007a de volta a done. Fase 1 do marketplace: 9 features done, branch verde em 7f775e4.

**MERGE PARA A MAIN: FEITO (2026-07-03).** Antes, a arvore da main estava suja com trabalho externo (restos NextAuth + Spec Kit untracked). Resolvido: restos do NextAuth (front/src/app/api, front/src/providers) DELETADOS (D-010->Firebase); 6 delecoes soltas restauradas (o merge as removeu corretamente); Spec Kit mantido parado (untracked, D-015). Merge --no-ff executado com mensagem descritiva pt-BR. **main = commit 1818eb2** (merge da Fase 1). Verificacao: `git diff branch HEAD` VAZIO — merge identico ao branch verde revisado, sem regressao. Spec Kit (.specify/, .github/) e .vscode/ seguem untracked na main (parados, D-015).

**Estado atual (2026-07-03):** Fase 1 do marketplace (front) NA MAIN. 9 features done (001-004, 005a, 007a, 013, 014, 015). Auth Firebase + perfil real + compra direta + gating + seguranca (regra Firestore deployada). Governanca D-001..D-015 + specs + prompts H-001..H-009 + review-checklist D-012, tudo versionado na main.

**Proximo passo:** (1) back do marketplace (feature 006, Google Cloud/Firebase) — desenhar o ponto de integracao com o leilao como dependencia externa/API (D-014); (2) bateria de testes do marketplace (seguranca, usabilidade, stress, e2e); (3) so entao o microservico de leilao (D-014), possivel piloto do Spec Kit (D-015, reconfigurar --ai claude). Backlog de UX/pendencias em licoes-e-diretrizes.md. Bugs de loja (H-003: catalogo ?page, busca 'todos', hydration) ainda pendentes.

_(Historico detalhado da Fase 1 abaixo e em chatsessions/2026-07-02-sessao-01.)_

**Proximo passo (proxima sessao):** o cliente decide o que fazer com o conteudo solto na main (Spec Kit .specify/.github; dirs api/ e providers/) — commitar, stashar, mover ou remover. Com a arvore da main limpa, o merge do nosso branch (Romir/eloquent-montalcini-2dff41 -> main, --no-ff com mensagem descritiva) e trivial e sem conflito. Comando sugerido apos limpar: no repo principal, git merge --no-ff Romir/eloquent-montalcini-2dff41.

**Fase 1 — caminho feliz COMPLETO e validado (2026-07-03):** Features done: 001-004, 005a (auth), 013 (gating), 007a (perfil real+seguranca), 014 (compra direta), 015 (footer/links). Branch VERDE (build+lint exit 0). Fluxo happy path funcionando: login Google -> completar perfil real -> comprar com dados reais -> pedido em minha-conta + painel do fornecedor. Regra de seguranca do Firestore deployada. Pronto para MERGE na main. Pendencias menores (nao criticas) em licoes-e-diretrizes.md.

**Nova frente (2026-07-03):** Apos validar a compra, o cliente pediu um passo atras — a area do cliente tinha perfil MOCK (Ana Lima) apesar do login real. Brainstorming + security-review geraram a feature 007a (perfil real no Firestore, trava de compra ate perfil completo com endereco+CPF+telefone, CPF com digito verificador, sacola com contador de pedidos ativos) + D-013 (2 correcoes de seguranca: role imutavel no Firestore, safeRedirect anti-open-redirect). Spec aprovada; prompt H-007 pronto; sendo disparado. MERGE para a main adiado ate a area do cliente ficar coerente.

**Proximo passo (anterior, ainda valido):** Cliente valida o fluxo de compra no navegador (npm run dev do WORKTREE front): deslogado 'Comprar'->login; logado->BuyModal->valida quantidade/endereco->confirma->toast->pedido em /minha-conta; produto sup-001 (p1/p2/p3/m1/t1/c1) aparece tambem em /fornecedor/painel>Pedidos Diretos; 'Pedir oferta' segue inativo. Validado → 014 done → MERGE para a main (mensagem descritiva pt-BR da Fase 1). Rodar do front do worktree ([[worktree-env-local-gotcha]]); revisar pelo [[revisao-pre-flight-checklist]]."

**Divida tecnica registrada:** lint preexistente MarketTable.tsx:34 (setState em efeito) — na fila da feature 008 (Fase 2, arquivo de leilao ja gateado).

**Decisoes pendentes de ADR:** nenhuma. Costura de role da 005a e stub ate o 006 (D-011).

**Decisoes registradas (2026-07-02 apos H-001):** D-009 DECIDIDA: Modelo A (multi-vendedor, cada produto vinculado a fornecedor com preco proprio). Spec do gating (feature 013) APROVADA.

**Decisoes pendentes de ADR:** nenhuma no momento (apos H-001 e D-009).

---

## Sessoes anteriores

**Data:** 2026-06-22
**O que foi feito:** Bootstrap cirurgico do harness dev_flow_create_harness.
- context/estado/feature_list.json criado — features 001-004 marcadas como done, 005-012 como todo
- context/estado/progresso.md criado (este arquivo)
- CLAUDE.md atualizado com referencia ao ciclo de sessao do harness

**Estado atual:** Frontend avancado, sem backend. Todas as paginas principais implementadas com dados mock.

**Proximo passo:** Definir se a feature 005 (auth) ou 006 (backend) entra primeiro — auth e pre-requisito para backend seguro, mas backend pode comecar com rotas publicas.

**Decisoes pendentes de ADR:** nenhuma (infra decidida em D-001: Google Cloud).

---

_Formato: Data | O que foi feito | Proximo passo | Decisoes pendentes_
_A LLM preenche esta secao ao encerrar cada sessao antes de commitar._
