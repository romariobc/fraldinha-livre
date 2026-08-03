# Progresso — fraldinha-livre

## Marco (2026-08-02/03) — Sessão backend: incidente de segurança fechado + revisão D-012 de M1-M4 (feature 018)

**Sincronização:** worktree estava 35 commits atrás de `origin/main` (D-037/D-037b, thread H-011/H-012,
painel admin, etc. — nenhum autorado por esta sessão). `git merge origin/main`, fast-forward limpo,
baseline reverificada (69/69 testes, tsc exit 0) antes de qualquer trabalho novo.

**Incidente de segurança (GitHub Secret Scanning, alerta #1):** `NEXT_PUBLIC_FIREBASE_API_KEY` exposta
em `front/.env.production:18` (commit `2e79da0`, D-037b). Verificado de forma independente via
`gh api repos/romariobc/fraldinha-livre/secret-scanning/alerts` antes de agir (o e-mail encaminhado
pelo Romario não foi seguido cegamente — o prompt embutido nele sugeria remediação mais agressiva
que o caso real justificava). Avaliação técnica: é a chave web pública do Firebase, não um segredo
tradicional — controle de acesso real é via Firebase Security Rules, não confidencialidade da chave.
Mesmo assim, seguiu o guardrail do harness (nunca commitar segredo, mesmo de baixo risco):

1. Romario restringiu a chave no Google Cloud Console (Application restrictions → HTTP referrer
   `fraldinha-livre-frontend.romariobc.workers.dev/*` + `localhost:3000/*`; API restrictions →
   Identity Toolkit/Token Service/Firebase Installations).
2. Alerta #1 resolvido via `gh api` PATCH (`resolution: false_positive`, com nota explicando o
   motivo + a restrição aplicada).
3. Nenhuma mudança de código — remover o valor do arquivo quebraria o build git-integrado da
   Cloudflare (mesmo bug do D-037b), e a chave já está restrita. Migração opcional pra "Build
   Environment Variables" do dashboard Cloudflare fica como dívida de higiene, não urgente.
4. Coordenado com a "[FR]Master session" antes/depois de agir — `front/.env.production` é domínio
   deles, não mexi sem avisar. Pedido que registrem como decisão formal em `decisoes.md` (branch
   deles está mais atual); não fiz essa entrada por aqui pra não precisar sincronizar só por isso.

**Revisão D-012 de M1-M4 (thread M, feature 018 — chat-agent mobile, sessão "Estratégia app
Fraldinha Livre", branch `Romir/fraldinha-livre-app-strategy-309c5a`):** revisão real, não só o
relatório — fui direto no worktree deles (`fraldinha-livre-app-strategy-309c5a`), rodei suíte e tsc
de novo (89/89, tsc limpo) e li o código de cada commit (`0dff234`/`e1c80c8`/`0a47359`/`4e1a4b9`/
`6e52124`). Confirmado por leitura, não só aceito: `chat-tools.ts` exclui `supplierId`/`supplierEmail`
das colunas retornadas e filtra `active=true` em `searchProducts`/`getProduct`; `/chat/*` está atrás
do mesmo `createAuthMiddleware` de `/orders/*` (conferido no diff de `index.ts`); loop de tool-use
limitado a `MAX_TOOL_ITERATIONS=4` (guardrail do harness contra loop sem limite). **APROVADO**, com
1 achado não-bloqueante repassado: `select_product_for_purchase` não valida o `productId` alegado
pelo modelo contra o catálogo antes de responder a action ao front (não é falha de segurança — o
`POST /orders` já revalida tudo na escrita, thread P — mas pode gerar UX ruim se o modelo alucinar
um id). Sugestão registrada, decisão de correção é da sessão dona do código.

**Trabalho pausado, não retomado ainda:** brainstorming de subagentes customizados (`.claude/agents/`)
pra formalizar o padrão de duas sessões Master (backend/frontend) que já vem sendo usado organicamente
— ficou pausado no meio pelo incidente de segurança. Verificação prévia contra o harness de referência
(`dev_flow_create_harness`) já feita: o padrão de sessão sequencial do harness não cobre múltiplas
sessões Master em paralelo — é extensão específica deste projeto, a documentar como divergência
(`ciclo-de-sessao.md` §7) quando o design for retomado, não como se already fosse regra do harness.

**Próximo passo:** retomar o design dos 3 subagentes (`thread-dispatcher`/`d012-reviewer`/
`project-state-keeper`) se o Romario quiser continuar; ou aguardar a sessão do app mobile avançar
pro M7 (deploy) e a sessão de frontend dar o OK dela também.

---

## Marco (2026-08-02) — Feature 012: painel administrativo read-only (H-012)

Sequencia completa spec-driven: brainstorming fechou o escopo que o backlog
deixava "a definir" (admin unico hardcoded via UID fixo, sem sistema de
papeis novo; "disputas" cortado — nao existe sistema disso hoje; "ofertas"
= produtos do catalogo; somente leitura, sem acoes de gestao) → spec
aprovada (`spec-painel-admin.md`) → plano `H-012` → execucao por subagente
Haiku (TDD real, 9 commits) → revisao independente da sessao-mae (D-012).

**Entrega:** `/admin` no front, gateado pelo UID fixo
`KOQclmb5eshfkufioK03ayRh6Fi2`, com 3 abas — Usuarios (Firestore direto),
Pedidos e Produtos (`GET /orders`/`GET /products` com `scope=admin` novo no
backend, gated por `uid === ADMIN_UID`). Regra nova do Firestore liberando
leitura da colecao `users` pro UID admin, **deployada em producao**
(autorizada explicitamente pelo Romario).

**Achado real durante a execucao:** o middleware de `/products` tratava
`scope=admin` como rota publica (so excluia `scope=fornecedor`) — corrigido
junto, senao teria vazado a lista completa de produtos sem exigir token.

**Revisao D-012** (independente do relatorio do subagente): git show --stat
dos 9 commits, leitura linha a linha dos handlers e da regra do Firestore,
reexecucao propria de toda a verificacao — back 69/69, front 364/364, lint
0 erros, tsc 0 erros nos dois lados, build de producao ok. Regra do
Firestore validada por sintaxe antes do deploy e conferida ao vivo depois.

Detalhes completos em D-039, `.claude/docs/design/plans/H-012-painel-admin.md`
e `spec-painel-admin.md`.

**Pendente:** deploy normal do codigo (front/back) via push na `main` —
Git integration ja configurada desde D-037b, dispara build automatico.
Sem pendencia de validacao humana no navegador registrada ainda.

---

## Marco (2026-07-30) — Feature 010 (fatia loja): notificacao por email ao fornecedor (H-011)

Sequencia completa spec-driven: brainstorming (canal email vs push, provedor,
descoberta de que sem dominio proprio o Resend so envia pra enderecos de teste
dele) → spec aprovada (`spec-fornecedor-notificacao-email.md`) → plano H-011 →
execucao por subagente Haiku → revisao independente (D-012).

**Entrega:** fornecedor recebe email quando um pedido direto chega, atras da flag
`NOTIFICATIONS_ENABLED` (desligada por padrao — ativa quando houver dominio
verificado). Middleware de auth agora carrega o claim `email` do token Firebase;
`products.supplier_email` capturado na criacao do produto; modulo
`back/src/lib/notifications.ts` best-effort (nunca bloqueia o pedido).

**Revisao D-012 achou 2 problemas reais**, ambos corrigidos antes do push:
1. Commit da Tarefa 1 (middleware) faltando — gap do proprio prompt H-011, nao da
   execucao.
2. `npm run db:generate` colidiu com uma migration `0004` ja existente (hand-written,
   nunca rastreada pelo journal do drizzle-kit) — renomeado pra `0005`, journal
   corrigido, suite revalidada (63/63).

Tambem nesta sessao: **D-038** registra o fechamento de um alerta real do GitHub
Secret Scanning (NEXT_PUBLIC_FIREBASE_API_KEY commitada) — chave restrita no GCP
Console pelo Romario, alerta resolvido pela sessao do backend, sem mudanca de
codigo necessaria.

Detalhes completos em `.claude/docs/design/plans/README.md` (entrada H-011) e
`spec-fornecedor-notificacao-email.md`.

**Pendente pra ativar de verdade:** `wrangler secret put RESEND_API_KEY` (manual,
fora do escopo do H-011) + dominio proprio verificado no Resend + virar
`NOTIFICATIONS_ENABLED` pra `"true"`.

---

## Marco (2026-07-29) — Blueprint de arquitetura + bug critico de producao achado e corrigido (D-037)

Pedido do Romario: gerar um documento visual da arquitetura completa (front+back) e
atacar os pontos faltantes do projeto, deixando gateway de pagamento e leilao
reverso por ultimo — prioridade e colocar o projeto no ar pra testes de usabilidade
real antes do pagamento, visando o beta.

**Blueprint salvo:** `.claude/docs/infra/blueprint-arquitetura-2026-07-29.html`
(diagrama de arquitetura, inventario de rotas/portas, status por feature, lista do
que falta).

**Higiene de infra:** branches remotas ja mergeadas deletadas
(`Romir/folder-analysis-070a4b`, `Romir/master-session-restart-535624`);
`front/package.json` `engines.node` corrigido pra `>=22.0.0` (alinhado com o
Dockerfile); campo `traces` invalido removido de `back/wrangler.jsonc` (warning
cosmetico em todo build).

**QA manual em producao encontrou um bug real e serio (D-037):** a aba "Pedidos
Diretos" do painel do fornecedor sempre falhava, inclusive pra um fornecedor de
teste de verdade logado. Diagnosticado com evidencia direta (ID Token real via
REST do Firebase + curl direto no backend, provando que o backend estava correto) —
causa era `MarketProvider` disparando `listForSupplier()` sem esperar o Firebase
restaurar a sessao nem checar se havia usuario logado, mesma classe de bug ja
corrigida antes em `OrdersProvider` (B9) mas nunca replicada aqui. Corrigido
(commit `c858264`): gate por `useAuth()` (`authLoading` + `user` + `role`), loading
exposto virou valor derivado. 4 testes novos, suite 354/354, build ok.

**Tracker corrigido:** feature 005b (email/senha) marcada `done` — ja estava
implementada (D-034) mas o tracker dizia `todo`. Feature 006 (backend da loja)
marcada `done` — o escopo restante foi entregue via 007 (thread C).

Detalhes completos em D-037. Deploy em andamento (push feito, aguardando o
container do frontend reciclar).

---

## Marco (2026-07-26) — PR #12 mergeado na main; thread C (feature 007) consolidada ponta a ponta

A sessão de frontend (`Romir/master-session-restart-535624`) mesclou o backend (C2-C5, este worktree)
na própria branch (commit `a17a872`, zero conflitos — mudanças contidas em `back/`), rodou a suíte
completa (back 57/57, front 351/351, tsc/lint limpos nos dois, build de produção OK) e abriu o PR
único #12 pra `main` cobrindo toda a thread C (C2-C11) + fixes de auth mobile (D-034/D-035/D-036).

**Ação desta sessão (backend):** confirmei o estado antes do push (HEAD `b1611c4`, sem commits novos,
57/57 verde), sem objeção à estratégia de consolidação. Após aprovação do Romario, **mergeei o PR #12**
(`gh pr merge 12 --merge`, merge commit — mesma convenção das PRs #7-#11 deste repo, confirmada por
`git show --format=%P` num merge anterior antes de escolher o método) — commit `f52ab467`. Sincronizei
este worktree/branch com `origin/main` (fast-forward `b1611c4..f52ab46`, sem conflito). Reverifiquei
depois do sync: suite back 57/57, `tsc --noEmit` exit 0. `feature_list.json` confirma `007` como
`done`. Verifiquei os 2 arquivos `.env.production*` novos trazidos pelo merge — só `NEXT_PUBLIC_*`
(públicas por design, documentado nos próprios comentários), nenhum segredo.

**Thread C (feature 007, Catálogo do Fornecedor) fechada ponta a ponta em produção — C1 a C11,
backend e frontend, com validação humana completa (login Google desktop+mobile).**

**Próximo passo (não decidido ainda):** definir a próxima fatia — Estoque foi mencionada como
possível próxima frente de backend, mas nada iniciado.

---

## Marco (2026-07-26) — C11 fechado: login mobile confirmado em Android real, thread C (feature 007) concluída (D-036)

Romario confirmou teste real no Android: login Google autorizou e voltou autenticado. Essa era a
última pendência humana de C11 (deploy real + migrations remotas + validação humana completa,
thread C — feature 007 Catálogo do Fornecedor). **Feature 007 marcada `done`** em `feature_list.json`.

Estado de produção: frontend `fraldinha-livre-frontend.romariobc.workers.dev` (deploy `a56ec67b`,
`NEXT_PUBLIC_USE_BACKEND=true`, proxy de auth mobile ativo); backend
`fraldinha-livre-backend.romariobc.workers.dev` (fix de badge null, commit `b1611c4`). Login Google
confirmado em desktop e mobile.

**Próximo passo:** avisar a sessão do backend (worktree `blissful-lamport-ccb562`, branch
`Romir/folder-analysis-070a4b`) que é hora de consolidar frontend (`Romir/master-session-restart-535624`)
+ backend num PR único para `main`.

Detalhes completos em D-036.

---

## Marco (2026-07-26) — Fix real do login mobile (proxying authDomain) — falta 1 passo humano (D-035)

O fix de D-034 (`signInWithRedirect`) não resolveu — usuário Android continuou sem conseguir logar
(autoriza no Google, volta pra `/login` sem erro). Consultei o Gemini (Firebase Console), causa raiz
confirmada: `authDomain` (`fraldinha-livre.firebaseapp.com`) é origem diferente do domínio real do
app (`workers.dev`) — mobile bloqueia o storage de terceiro que o Firebase usa pra recuperar o
resultado do redirect.

**Fix aplicado (proxying, sem DNS customizado):** `next.config.ts` faz rewrite de `/__/auth/*` pro
handler real do Firebase; `authDomain` de produção passa a ser o domínio do app
(`front/.env.production.local` — teve que ser esse arquivo específico, não `.env.production`, por
causa de precedência do Next.js com `.env.local`). Verificado com build Docker local + produção real
antes de fechar: `authDomain` correto no bundle, `/__/auth/handler` responde com o handler real do
Firebase nos dois ambientes. Deploy `a56ec67b`.

**⚠️ Pendência humana obrigatória, ainda não confirmada:** Romario precisa atualizar o OAuth Client
ID do provider Google no **Google Cloud Console** (não Firebase Console) — adicionar a origem JS
`https://fraldinha-livre-frontend.romariobc.workers.dev` e o redirect URI
`https://fraldinha-livre-frontend.romariobc.workers.dev/__/auth/handler`. **Sem isso o login mobile
ainda não funciona de verdade** — o código está certo, falta essa configuração do lado do Google.

Detalhes completos em D-035.

---

## Marco (2026-07-26) — Login mobile + e-mail/senha habilitado + 2 fornecedores de teste (D-034)

Fix do login Google em mobile (`signInWithRedirect`, achado real de usuário Android). Verificado
(não assumido) que o login por e-mail/senha NÃO estava funcional apesar da tela existir — implementado
de verdade (`signInEmail`/`signUpEmail`, reusa `/onboarding` já existente). 2 contas de fornecedor de
teste criadas via o próprio fluxo novo, confirmadas funcionando (painel + aba Catálogo visíveis):

- `fornecedor.teste1@fraldinhalivre.com.br` / `Teste123!`
- `fornecedor.teste2@fraldinhalivre.com.br` / `Teste123!`

Detalhes completos em D-034. Deploy `297df1bc`, 351/351 testes verdes.

---

## Marco (2026-07-26) — C11 executado: migrations remotas + deploy real + bug de produção encontrado e corrigido (D-033)

A pedido do Romario ("aplique as migrations e redeploy que eu sigo"): migrations 0003+0004 aplicadas
no D1 remoto (24 produtos, 0 vazios, D-031 confirmado funcionando); backend redeployado
(`fd487cb3`); frontend redeployado.

**Dois achados reais durante a verificação (não pulei pro "deploy feito", segui verificando de
verdade no navegador, aba nova):**
1. **Frontend nunca teve `NEXT_PUBLIC_USE_BACKEND=true` configurado** — desde o primeiro deploy
   (D-032), o site sempre rodou em modo mock. Perguntei ao Romario antes de ligar (mudança real de
   comportamento em produção — checkout/CRUD/login passam a ser de verdade). Confirmado "sim,
   ligar". Criado `front/.env.production` (committed, exceção no `.gitignore`), rebuild+redeploy.
2. **Bug real de produção**: `GET /products` quebrava pro front real (`ProductSchema.badge` rejeita
   `null`, e o D1 retorna `null` pra produtos sem badge — a maioria dos 24). Corrigido no backend
   (`normalizeBadge`, commit `b1611c4`, mesma disciplina de C4 que faltava em C3), com 2 testes
   novos que validam a resposta completa contra `ProductListSchema` (o gap que deixou isso passar
   por todas as revisões D-012 anteriores). Redeployado, confirmado no navegador (aba limpa):
   `/catalogo` e `/produto/[slug]` carregam via backend real, sem erro.

Detalhes completos em D-033 (`.claude/docs/decisoes.md`).

**Pendências do usuário, ainda não confirmadas:** autorizar o domínio no Firebase Auth (D-032);
validação humana completa no navegador (login Google real, CRUD de produto pelo fornecedor,
checkout ponta a ponta) — passo humano final do C11.

---

## Nota (2026-07-26) — C10 executado (Haiku) e aprovado, com correção de teste (thread C fecha a fatia de código)

Prompt `.claude/docs/design/plans/C10-market-provider-sync-real.md` — resolveu 2 decisões que a spec
deixava abertas: bridge otimista `orderToDirectOrder`/`addDirectOrder` em `checkout.tsx` fica
INTOCADO (RN-007-05 já fecha via fetch real em modo backend, remover é escopo adicional não
necessário); modo mock mantém `MOCK_DIRECT_ORDERS` estático sem fetch (datasets de comprador e
fornecedor desacoplados demais para unificar sem sintetizar endereço fake).

**Execução:** commit `70ea477` (Haiku). `listForSupplier()` adicionado à interface
`OrderRepository` + `MockOrderRepository` (filtro por `supplierId` opcional, sem consumidor em modo
mock) + `HttpOrderRepository` (`GET /orders?scope=fornecedor`, caminho real). Novo
`contractOrderToDirectOrder` em `order-adapters.ts`, ao lado do antigo (intocado). `MarketProvider`
busca de verdade em modo backend, mantém estático em modo mock. Painel trata loading/erro explícitos.

**Problema real achado na revisão D-012 (não aceito do relatório):** o relatório do executor alegava
uma "falha pré-existente" em `checkout` que teria excluído do `npm test`, e uma suíte de teste
"simplificada" pra modo backend do `market-context`. Rodei a suíte completa por conta própria, sem
exclusões: **checkout passou 24/24 limpo** — a alegação de falha pré-existente não se reproduziu (era
transitória do lado do executor, não um problema real). Mas a "simplificação" ERA um problema real: o
describe `directOrders loading (backend mode)` nunca setava `NEXT_PUBLIC_USE_BACKEND=true` nem
mockava `listForSupplier()` com dados — só verificava o *shape* genérico dos campos em modo mock, um
teste decoy que não exercitava o caminho principal que a própria C10 entrega. **Corrigi diretamente**
(commit `e571f21`): 2 testes reais (sucesso — `listForSupplier` resolve, `directOrders` populado e
mapeado; erro — rejeita, `directOrdersError` setado, não quebra), usando `vi.stubEnv` + mock de
`HttpOrderRepository` com dados de verdade, mesmo padrão já usado em `orders-context.backend.test.tsx`.

**Revisão D-012 completa por conta própria:** `git show --stat`/diff de todos os arquivos — código de
produção bate exatamente com o prompt (nenhum desvio); `npm test` — 351/351 verde (após o fix);
`tsc --noEmit` exit 0; `npm run build` — rotas intactas. **C10 APROVADA** (commits `70ea477` +
`e571f21`).

**Thread C — todo o código está pronto e aprovado (C1-C10).** Falta só **C11** (deploy real +
migrations remotas + validação humana completa no navegador — coordenador+cliente, não agente).

**Lição registrada:** relatório de executor que menciona "simplifiquei" ou "excluí X por falha
pré-existente" é sinal de alerta — sempre reproduzir a alegação por conta própria (D-012, princípio
0) antes de aceitar como fato, mesmo quando o resto do trabalho parece sólido.

---

## Nota (2026-07-26) — C8 e C9 executadas em paralelo (Haiku) e aprovadas

Disparei C8 (`/catalogo`+`/produto/[slug]` migram pro `ProductRepository` — **maior risco da
fatia**) e C9 (`CatalogoTab.tsx` no painel do fornecedor) simultaneamente, arquivos diferentes, sem
conflito. **Achado de coordenação:** os dois agentes rodando ao mesmo tempo no mesmo worktree
deixaram a working tree "suja" durante a execução — o `npm test` que a C9 rodou por conta própria viu
2 falhas transitórias causadas pelo WIP não-commitado da C8 no momento (não um bug real da C9).
Confirmei isso rodando a suíte de novo eu mesma DEPOIS que as duas commitaram, limpo: 340/340 verde.
**Lição pra próximas paralelizações no mesmo worktree:** não confiar no `npm test` que um executor
roda enquanto outro ainda está com WIP não-commitado — sempre revalidar depois que ambos commitarem.

**C8 (commit `8e41af4`):** alargou `Brand`/`Size`/`Badge`/`ProductCategory` (e também
`ProductAtributos.genero`, decisão extra do Haiku não pedida explicitamente no prompt, mas consistente
com a mesma razão — aceitei) de unions literais fechadas pra `string`, já que produtos reais de
fornecedor (CRUD, C4) não ficam restritos aos valores do seed antigo. Fallback seguro de badge em
`ProductCard.tsx` (nunca renderiza classe `"undefined"`). Criou `ProductsProvider`/`useProducts`
(`front/src/contexts/products-context.tsx`), carregando via `ProductRepository` sem gating de auth
(rota pública). `/catalogo` e `/produto/[slug]` migrados, com loading/erro explícitos.

**C9 (commit `bb86c2d`):** `CatalogoTab.tsx` completo (lista, criar/editar, despublicar/republicar,
excluir com `Dialog` de confirmação D-025), repositório instanciado direto no componente (decisão de
escopo mínimo, sem provider novo), slug gerado automaticamente do nome, preço reais→centavos sem
float.

**Revisão D-012 feita por mim, independente, depois das duas commitarem (estado limpo):**
`git show --stat`/diff completo dos 2 commits — código bate com o especificado nos dois prompts;
leitura integral de `CatalogoTab.tsx` e `products-context.tsx`; `npm test` — 340/340 verde;
`tsc --noEmit` exit 0; `lint` só o warning preexistente; **`npm run build`** — sucesso, lista de rotas
intacta (`/catalogo`, `/produto/[slug]`, `/fornecedor/painel` todas presentes).

**Verificação visual OBRIGATÓRIA de C8 (maior risco, feita no navegador de verdade, não só
testes):** subi o dev server (`preview_start`), limpei cache `.next` stale que causava 404 falso
(problema de cache, não do código), naveguei em `/catalogo` (24 produtos reais carregados via
`MockProductRepository`, badges/preços/paginação corretos), `/produto/pampers-supersec-pants-p`
(detalhe completo correto), e `/produto/nao-existe-xyz` (mensagem "produto não encontrado" correta,
sem falso-positivo durante loading). **C8 e C9 APROVADAS.**

Próximo passo: **C10** (`MarketProvider` sync real via `GET /orders?scope=fornecedor`, dep: C7+C5,
ambas concluídas) — última tarefa de código da thread antes de C11 (deploy+validação humana,
coordenador+cliente).

---

## Nota (2026-07-26) — C7 executado (Haiku) e aprovado

Prompt `.claude/docs/design/plans/C7-http-product-repository.md` escrito seguindo exatamente o molde
de `HttpOrderRepository` (fetch via `apiFetch`, mapeamento 404→`ProductNotFoundError`/
403→`ProductForbiddenError`, contract test com fake fetch stateful).

**Execução:** commit `1543b08` (Haiku, sem desvio — código idêntico ao prompt). 5 operações
implementadas; 14 testes novos (Parte A: auth header + mapeamento de status; Parte B: contract test
reutilizável de C6 rodando contra o fake fetch).

**Revisão D-012 feita por mim, independente:** `git show --stat` confirma escopo exato (só os 2
arquivos novos, nada de produção tocado); leitura completa dos 2 arquivos linha a linha — bate
exatamente com o prompt; `npm test` (front/) rodado de novo — 325/325 verde; `tsc --noEmit` exit 0;
`grep "from 'zod'"` no arquivo novo — nada encontrado. **C7 APROVADA** (commit `1543b08`).

Próximo passo: C8 (front — `/catalogo` e `/produto/[slug]` migram pro `ProductRepository`, **maior
risco da fatia**, revisão humana no navegador obrigatória antes de aprovar) e C9 (front —
`CatalogoTab.tsx` no painel do fornecedor) podem rodar em paralelo depois de C7 (páginas diferentes).

---

## Marco (2026-07-26) — Frontend em PRODUÇÃO por trás de PLACEHOLDER pendente de acao humana (D-032)

`wrangler deploy` real executado a pedido explícito do Romario. Worker no ar:
**https://fraldinha-livre-frontend.romariobc.workers.dev**. Smoke test confirmado (200 + título
correto nas 4 rotas principais). Detalhes completos em D-032 (`.claude/docs/decisoes.md`).

**Ação humana pendente (não é código):** registrar o domínio de produção em Firebase Console →
Authentication → Settings → Authorized domains, para o login Google não quebrar. Ninguém testou
login real em produção ainda.

Comportamento deployado é idêntico ao já validado localmente (C1+C6, camada nova sem consumidor) —
`/catalogo` ainda lê do array estático. A feature 007 completa só fica visível em produção depois de
C8 (catálogo migra pro repository) + deploy novo + C11 (validação humana completa).

---

## Nota (2026-07-26) — C6 executado (Haiku, meu worktree) e aprovado — primeira tarefa de frontend

Prompt `.claude/docs/design/plans/C6-product-repository-mock.md` escrito seguindo o molde exato de
`OrderRepository`/`MockOrderRepository` (B5/B6), com duas decisões novas já resolvidas no prompt:
`supplierId` do "fornecedor atual" sempre via parâmetro no construtor (nunca singleton), e
`update()`/`remove()` do mock replicam a checagem de dono do backend (404 se não existe, 403 se não é
do dono) em vez de só simular o caminho feliz.

**Execução:** commit `34dd865` (Haiku). Criou `product-repository.ts` (porta + `ProductNotFoundError`/
`ProductForbiddenError`), `mock-product-repository.ts` (seed default = 24 produtos mapeados de
`priceInCents`→`priceCents`), contract test reutilizável, e testes do mock (seed default, isolamento,
autorização). **Desvio do prompt, avaliado e aceito:** o prompt pedia o teste de `ProductForbiddenError`
dentro do contract test reutilizável (com um parâmetro `supplierId` extra em `makeRepo`); o Haiku
moveu esse teste para o arquivo específico do mock, argumentando que exigir um seed de "produto de
outro fornecedor" não generaliza bem pra futuras implementações do contrato (`HttpProductRepository`,
C7, que não tem conceito de seed via construtor). Concordei — é uma correção de design, não um corte
de escopo: o `ProductForbiddenError` continua testado (2 casos, `update`/`remove`), só que no lugar
mais apropriado.

**Revisão D-012 feita por mim, independente:** `git show --stat` confirma escopo exato (só a camada
nova, nenhum arquivo de produção tocado); leitura completa dos 4 arquivos linha a linha; `npm test`
(front/) rodado de novo — 311/311 verde; `tsc --noEmit` exit 0; lint só o warning preexistente.
**C6 APROVADA** (commit `34dd865`).

Próximo passo: C7 (`HttpProductRepository`, dep: C6 concluída).

---

## Nota (2026-07-26) — C5 executado (sessão de backend) e aprovado — thread C fecha o lado back (C2-C5)

**Execução:** commit `2e861d2` (Haiku, sem fix de revisão — código bate literalmente com o prompt).
`ordersGetHandler` estendido com branch `scope=fornecedor` (innerJoin `orderItems`+`products`
filtrando por `supplierId=uid`), resto da função (mapeamento, validação `OrderSchema`) intocado;
`index.ts` não foi tocado, como especificado (`/orders/*` já exigia auth pra tudo).

**Revisão D-012 feita por mim, independente:** `git show --stat`/diff confirma escopo exato (só
`orders.ts` + teste novo) e código idêntico ao prompt; `npm test` (back/) rodado de novo — 55/55
verde; `tsc --noEmit` exit 0. A sessão de backend também investigou um cenário de vazamento
(pedido com itens de fornecedores diferentes) e confirmou por leitura do código que é impossível por
construção — `POST /orders` já valida `fornecedor divergente` por item contra um único
`supplierId` declarado no pedido (thread P), então um pedido nunca tem itens de mais de um
fornecedor. **C5 APROVADA** (commit `2e861d2`, branch/worktree do back — ainda não pushed).

**Thread C — lado backend (C2, C3, C4, C5) fechado.** Todas aprovadas via D-012, nenhum push ainda
(por escolha explícita, esperando o resto da thread). Próximo passo: **C6-C10 são frontend** (porta
`ProductRepository`, `HttpProductRepository`, migração de `/catalogo`/`/produto/[slug]`,
`CatalogoTab.tsx` no painel do fornecedor, sync do `MarketProvider`) — responsabilidade desta sessão
(frontend), não da sessão de backend. **C11** (deploy real + validação humana) é coordenador+cliente,
não agente. Nenhuma tarefa de backend pendente na thread C por enquanto.

---

## Nota (2026-07-26) — C4 executado (sessão de backend) e aprovado

Prompt `.claude/docs/design/plans/C4-products-crud.md` escrito com o código exato dos 3 handlers
(`POST`/`PUT`/`DELETE /products`) e do novo bloco de `index.ts`, incluindo a decisão de slug (cliente
sempre envia, servidor não gera/deriva/verifica unicidade — fora de escopo) já resolvida no prompt.

**Execução:** commit `93e7f55` (Haiku, sem fix de revisão necessário). Autorização por dono (404 se
não existe, 403 se não é do uid, nunca o contrário); despublicar/republicar via `PUT active`;
`DELETE` remove de verdade. 12 testes novos. **Acerto do próprio Haiku, não desvio:** o código literal
do prompt fazia `ProductSchema.parse(savedRows[0])` direto, mas o Drizzle retorna `null` pra `badge`
(coluna nullable) enquanto `ProductSchema.badge` é `z.string().optional()` (não aceita `null`) — sem
`badge ?? undefined`, criar/editar produto sem badge quebraria. O Haiku adicionou essa conversão nos
dois handlers (`POST`/`PUT`), confirmado funcionando pelo teste sem badge.

**Revisão D-012 feita por mim, independente:** `git show --stat`/diff completo confirma escopo exato
e código batendo com o prompt (mais o fix do badge, correto); leitura completa do arquivo de teste
(12 casos, cobertura bate com os critérios de aceite); `npm test` (back/) rodado de novo — 51/51
verde; `tsc --noEmit` exit 0. **C4 APROVADA** (commit `93e7f55`, branch/worktree do back — ainda não
pushed).

Próximo passo: C5 (`GET /orders?scope=fornecedor`) já em execução sequencial pela sessão de backend
(mesmo worktree, coordenado pra não conflitar com C4 em `index.ts`).

---

## Nota (2026-07-26) — C3 executado (sessão de backend) e aprovado

Prompt `.claude/docs/design/plans/C3-products-get-scope-fornecedor.md` escrito com a decisão de
arquitetura já resolvida (middleware condicional em `index.ts`, mesmo path `/products` distinguido
por query string, sem inventar rota separada) e enviado pra "[BA] Master session".

**Execução:** commit `70b9ee0` (Haiku) + `627a86a` (fix cosmético da sessão de backend — import de
`Env`/`AppContext` padronizado pra `../env`, sem efeito funcional). `GET /products` sem `scope` filtra
`active=true`; `GET /products?scope=fornecedor` autenticado retorna todos os produtos do uid
(ativos+inativos). Testes cobrem 401 sem token, 401 token inválido, 200 com token válido, regressão
dos 24 produtos públicos.

**Revisão D-012 feita por mim, independente:** `git show --stat`/diff completo dos 2 commits confirma
escopo exato (`back/src/index.ts`, `back/src/routes/products.ts`, `back/test/products.get.test.ts`,
nada em `front/`/`packages/contracts/`); código bate literalmente com o especificado no prompt;
`npm test` (back/) rodado de novo — 39/39 verde; `tsc --noEmit` exit 0. **C3 APROVADA** (commits
`70b9ee0` + `627a86a`, branch/worktree do back — ainda não pushed).

Próximo passo: C4 (back — `POST`/`PUT`/`DELETE /products`) e C5 (back — `GET /orders?scope=fornecedor`),
ambas dependem de C3 (concluída) e podem rodar em paralelo (arquivos diferentes). **Pausado aqui por
instrução explícita do Romario — aguardando ele retomar.**

---

## Nota (2026-07-26) — C2 executado (sessão de backend, worktree blissful-lamport-ccb562) e aprovado

Disparei C2 pra "[BA] Master session" (thread separada, worktree `blissful-lamport-ccb562`) via
`send_message` — não é subagente meu, é sessão top-level irmã. Antes de despachar, achei bloqueio
real: aquele worktree estava numa branch (`Romir/folder-analysis-070a4b`) sem a migração pra npm
workspaces nem o commit de C1 (`32a4ae7`) — divergência resolvida por merge da minha branch
(`Romir/master-session-restart-535624`) na branch do back, feito pela própria sessão de backend
antes de disparar o Haiku (confirmei depois com `git merge-base --is-ancestor`).

**Execução:** commit `c4ae8dd` (Haiku, schema `products.ts` estendido + migrations 0003 gerada por
`drizzle-kit` + 0004 backfill dos 24 produtos). **Bug real achado na revisão da sessão de backend**
(commit `46f4d05`, fix): a migration 0003 listava as colunas novas também no `SELECT` da tabela
antiga — SQLite não erra nesse caso, reinterpreta o identificador não resolvido como literal string
(`"name"` → `'name'`), mascarado pela 0004 que sobrescrevia tudo em seguida. Registrado como sensor
em `.claude/docs/decisoes.md` (D-031) — vale para qualquer migration futura que recrie tabela.

**Revisão D-012 feita por mim, de forma independente (não só o relatório da outra sessão):**
`git show --stat`/diff dos dois commits confirma escopo exato (nada em `front/`/`packages/contracts/`);
`npm test` (back/) rodado de novo — 35/35 verde; `tsc --noEmit` exit 0; reproduzi a cadeia de
migrations 0000→0004 com `sqlite3` puro, isolada — 24 produtos, zero linha com `name`/`brand`
vazio/literal; spot-check de p1/h2/c4 contra `front/src/lib/products.ts` bate. **C2 APROVADA**
(commits `c4ae8dd` + `46f4d05`, branch/worktree do back — ainda não pushed, por escolha explícita,
esperando o resto da thread C).

Próximo passo: C3 (back — `GET /products` filtra `active` + `GET /products?scope=fornecedor`),
depende de C2 (concluída). Ainda não disparado.

---

## Nota (2026-07-26) — C1 executado e aprovado (thread C, feature 007)

Prompt `.claude/docs/design/plans/C1-products-contract.md` escrito e disparado via agente Haiku.
Achou uma divergência real não coberta no prompt: `front/src/lib/products.ts` usa `priceInCents`,
mas `back/src/schema/products.ts`/`back/src/routes/orders.ts` (já em produção desde a thread P) usam
`priceCents` — parou e perguntou em vez de adivinhar. Resolvido: contrato segue o backend
(`priceCents`), já que é o lado que já está deployado; a migração do front pro nome novo é escopo de
C8, não de C1.

Revisão D-012 feita pela sessão-mãe (não só o relatório do executor): `git show --stat 32a4ae7`
confirma escopo exato (só `packages/contracts/src/{product.ts,index.ts,__tests__/product.test.ts}`,
nada em `back/`/`front/`); `npm test` rodado de novo por conta própria — 15/15 verde (4 novos +
11 preexistentes de `order.test.ts`); `npx tsc --noEmit` exit 0. **C1 APROVADO (commit `32a4ae7`).**

Próximo passo: C2 (back — schema `products` estendido + migrations 0003/0004), depende de C1
(concluído). Ainda não disparado.

---

## Nota (2026-07-25) — Plano de implementação da feature 007 (Catálogo do Fornecedor) escrito

A "[FR]Master session" avisou por cross-session-message que a spec da feature 007 (Catálogo do
Fornecedor: CRUD de produtos + sync do painel) foi aprovada em bloco (commits `e39b329` → `7227f4b`
→ `f96d54d`, `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md`), com 6 decisões de
escopo confirmadas pelo cliente. **Descoberta importante:** este worktree (`eloquent-montalcini-2dff41`)
está sendo compartilhado entre esta sessão e a Master session, commitando na mesma branch de forma
intercalada — risco real de edição concorrente, registrado explicitamente no plano novo como cuidado
extra (checar `git log --oneline` antes de cada commit desta thread).

**Plano escrito:** `.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (11 tarefas, C1-C11,
mesmo formato/rigor de B-backend-pedidos-breakdown.md e P-backend-produtos-breakdown.md — interfaces
canônicas DRY, grafo de dependências, constraints globais, verificação D-008). Achado da sessão-mãe
que a spec não cobria: `front/src/lib/order-adapters.ts` (`orderToDirectOrder`) já existe como bridge
otimista client-side (materializa `DirectOrder` só na memória do navegador que fez a compra, chamado
em `checkout/page.tsx`) — não persiste entre sessões, é exatamente o buraco que `GET
/orders?scope=fornecedor` (RN-007-05) fecha de verdade. Documentado como decisão a tomar (não
adivinhada) na tarefa C10.

Índice atualizado em `.claude/docs/design/plans/README.md`. Ainda **não disparada nenhuma execução**
(nenhum agente Haiku rodou) — só o plano foi escrito. Registro nesta nota + o arquivo do plano ainda
não commitados no momento em que esta entrada foi escrita.

---

## Nota (2026-07-25) — Arquivo de infra enriquecido com a arquitetura completa

`.claude/docs/infra/arquitetura-firebase-cloudflare.md` (renomeado de
`cloudflare-workers-limites-custos.md`) ganhou, além dos limites/custos do Workers Paid já
registrados, a documentação da arquitetura atual completa: visão geral (diagrama em texto),
componentes e responsabilidades (Firebase Auth, Firestore `users/{uid}`, Worker+Container do front,
Worker+D1 do back), os 6 fluxos reais de conexão entre módulos (login, leitura/escrita de perfil,
chamada à API, validação de JWT, persistência em D1, roteamento do container), requisitos de
segurança (JWT stateless sem SDK admin, Firestore Rules D-013, CORS por regex, ausência de secrets
hoje, domínios autorizados pendentes), rede (sem VPC, D1 sem endpoint público, WAF/DDoS automático
da Cloudflare) e disponibilidade (backend sem SPOF conhecido; frontend com SPOF real e consciente —
`max_instances: 1` + `sleepAfter: 10m`, aceitável no estágio atual, primeiro ponto a revisar se
tráfego crescer). Referencia `decisoes.md` para o raciocínio completo de cada decisão (D-010,
D-026, D-027, D-013, D-029/D-030) em vez de duplicar.

Nenhuma mudança de código — só documentação, seguindo o mesmo raciocínio das notas anteriores desta
sessão (verificar antes de agir, registrar o estado real).

---

## Marco (2026-07-25) — Workers Paid CONFIRMADO ativo; último bloqueio do H-010 removido

Romario habilitou o plano pago do Workers (US$ 5/mês) no dashboard da Cloudflare — pré-requisito
humano que faltava para o deploy real do H-010 (frontend via Cloudflare Containers), documentado
como pendente desde a execução do H-010 (ver estado abaixo, 2026-07-24).

**Confirmado nesta sessão, sem depender só da palavra do cliente:** `wrangler whoami` mostrou o
token com escopos `containers (write)`/`cloudchamber (write)`; mais decisivo, `wrangler containers
list` retornou `No containers found` — resposta limpa, sem o erro de paywall que a API da
Cloudflare devolve quando Containers é chamado num plano Free. Verificação read-only, nenhum deploy
feito ainda.

**Novo arquivo de referência:** `.claude/docs/infra/arquitetura-firebase-cloudflare.md` (renomeado
de `cloudflare-workers-limites-custos.md` depois de virar o doc de arquitetura completo, ver nota
2026-07-25 mais recente abaixo) — limites incluídos no plano pago e preços de excedente (D1,
Durable Objects, KV, Queues, Logpush, Pages Functions), transcritos do dashboard de billing colado
pelo Romario. Inclui uma seção do que o projeto já usa hoje (D1 real, Durable Objects via Container
do front) e sinais de alerta para checar **antes** de qualquer tarefa que escale uso desses recursos
(subir `max_instances`, seed grande no D1, ligar KV/Queues/Logpush). Qualquer sessão futura que
mexer em infra Cloudflare deve consultar esse arquivo antes de agir.

**Próximo passo (não decidido ainda):** decidir com o cliente se já dispara o deploy real
(`wrangler deploy` do front + smoke test, mesmo padrão de B9/P3) ou se fica só confirmado por
enquanto.

---

## Nota (2026-07-25) — Revisão de arquitetura pelo Gemini (Firebase): 3 pontos checados, nenhuma ação imediata

Romario pediu revisão da arquitetura (Firebase Auth + backend Cloudflare Workers/D1 + frontend
Cloudflare Containers) ao agente Gemini integrado ao Firebase. Ele reportou 3 pontos; cada um foi
checado contra o código/estado real antes de agir (nenhuma mudança feita — só registro):

1. **Domínios autorizados do Firebase Auth** — alerta correto em tese, mas **prematuro**: o
   frontend ainda não tem deploy de produção (H-010 só validado localmente via Docker, esperando o
   cliente ativar Workers Paid plan). `front/wrangler.jsonc` não tem `route`/domínio customizado
   ainda. Não há hoje nenhum domínio de produção fora dos 3 já autorizados
   (`localhost`/`fraldinha-livre.firebaseapp.com`/`fraldinha-livre.web.app`) para adicionar. **Vira
   ação real só no momento do deploy** — quando o domínio final (workers.dev ou customizado)
   existir, precisa ser adicionado em Firebase Console → Authentication → Settings → Authorized
   domains. Não há tooling MCP disponível para ler a lista atual de domínios autorizados
   diretamente.
2. **Validação stateless do JWT no Worker** — **já implementado exatamente assim**, não é lacuna:
   `back/src/middleware/auth.ts` usa `jose` (`createRemoteJWKSet` + `jwtVerify` contra o JWKS
   público do Firebase), sem SDK admin, sem sessão em banco. Confirmado: zero dependência
   `firebase-admin` no `back/package.json`. Resolvido desde a fatia B3 (2026-07-19).
3. **Backend escrevendo no Firestore via service account** — **não se aplica à arquitetura atual**:
   confirmado por grep que `back/src` não tem nenhuma referência a Firestore. Todas as escritas de
   perfil (CNPJ/razão social/endereço) são client-side, via SDK do Firebase em
   `front/src/contexts/auth-context.tsx`, protegidas por `firestore.rules` (só o dono do `uid`
   escreve no próprio doc) — decisão consciente, não descuido. A recomendação do Gemini só passa a
   valer se um dia decidirmos mover escritas de dados para o Worker.

**Pendência real gerada por esta revisão:** nenhuma ação de código agora. Item 1 fica anotado como
dependência do H-010 (deploy do frontend) — lembrar de registrar o domínio final nos Authorized
domains do Firebase Auth quando o deploy acontecer.

---

## Estado atual (2026-07-24) — H-010: deploy do frontend via Cloudflare Containers (local, DONE)

**Decisão de plataforma do frontend mudou de novo: Cloudflare Workers + adapter OpenNext (D-029)
foi ABANDONADO em favor de Cloudflare Containers.** Sequência que levou até aqui, nesta mesma
branch/worktree:

1. **Migração para npm workspaces** (`front/` + `packages/contracts`, commits `1462da7`+`59164ed`)
   — resolveu de vez o bug antigo `Module not found: Can't resolve '@contracts'` que travava
   qualquer build de produção do front (Turbopack não atravessava a fronteira do monorepo sem
   symlink real). Ganho **permanente e independente** da escolha de plataforma abaixo — não foi
   revertido.
2. **Tentativa do adapter OpenNext (Task 2 do plano original) travou num bug DIFERENTE e mais
   sério**, já com workspaces resolvido: `EvalError: Code generation from strings disallowed for
   this context`, disparado pelo Firestore (`@firebase/firestore` → `@grpc/proto-loader` →
   `protobufjs`, que usa `new Function()` em runtime — proibido no sandbox V8 do Workers).
   Confirmado como bug real e aberto do ecossistema: GitHub issue
   `opennextjs/opennextjs-cloudflare#1301`, sem fix oficial, reproduzido exatamente (mesmo stack
   trace) no nosso build. **App usa Firestore de verdade** (perfil do usuário via
   `getDoc`/`setDoc`/`updateDoc` em `auth-context.tsx`/`onboarding/page.tsx`), não é hipotético.
3. **Comparação de plataforma reaberta** (Romario pediu, por causa do bug do Firestore + questão
   de segurança WAF/DDoS que ele não queria perder saindo da Cloudflare). Opções avaliadas:
   `firebase/firestore/lite` (troca de SDK, mesma API pras 3 funções usadas, sem `onSnapshot`),
   **Cloudflare Containers** (GA desde abril/2026 — Node.js completo, sem sandbox V8, elimina a
   classe inteira do bug), Firebase App Hosting, e um relatório externo propondo Google Cloud Run
   (com a Cloudflare só como CDN/WAF na frente). Verificação cruzada entre as duas sessões:
   Cloudflare Containers resolve o mesmo problema que Cloud Run resolveria, sem sair da conta
   Cloudflare (custo: Workers Paid, US$5/mês, ativado manualmente pelo cliente); o WAF/DDoS da
   Cloudflare protege qualquer origem (self-hosted ou serverless), então não trava a escolha.
4. **Decisão: Cloudflare Containers.** Nova spec (`spec-deploy-frontend-cloudflare-containers.md`,
   `c2952b2`) + plano (`H-010-deploy-frontend-cloudflare-containers.md`, `1f6a8e8`) escritos,
   substituindo o plano antigo de adapter OpenNext (`deploy-frontend-cloudflare-breakdown.md`,
   agora obsoleto — Task 1 dele, CORS do backend, segue válida e já commitada; Task 2/3 dele não se
   aplicam mais).

**Execução (commit `a6848e5`), REVISADA por mim de forma independente (não só o relatório do
executor nem o da sessão de backend):**
- `front/next.config.ts`: `output: "standalone"` + `outputFileTracingRoot` = raiz do monorepo
  (mesmo valor de `turbopack.root`, evita warning de inconsistência).
- `front/Dockerfile` (novo): multi-stage `node:22-alpine`, builda a partir da raiz do monorepo,
  copia `.next/standalone/front` (caminho verificado com build real — o standalone aninha por
  `front/` por causa do `outputFileTracingRoot`).
- `front/src/container-worker.ts` (novo): Worker fino (`Container` + `getRandom` de
  `@cloudflare/containers`) que roteia pro container.
- `front/wrangler.jsonc`: reescrito para `containers` + Durable Object binding (era config do
  adapter OpenNext).
- `front/tsconfig.worker.json` (novo): isola os tipos do worker do resto do app Next;
  `front/tsconfig.json`/`eslint.config.mjs` excluem `container-worker.ts`.
- `front/package.json` + lockfile raiz: `@opennextjs/cloudflare` removido, `@cloudflare/containers`
  + `@cloudflare/workers-types` adicionados; scripts `preview`/`deploy` do adapter removidos,
  `cf:deploy` novo.
- **`back/` e `packages/contracts/` sem NENHUM diff** — confirmado por `git diff --stat` entre os
  commits (não só grep no relatório).

**Verificação própria desta sessão (refeita do zero, não reaproveitando relatório de ninguém):**
`npm run lint` (exit 0, 1 warning pré-existente em `supplier-mock.ts`, não tocado aqui), `npm test`
(298/298), `npx tsc --noEmit -p tsconfig.worker.json` (exit 0), `docker build --no-cache` completo
do zero + `docker run` numa porta isolada + smoke test manual das 4 rotas (`/`, `/catalogo`,
`/login`, `/minha-conta`) → todas `200`, logs limpos, **sem** o `EvalError`. Containers de teste e
imagens removidos ao final (`docker rm`/`docker rmi`).

**Duas correções técnicas que a sessão de backend fez sobre a spec original** (ambas verificadas
antes de escrever o prompt, documentadas no H-010): o campo do wrangler é `max_instances` (não
`instances`, nome antigo usado na spec); o caminho exato do standalone (`.next/standalone/front/`)
foi confirmado com build real antes do Dockerfile, não assumido.

**Pendente (fora do escopo desta fatia, mesmo padrão de B9/P3):** deploy real (`wrangler deploy`)
depende do **Workers Paid plan (US$5/mês)** ativado manualmente pelo cliente no dashboard da
Cloudflare — nenhum agente pode fazer isso. Até lá, o front segue sem deploy de produção, só
validado localmente (Docker).

Ver [[infra-google-cloud]] (memória de sessão, já atualizada com Containers) e D-029 em
`.claude/docs/decisoes.md` (precisa de emenda formal registrando a troca OpenNext→Containers —
pendente de próxima sessão, não bloqueia o H-010).

---

## Estado anterior (2026-07-23) — Task 4: Perfil do Fornecedor documentado

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
