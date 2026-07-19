# Progresso — fraldinha-livre

## Estado atual (2026-07-19) — B3 executado (auth Firebase + GET /orders)

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
