# Log de Decisoes — Fraldinha Livre

> Registro cronologico de decisoes de arquitetura, infra e processo.
> Formato: D-NNN | data | decisao | status (vigente / superada / aguardando aprovacao).
> Este arquivo e a fonte de verdade quando docs antigos divergirem.

---

## D-001 — Infra 100% Google Cloud (2026-07-02) — VIGENTE

Toda a infraestrutura do projeto (hosting, banco, auth, storage, filas) sera **Google Cloud**, priorizando tier gratuito e serverless (Cloud Run, Firestore, Cloud Storage, Firebase Auth/Identity Platform).

- **Vercel descartada** — nao usar para nada (deploy, analytics, edge functions).
- **Azure descartada** — o plano `plan-session01.md` (maio/2026, Container Apps + SQL Serverless + AD B2C + Service Bus) esta SUPERADO e deve ser removido.
- Qualquer mencao a Vercel/Azure em docs ativos deve ser excluida (tarefa H-001). `legacy/` e historico e nao sera tocado.

## D-002 — Specs dentro do repo, backup no harness (2026-07-02) — VIGENTE

Specs de design ficam em `.claude/docs/design/specs/` (neste repo) e sao a referencia obrigatoria do spec-driven development. Copia de backup mantida no harness de referencia (`dev_flow_create_harness`). Planos/prompts de implementacao ficam em `.claude/docs/design/plans/`.

## D-003 — Feature 004: divergencia critério (5 tabs) vs produto (3 tabs) (2026-07-02) — SUPERADA POR D-007

O painel do fornecedor foi redesenhado para 3 tabs (Pedidos Diretos, Ofertas de Mercado, Logistica) + pagina dedicada `/mercado`, mas o criterio de aceite da 004 ainda exigia 5 tabs. Resolucao absorvida pela estrategia em duas fases (D-007): criterio da 004 atualizado para o produto real; codigo morto (MinhasOfertasTab, HistoricoTab e PerfilTab do fornecedor, OfertaCard, rota orfa `/perfil`) sera removido na feature 013 (gating do leilao); Perfil/Historico do fornecedor voltam na feature 007 com spec propria.

## D-004 — Historico git mantido como esta (2026-07-02) — VIGENTE

Os ~15 commits com mensagem identica ("refactor: remove public/ raiz...") sao inofensivos; reescrever historico e destrutivo e desnecessario. Daqui em diante: Conventional Commits em pt-BR, uma mensagem descritiva por commit. README sera reescrito (H-001).

## D-005 — Caminho canonico e estrutura do monorepo (2026-07-02) — VIGENTE

Caminho do projeto: `E:\Labdev\Projetos\fraldinha-livre`. Estrutura:

- `front/` — aplicacao web Next.js (existente)
- `back/`  — backend a implementar (feature 006)
- `app/`   — futuro aplicativo mobile
- `legacy/` — prototipo antigo, somente historico

Docs que referenciem o caminho antigo (`E:\ROMARIO PC\fraldinha-livre`) devem ser corrigidos (H-001).

## D-006 — Papeis das sessoes (2026-07-02) — VIGENTE

- **Sessao-mae (Opus/Fable, esta):** planeja, documenta, escreve specs e prompts, revisa e aprova entregas. **Nao codifica.**
- **Sessoes Haiku:** executam exatamente o que o prompt em `.claude/docs/design/plans/` pede, relatam o que foi feito.
- Toda entrega Haiku so e considerada completa apos revisao aprovada na sessao-mae.
- Cada sessao significativa e documentada em `chatsessions/` e o estado em `.claude/context/estado/` e atualizado antes de encerrar.

## D-007 — Desenvolvimento em duas fases: Marketplace primeiro, Leilao depois (2026-07-02) — VIGENTE

A operacao e quebrada em duas partes:

- **Fase 1 — MARKETPLACE (loja):** catalogo, compra direta, contas (comprador e fornecedor), auth, backend da loja, pagamento. Todos os botoes, informacoes, links e interacoes da feature de leilao reverso ficam **VISIVEIS POREM INATIVOS** (estado "Em breve", flag central unica), para validar a loja antes do leilao e ja mapear exatamente o que sera plugado/reativado.
- **Fase 2 — MERCADO (leilao reverso):** toda a logica de licitacao (fila, prazos, concorrencia, ofertas, aceite) implementada plugando nos pontos ja marcados na Fase 1.

Consequencias: features do feature_list.json ganham campo `fase`; os 4 bugs de dinheiro do review de 2026-07-02 (parsePriceToCents, "Melhor preco" por indice, entrega por escopo de visualizacao, aceite sem fornecedor) estao todos em fluxos de leilao e serao corrigidos na Fase 2 junto com as specs do leilao; bugs de loja (catalogo ?page, busca "todos", Header IS_LOGGED_IN, hydration dos mocks) entram na Fase 1.

## D-008 — Testes obrigatorios com loop de encerramento nos prompts Haiku (2026-07-02) — VIGENTE

Todo prompt para sessao Haiku DEVE incluir uma secao de testes/verificacao executada ANTES do relatorio final:

1. Rodar as verificacoes especificadas no prompt (lint, build, greps, criterios de aceite).
2. Se algo falhar: corrigir e re-verificar — **maximo 3 tentativas**.
3. Apos a 3a tentativa sem sucesso: **PARAR** (nao continuar tentando, nao improvisar) e relatar o que falhou, o que foi tentado e o estado em que o codigo ficou.

Template padrao em `.claude/docs/design/plans/README.md`.

## D-009 — Modelo da compra direta no catalogo (2026-07-02) — DECIDIDA: MODELO A (multi-vendedor)

Constatacao: o catalogo atual so tem o CTA "Pedir oferta" (leilao). Nao existe fluxo de compra direta do comprador na UI — pedidos `compra-direta` existem apenas nos mocks.

**Decisao do cliente (2026-07-02): Modelo A — loja multi-vendedor.** Cada produto do catalogo pertence a um fornecedor especifico, com preco proprio definido por ele. Consequencias:

- O contrato de `Product` ganha vinculo obrigatorio com fornecedor (`supplierId` + dados de exibicao).
- O catalogo pode ter o "mesmo" produto ofertado por fornecedores diferentes (cards distintos).
- Padronizar preco em CENTAVOS ja na Fase 1 (products.ts hoje usa reais — divergente do resto do sistema).
- Spec da feature 014: `.claude/docs/design/specs/spec-catalogo-compra-direta.md`.

## D-012 — Checklist de revisao pre-aprovacao obrigatorio (2026-07-02) — VIGENTE

Toda entrega de sessao Haiku passa pelo `.claude/docs/review-checklist.md` ANTES de a sessao-mae
declarar "aprovado". Nunca aprovar so pelo relatorio do executor.

**Why:** em 2026-07-02 o H-002 foi aprovado com base no relatorio (que afirmava remover 6 arquivos
de codigo morto — RN-06), mas o commit nao tinha nenhuma delecao. So foi pego na verificacao
pre-main (`npm run build` ainda listava a rota /perfil). Causa-raiz: revisao baseada em relatorio +
diff dos arquivos modificados, sem `git show --stat` (que teria mostrado a ausencia de delecoes) e
sem rodar build/lint na propria sessao-mae.

**How to apply (resumo — detalhe no review-checklist.md):**
1. `git show --stat <hash>` — confirmar Added/Modified/**DELETED** reais; delecoes prometidas TEM
   que aparecer como `delete mode`.
2. Rodar `npm run build` (conferir a lista de rotas) e `npm run lint` (exit 0) na sessao-mae.
3. Conferir cada criterio de aceite com evidencia propria (grep + `ls` + `delete mode`, nao so grep).
4. Ler o diff dos arquivos-nucleo; checar regressao das features ja aprovadas.
5. Registrar o veredito no chatsession com a evidencia.

Complementa D-006 (papeis) e D-008 (testes do Haiku). O D-008 e o auto-teste do executor; o D-012 e
a verificacao independente do revisor — os dois sao necessarios porque o executor pode relatar algo
que o commit nao contem.

## D-013 — Endurecimento do modelo de auth (role imutavel + sanitizacao de redirect) (2026-07-03) — VIGENTE

Security-review do fluxo de auth/usuario (2026-07-03) achou 2 questoes, incorporadas a spec da
feature 007a (area do cliente):

1. **role auto-gravavel (Medium):** a regra do Firestore permitia o usuario escrever o proprio doc
   `users/{uid}` inteiro, inclusive `role` — auto-escalonamento quando o backend gatear dados reais
   por papel. Correcao: `updateProfile` no cliente NUNCA grava `role`; regra do Firestore torna
   `role` imutavel apos definido (`allow update ... request.resource.data.role == resource.data.role`;
   `allow delete: if false`). Ver RN-03/RN-04 da spec-area-cliente-perfil.
2. **open redirect (Low-Medium):** `redirect` pos-login ia direto para `router.push` sem validar
   ser caminho relativo do site. Correcao: util unico `safeRedirect` (so aceita path iniciando com
   `/`, nao `//`, sem `:`), usado no login e na trava de compra. Ver RN-07.

**Why:** e o momento certo — a feature 007a mexe justamente nas escritas de `users/{uid}` e cria a
trava de compra que tambem redireciona. Fechar o modelo de auth antes do backend 006 evita retrabalho.

**How to apply:** ambas as correcoes sao criterio de aceite da 007a. Regra do Firestore versionada
em `firestore.rules` + deploy.

## D-014 — Leilao reverso como MICROSERVICO anexo, reusavel; gate de marketplace completo+testado (2026-07-03) — VIGENTE

Decisao de negocio do cliente (2026-07-03), refinando a D-007:

1. **O leilao reverso NAO e um modulo interno do marketplace.** Sera construido como um
   **microservico standalone**, com API propria, projetado para ser **consumido pelo marketplace
   Fraldinha Livre E por outros produtos** (reusavel — o leilao e um produto em si).
2. **O marketplace consome o leilao via contrato/API** (nao acoplado ao codigo do marketplace). Os
   pontos gateados hoje (feature 013, "Em breve") sao os pontos de integracao que, no futuro, o
   marketplace vai plugar no microservico. A flag `LEILAO_ATIVO` passa a significar "microservico de
   leilao disponivel e plugado".
3. **GATE (ordem obrigatoria):** so evoluir para o leilao DEPOIS que **TODO o marketplace (front E
   back) estiver OK e TESTADO** — incluindo testes de **seguranca, usabilidade, stress** e afins.
   O leilao e a ultima fronteira, nao paralela ao marketplace.

**Impacto no roadmap:**
- A "Fase 2" da D-007 deixa de ser uma fase interna e vira um **produto/microservico separado**
  (leilao), gated atras do marketplace 100% pronto e testado.
- Features antes em fase 2 (008 leilao, 009 pedidos preferenciais, 010 notificacoes do leilao, 012
  admin de disputas) passam a pertencer ao escopo do microservico de leilao / integracao — nao entram
  antes do gate.
- Novo criterio de "marketplace pronto para o leilao": front completo + back (006) completo +
  bateria de testes (seguranca, usabilidade, stress, carga, e2e). Enquanto isso, o leilao segue
  visivel-porem-inativo (013).

**Why:** o cliente quer o leilao como ativo reusavel (outro produto pode consumi-lo) e quer a base
(marketplace) solida e testada antes de investir na logica concorrente/critica do leilao.

**How to apply:** nao redigir specs/prompts de logica de leilao ate o gate. Ao especificar o back
do marketplace (006), desenhar o ponto de integracao com o leilao como uma dependencia externa (API),
nao como codigo interno. Relacionado a D-007 (que fica refinada por esta).

## D-015 — GitHub Spec Kit: manter parado, pilotar no back/leilao (2026-07-03) — VIGENTE

Analise do Spec Kit (0.12.3, instalado untracked na main) nos 4 eixos: produtividade (empate, com
custo de troca contra), assertividade (empate; nosso D-012 e sob medida e comprovado), escalabilidade
(Spec Kit ganha — padrao agnostico, relevante para D-014 multi-produto), usabilidade (leve vantagem
+ valor de aprendizado para o Romario). Constatacoes: a constitution instalada esta EM BRANCO
(placeholders) e o install esta wired para **Copilot** (`ai: copilot`), nao Claude.

**Decisao do cliente (2026-07-03): manter parado; pilotar no backend (006) ou no microservico de
leilao (D-014); NAO adotar no meio da Fase 1 do marketplace.**

**How to apply:**
- Nao migrar a governanca atual (decisoes/specs/plans/D-012) para o Spec Kit agora — ela funciona e
  o Spec Kit apenas a espelha. Continuar no fluxo bespoke ate o fim do marketplace.
- Quando iniciar o back 006 ou o leilao (produto novo, greenfield): reinstalar/reconfigurar o Spec
  Kit com `--ai claude`, preencher a constitution com D-001..D-015, e testar de verdade (comandos
  /specify /plan /tasks /analyze). So entao decidir adocao plena.
- O leilao (D-014) e provavelmente um repo/microservico separado — o piloto do Spec Kit vai la, nao
  na main do marketplace.
- Os arquivos do Spec Kit na main (`.specify/`, `.github/agents+prompts/speckit.*`) ficam parados;
  nao bloqueiam o merge do nosso branch (nao colidem com paths do branch).

**Limpeza relacionada:** `front/src/app/api/auth/[...nextauth]/route.ts` e
`front/src/providers/NextAuthProvider.tsx` sao restos MORTOS do NextAuth (abordagem abandonada na
D-010 -> Firebase); serao DELETADOS da main (nao tem relacao com Spec Kit nem com o branch).

## D-021 — Node >= 20.19 como requisito do projeto (2026-07-08) — VIGENTE

O ecossistema JS migrou para pacotes ESM-only; ferramentas modernas (vitest 3+, jsdom 27 via
`@csstools/css-calc`) dependem de `require(esm)`, que so existe a partir do **Node 20.19.0** (backport)
/ 22.12. O projeto rodava em 20.15.0 → `ERR_REQUIRE_ESM` travava o `npm test` (T0).

**Decisao:** Node **>=20.19** e requisito. Maquina atualizada para **v20.20.2 (LTS Iron)** — mesma
linha 20.x (mesmo ABI, nao precisou reinstalar node_modules; `sharp` nativo intacto). Travado no repo
por `front/package.json` `engines.node: ">=20.19.0"` e `.nvmrc` (20.20.2) na raiz.

**Higiene (aplicada na mesma sessao):** cache do npm movido para `E:\npm-cache` (C: estava com 4% livre;
liberou ~6 GB). Nota: `front/node_modules` tem orfaos nao declarados (next-auth/openid-client — restos
do NextAuth D-010; msw/sharp) — limpar com `npm ci` quando conveniente (divida menor).

**Why:** sem isso, nenhum teste roda — e o metodo da feature 016 exige teste verde para cada tarefa.

## D-022 — Area do comprador 100% compra-direta; mock de leilao removido (2026-07-09) — VIGENTE

Durante a avaliacao de usabilidade (feedback do cliente), a area do comprador (/minha-conta) misturava
dados mock do motor de leilao — que nao sera implementado agora (leilao e microservico da Fase 2, D-014).
Pedidos de compra-direta ate exibiam o status `aguardando` com label "Aguardando ofertas" (semantica de
leilao).

**Decisao:** limpar o leilao da AREA DO COMPRADOR, preservando os teasers de descoberta (D-007).
Removido: as 3 cotacoes mock do `INITIAL_ORDERS` (ord-001/002/005 → sobra compra-direta; ord-005 virou
compra-direta cancelada p/ manter variedade de status no Historico), a aba **Ofertas** (`OfertasTab.tsx`
deletado), o quick-stat de Ofertas no hero, `handleAceitarOferta` (orfao) e todo o encadeamento
`onVerOfertas`. Corrigido tambem o label type-aware: compra-direta + `aguardando` → "Aguardando
confirmacao" (cotacao segue "Aguardando ofertas").
Mantido (teaser visivel-mas-inativo, NAO e mock): "Pedir oferta" desabilitado no `ProductCard`, rota
`/mercado` gateada, e o botao gateado "Novo Pedido de Cotacao — Em breve" no `PedidosTab` (+ o
`handleNovoPedido`/`NovoPedidoModal` que ele aciona).

**Refina D-007:** o teaser de leilao vive nas superficies de DESCOBERTA (catalogo/mercado), nao na area
de conta do comprador. O seed de leilao sera recriado na Fase 2 junto do microservico.

**Divida tecnica registrada:** o seed `items[].unitPrice` (T1.5) foi gravado = preco TOTAL do pedido, nao
por-unidade (ex.: ord-003 qty 2, price 13400, unitPrice 13400). Nao afeta a UI atual (le campos legados);
corrigir a semantica do seed no T13, quando os `items[]` passam a ser renderizados.

**Why:** o comprador so faz compra-direta hoje; leilao e Fase 2. Mock de leilao na conta confunde o
usuario e polui o teste de usabilidade. **How to apply:** ao construir o carrinho/checkout (T6+), nao
reintroduzir cotacao na area do comprador; leilao entra so pelo microservico da Fase 2.

## D-016 a D-020 — Fluxo de compra direta: carrinho + checkout (2026-07-03) — VIGENTES

Aprovadas pelo cliente junto com o plano da feature 016 (compra direta ponta a ponta).

- **D-016 — Carrinho e o BuyModal.** O `ProductCard` passa a ter **"Adicionar ao carrinho"**; o
  `BuyModal` vira **"Comprar agora"** (adiciona ao carrinho e vai direto ao checkout). O fluxo
  canonico e carrinho → checkout. Nada de compra 1-clique fora do checkout.

- **D-017 — Carrinho multi-fornecedor: split no checkout.** Um carrinho pode ter produtos de
  fornecedores diferentes (Modelo A / D-009). Na confirmacao, o checkout **cria 1 pedido por
  fornecedor**. Coerente com o painel do fornecedor (que so ve os proprios pedidos).

- **D-018 — `Order` ganha `items: OrderItem[]` (breaking).** O `Order` atual e mono-item
  (`product` + `quantity`). Carrinho real exige linha de itens. Migra `minha-conta`, painel do
  fornecedor e `order-adapters.ts`. Sem isso nao ha carrinho de verdade.

- **D-019 — Persistencia.** Carrinho em **`localStorage`** (sobrevive a reload). Pedidos seguem em
  memoria (`orders-context`) ate o backend 006 — nao antecipar o 006.

- **D-020 — Nicho e schema de produto.** Catalogo expande de fraldas para **maes/bebes/cuidados/
  wellness**, com schema estruturado (`slug`, `categoria`, `atributos`, `descricao`). Deixar
  **ponto de extensao UCP documentado, NAO implementado** (descoberta por agentes e futuro).

**Fora de escopo (o backend resolve):** API de pagamento e fulfillment. Nesta feature entram como
**adaptadores mockados atras de interfaces tipadas** (`PaymentGateway`, `FulfillmentService`), com
**contract tests** que o backend real devera satisfazer sem tocar na UI. **Motor de leilao:** nada
aqui — o CTA "buscar ofertas personalizadas" fica visivel e inativo atras de `LEILAO_ATIVO` (D-014).

**Metodo (acordado):** plano antes do codigo; tarefas pequenas com teste; subagentes por unidade
isolada com spec fechada; coordenador (sessao-mae) integra e verifica; loop de ate 3 tentativas por
tarefa — se nao fechar, PARAR e reportar bloqueio. Nada e "pronto" sem teste verde.

## Aprovacoes registradas em 2026-07-02

- Spec do gating do leilao (feature 013) **APROVADA** pelo cliente → H-002 liberado para redacao/execucao.
- Disparo do H-001 em sessao Haiku **AUTORIZADO** pelo cliente.
- Spec da compra direta (feature 014, Modelo A) **APROVADA** pelo cliente.

## D-010 — Stack de autenticacao: Firebase Authentication (Google) (2026-07-02, REVISADA) — VIGENTE

Versao original (superada): NextAuth v5 + OAuth do console, com creds ja em `front/.env.local`.
**Revisada por decisao do cliente (2026-07-02): Firebase Authentication com provider Google.**

Motivos: alinhamento total com D-001 (Firebase = Google Cloud); identidade unica para web + app
mobile futuro (D-005); e **persistencia do papel no Firestore desde a Fase 1** — dissolve a costura
stub que a versao NextAuth exigia.

Consequencias:
- Auth: Firebase Auth, provider Google (habilitar no console Firebase).
- Config web do Firebase em `front/.env.local` (`NEXT_PUBLIC_FIREBASE_*`). As chaves NextAuth
  (`GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_*`) ficam **obsoletas** — remover.
- Papel/perfil persistidos em **Firestore** (colecao `users/{uid}`), com regra de seguranca:
  usuario autenticado le/escreve so o proprio doc.
- **Protecao de rotas na Fase 1: guarda client-side** (`onAuthStateChanged` / hook `useAuth`).
  Endurecimento SSR (session cookie via Firebase Admin SDK) fica para o deploy/006 — decisao
  consciente: na Fase 1 os dados sao mock, sem risco. Documentar no codigo.
- Login por e-mail/senha (005b) passa a ser Firebase Auth (email/password provider) — **nao depende
  mais do backend 006**.

Pre-requisitos que o CLIENTE deve prover antes do disparo (o Haiku nao clica no console): projeto
Firebase; Google sign-in habilitado no Firebase Auth; config web no `.env.local`; Firestore em modo
Native + regra para `users/{uid}`. Service account do Admin SDK so quando for endurecer SSR.

Compatibilidade: Firebase JS SDK v10+ e estavel com Next 16 + React 19 (SDK client, componentes
`'use client'`) — sem aposta de beta, sem downgrade do Next.

## D-011 — Sequencia hibrida: gating → auth Google → compra direta (2026-07-02) — VIGENTE

O login Google e autocontido (nao depende do backend 006), mas "login pronto" NAO e "fundacao da
loja pronta". A fundacao tem tres pilares: identidade (Google entrega), autorizacao/role (Google
NAO entrega) e persistencia (mock ate 006). Para nao construir o fluxo de compra sobre um login
falso, a ordem de execucao passa a ser:

1. **H-002** — gating do leilao (feature 013), independente de auth.
2. **005a** — auth Google (fatia identidade): **Firebase Auth (Google)** (D-010 revisada),
   substitui `IS_LOGGED_IN` por um hook/contexto de auth (`onAuthStateChanged`) em todo lugar
   (corrige na raiz o bug de flag duplicada do Header), protege rotas privadas (guarda client-side).
   **Papel do usuario PERSISTIDO em Firestore** (`users/{uid}`): apos o login, se nao houver papel,
   onboarding pergunta comprador/fornecedor e grava no Firestore — persistencia REAL, nao mais stub.
3. **H-004** — compra direta (feature 014), agora sobre sessao real.

Depois: 006 backend (traz role/persistencia + login por credenciais 005b) → 011 pagamento → 007.

## D-023 — Checkout e o flip do fluxo de compra (2026-07-10) — VIGENTE

Fechou o loop do marketplace de compra-direta (Thread S). O checkout (`/checkout`) e uma maquina de 4
passos — endereco → revisao → pagamento (STUB) → confirmacao — entregue em duas tarefas: **S5a** (telas
+ estado local, sem efeito) e **S5b** (efeito de negocio + flip).

**S5b — o "flip":** o pedido passa a nascer **so** na confirmacao do checkout. Antes, "Comprar agora"
(BuyModal) criava o pedido instantaneamente e disparava o toast enganoso "Pedido criado! O fornecedor foi
notificado." — reportado na avaliacao de usabilidade. Agora:
- Confirmar cria **1 pedido por fornecedor** (D-017) via `buildOrdersFromCart` (T1), roda os adapters mock
  Payment/Fulfillment (T2, STUB approved/scheduled), materializa pedidos `sup-001` no painel do fornecedor
  (feed preservado — nao regrediu), e **limpa a sacola**. Handler idempotente (guard `submitting`).
- "Comprar agora" deixa de criar pedido: passa a `addItem` + `router.push('/checkout')` (mantida a trava
  de perfil RN-06). BuyModal/`createDirectOrder`/toast enganoso removidos do catalogo (`BuyModal.tsx` fica
  orfao, nao deletado nesta task).
- Bridge `createOrdersFromCart(items, address)` no OrdersContext mapeia `DomainOrder` → `Order`
  (account-mock) com `items[]` canonicos.

**Divida tecnica D-022 RESOLVIDA (parcial):** os pedidos criados pelo carrinho gravam `items[].unitPrice`
com o preco **unitario correto** (vem do carrinho por linha). O seed estatico de `INITIAL_ORDERS` ainda
tem unitPrice = total; corrigir se/quando esses seeds forem re-renderizados.

**Why:** o pedido nascer no catalogo era uma mentira de UX (sem revisao, sem endereco confirmado, notificava
fornecedor cedo demais). **How to apply:** todo pedido de compra-direta nasce no checkout; nao reintroduzir
criacao instantanea. Pagamento real (011) e fulfillment real substituem os adapters STUB pela porta ja
definida (T1/T2) — sem mudar o fluxo.

## D-024 — Interação de compra exige login; ambos os botões respeitam a quantidade (2026-07-10) — VIGENTE (emenda D-016)

Feedback do cliente após validar o catálogo com o stepper (S6):

1. **Gate de login nos botões de compra.** A D-016 dizia que "Adicionar à sacola" não exigia login (carrinho é
   local, login só no checkout). O cliente REVERTE: todos veem o catálogo, mas **só logados interagem com os botões
   de compra**. Agora "Adicionar à sacola" deslogado redireciona para `/login?redirect=/catalogo` (sem adicionar,
   sem toast) — mesmo padrão que "Comprar agora" e "Pedir oferta" já usavam. Perfil (RN-06) segue checado só no
   caminho do "Comprar agora"/checkout; para adicionar à sacola basta estar logado.
2. **Ambos os botões respeitam a quantidade do stepper (S6).** "Comprar agora" ignorava o stepper e ia ao checkout
   com 1. A prop virou `onBuy(product, quantity)` e o catálogo usa essa quantidade ao montar o CartItem.

**Why:** consistência (dois botões lado a lado, um respeitava a quantidade e o outro não) e regra de negócio do
cliente (interação de compra é para logados). **How to apply:** qualquer nova CTA de compra no catálogo passa pelo
gate `isLoggedIn` e propaga a quantidade escolhida. Commit S7.

## D-025 — Detalhe e cancelamento de pedido (comprador), com trava logistica (2026-07-10) — VIGENTE

Feature 017 (brainstorming com o cliente). O OrderCard so mostrava resumo; o comprador pediu ver os dados do
pedido e uma logica de cancelamento com restricao logistica. Decisoes:
- **Escopo enxuto:** ver detalhes + **cancelar apenas** (nao editar itens/endereco).
- **Detalhe:** **acordeao inline** no card (nao modal, nao pagina) — mostra items[] (getOrderItems T1.5), total,
  endereco completo, data.
- **Trava logistica:** cancelar **so em `aguardando`**; depois de confirmado, bloqueia com mensagem ("fale com o
  fornecedor"). a-caminho/entregue/cancelado = terminal. Como cancelar so vale antes da confirmacao, nao ha estado
  pendente nem aprovacao do fornecedor.
- **Sinalizacao:** cancelar reflete no market-context o DirectOrder do sup-001 (baixa no painel); no-op p/ os demais.
- **Corrige divida D-022:** renderizar items[] exige o seed com unitPrice **unitario** coerente (unit x qtd = total).

**Why:** o comprador precisa inspecionar e cancelar pedidos, mas edicao completa e overkill sem backend; a trava
por status espelha a realidade logistica. **How to apply:** cancelamento e mutacao mock no orders-context +
reflexo no market-context (padrao do checkout S5b); edicao real e aprovacao pelo fornecedor ficam para o 006+.
Spec: spec-pedido-detalhe-cancelamento.md.
