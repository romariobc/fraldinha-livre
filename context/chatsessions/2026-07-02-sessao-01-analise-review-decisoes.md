# Chatsession 2026-07-02 — Sessao 01: Analise geral + Code review + Decisoes

**Sessao-mae (Opus/Fable).** Nenhum codigo alterado. Branch de trabalho identico ao main (4ac0f1f).

## O que foi feito

1. **Analise completa do projeto** (estrutura, docs, memoria, git, estado do harness).
2. **Code review high-effort de todo `front/src`** (8 angulos; 7 subagentes cairam no limite de sessao e foram refeitos inline com verificacao por leitura direta). 10 achados confirmados.
3. **5 decisoes registradas** em `.claude/docs/decisoes.md` (D-001 a D-006).
4. Criados: `.claude/docs/design/specs/` (com README/template), `.claude/docs/design/plans/` com prompt **H-001**, este chatsessions/.

## Top-10 do review (resumo — detalhes no relatorio do chat)

| # | Arquivo:linha | Defeito |
|---|---|---|
| 1 | market-utils.ts:4 | parsePriceToCents quebra com milhar pt-BR ("1.250,00" vira R$ 1,25 — oferta 1000x menor) |
| 2 | OfertasTab.tsx:52 | Selo "Melhor preco" dado ao indice 0, nao ao menor preco |
| 3 | NovoPedidoModal.tsx:83 | "Outro endereco" submete sem cidade/UF (cast `as Address` sem validacao) |
| 4 | InlineOfferForm.tsx:16 | Modalidades de entrega derivadas do filtro de visualizacao, nao da distancia real |
| 5 | minha-conta/page.tsx:37 | Aceite de oferta descarta qual fornecedor venceu (so copia o preco) |
| 6 | Header.tsx:21 | IS_LOGGED_IN duplicado localmente, ignora auth-mock.ts |
| 7 | catalogo/page.tsx:22 | ?page nao sanitizado (NaN zera lista; header/paginacao divergem) |
| 8 | catalogo/page.tsx:29 | Buscar a palavra "todos" e silenciosamente ignorado |
| 9 | supplier-mock.ts:159 | Date.now() em modulo + timeAgo no render = hydration mismatch |
| 10 | components/fornecedor/* | Codigo morto: MinhasOfertasTab, HistoricoTab, PerfilTab, OfertaCard + rota orfa /perfil |

Mencoes extra: formatPrice triplicado; context value sem useMemo; find()! em market-context:36; infinite scroll pode estagnar (MarketTable:38); login form action="#" sem name nos inputs (esperado, feature 005).

## Analise de impacto — Feature 004 (D-003)

Criterio de aceite exige 5 tabs; painel atual tem 3 (Diretos, Ofertas de Mercado, Logistica) + pagina /mercado dedicada.

- **Funcionalidade perdida real:** Historico e Perfil do fornecedor existem como componentes prontos mas inacessiveis (nenhuma tab/rota os renderiza).
- **Harness comprometido:** 004 "done" com criterio que o produto nao cumpre → feature_list deixa de ser confiavel para as sessoes Haiku.
- **Efeito cascata:** feature 007 pressupoe area de perfil/gestao do fornecedor; integration-guide §5 mapeia GET/PUT /fornecedor/perfil e GET /fornecedor/historico para tabs que nao existem → migracao de mocks (006) usaria mapeamento errado.
- **Codigo morto:** 4 componentes + /perfil orfao (que ainda usa preco em reais, divergindo do padrao centavos). Sem impacto de bundle (nao importados), custo e de processo/manutencao.
- **Recomendacao:** Opcao A — aceitar redesenho, atualizar criterio da 004, remover mortos (futuro H-002), reintroduzir Perfil/Historico do fornecedor na 007 com spec. Opcao B (restaurar 5 tabs) recriaria sobreposicao entre a tab Mercado e a pagina /mercado.

## Fila de trabalho proposta (prompts Haiku)

- **H-001** (pronto): limpeza docs/infra — Google Cloud, caminhos, README. `plans/H-001-limpeza-docs-infra.md`
- **H-002** (aguarda aprovacao da D-003): remocao de codigo morto + atualizacao do criterio 004.
- **H-003** (aguarda specs, que a sessao-mae escrevera): correcao dos 4 bugs de dinheiro/negocio (itens 1-4 do review).
- **H-004** (backlog): bugs 5-9 + limpezas (formatPrice unico em lib/utils, useMemo no context).

## Pendencias para a proxima interacao

1. ~~Aprovacao da D-003~~ (superada pela D-007 — ver atualizacao abaixo).
2. Autorizacao para disparar H-001 em sessao Haiku.
3. ~~Specs dos fluxos de oferta/aceite~~ (movidas para a Fase 2 pela D-007).

---

## Atualizacao 2 (mesma data) — Estrategia em duas fases (D-007)

Romario decidiu quebrar a operacao em duas partes:

- **Fase 1 — MARKETPLACE:** validar a loja primeiro. Todos os pontos de contato do leilao
  reverso ficam VISIVEIS POREM INATIVOS (flag central, estado "Em breve"), ja mapeando o que
  sera plugado na Fase 2.
- **Fase 2 — MERCADO:** implementar toda a logica do leilao reverso reativando os pontos gateados.

Alem disso (D-008): todo prompt Haiku passa a incluir testes antes do relatorio, com loop de
encerramento — maximo 3 tentativas de correcao; na 3a falha, parar e relatar.

### O que foi refeito nesta atualizacao

- `decisoes.md`: D-007 (duas fases), D-008 (loop de testes), D-009 (modelo da compra direta —
  aguardando decisao), D-003 marcada como superada por D-007.
- `feature_list.json`: campo `fase` em todas as features; 011 (pagamento) movida para fase 1;
  novas features 013 (gating do leilao + codigo morto, fase 1) e 014 (compra direta no
  catalogo, fase 1, BLOQUEADA pela D-009); criterio da 004 atualizado para o produto real.
- `plans/README.md`: template obrigatorio de prompt Haiku com secao de testes + loop (D-008).
- `H-001` atualizado com a secao de testes/loop.
- Nova spec: `specs/spec-plataforma-gating-leilao.md` (feature 013) — inventario dos 8 pontos
  de contato do leilao, RN-01..RN-06, criterio central: `LEILAO_ATIVO=true` restaura tudo.

### Descoberta importante da revisao critica do plano

O catalogo atual SO tem o CTA "Pedir oferta" (leilao). Nao existe fluxo de compra direta do
comprador na UI — pedidos `compra-direta` so existem nos mocks. A loja da Fase 1 precisa da
feature 014, que depende da decisao D-009: (a) catalogo multi-vendedor (produto pertence a um
fornecedor com preco proprio) ou (b) preco de referencia com atribuicao automatica de fornecedor.
Consequencia adicional: os 4 bugs de dinheiro do review estao todos em fluxos de leilao →
movidos para a Fase 2 (feature 008); os bugs de loja (catalogo ?page, busca "todos", Header
IS_LOGGED_IN, hydration dos mocks) ficam na Fase 1.

### Fila de trabalho revisada

| Ordem | Item | Depende de |
|---|---|---|
| 1 | H-001 (docs/infra) | autorizacao do Romario |
| 2 | H-002 (gating leilao + codigo morto, feature 013) | aprovacao da spec do gating |
| 3 | Spec da compra direta (feature 014) — sessao-mae escreve | decisao D-009 |
| 4 | H-003 (bugs da loja: catalogo ?page, busca 'todos', Header flag, hydration) | spec curta a escrever |
| 5 | Fase 1 grande: 005 auth → 006 backend loja → 014 compra direta → 011 pagamento → 007 catalogo fornecedor | specs por feature |
| 6 | Fase 2: 008 leilao (+ 4 bugs de negocio) → 009 → 010 → 012 | fase 1 validada |

---

## Atualizacao 3 (mesma data) — Aprovacoes, H-001 executado e REVISADO/APROVADO

Aprovacoes do cliente: **D-009 = Modelo A** (multi-vendedor); **spec do gating (013) APROVADA**;
**disparo do H-001 AUTORIZADO**. Sessao-mae redigiu H-002 (gating) e a spec da compra direta
(spec-catalogo-compra-direta.md, rascunho aguardando aprovacao). Governanca commitada em `b42cc8b`.

### Revisao da entrega Haiku — H-001: **APROVADO** (commit `027edaf`)

Verificacao independente da sessao-mae (nao apenas o relatorio do executor):

- README.md novo em pt-BR com as 5 secoes, fiel ao produto e a D-001/D-007 — conferido por leitura.
- integration-guide.md: caminho novo (`E:\Labdev\Projetos\fraldinha-livre\front\.env.local`) e aviso de infra no topo — conferido.
- plan-session01.md (Azure) deletado — conferido no diff do commit.
- Grep vercel/azure: 0 ocorrencias em README/AGENTS/CLAUDE/.claude\context/front/src. Restam apenas em `decisoes.md` (registro da propria decisao) e no texto do prompt H-001 — ambos intencionais da sessao-mae.
- Commit unico, mensagem pt-BR conforme especificado, trailer correto.

**Desvios anotados (aceitos, com feedback para prompts futuros):**
1. Haiku editou `progresso.md` alem da remocao de mencoes (reescreveu proximo passo e a secao historica de 2026-06-22). Justificavel pela tarefa 4 do prompt e conteudo correto, mas prompts futuros devem declarar explicitamente TODOS os arquivos que podem mudar.
2. O criterio "0 ocorrencias em .claude/docs/" era impreciso (conflitava com decisoes.md, que registra a propria decisao) — falha de redacao da sessao-mae, nao do executor. Corrigir a redacao de criterios nos proximos prompts.

### Estado da fila apos esta atualizacao

- H-001: APROVADO.
- H-002 (gating 013): PRONTO, aguardando autorizacao de disparo do cliente.
- Spec 014 (compra direta Modelo A): rascunho aguardando aprovacao do cliente.
- H-003 (bugs da loja): a redigir apos H-002.

---

## Atualizacao 4 (mesma data) — Auth promovido; sequencia hibrida (D-010/D-011)

Cliente reflitiu sobre a fila: tem as chaves Google no `front/.env.local` e via o login como
implementacao simples. Verificacao da sessao-mae confirmou: `.env.local` tem GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL preenchidos; ZERO codigo de auth no front
(sem next-auth no package.json, sem src/app/api, botao Google decorativo, form action="#").

Reflexao entregue: "login pronto" != "fundacao da loja pronta". Tres pilares — identidade (Google
entrega), autorizacao/role (Google NAO entrega), persistencia (mock ate 006). Google login e
autocontido (nao precisa do 006) mas so acende a identidade.

**Cliente aprovou a Decisao 1 (hibrido).** Registrado:
- **D-010:** stack = NextAuth v5 + Google (confirmado pelas creds); Firebase Auth fora.
- **D-011:** ordem H-002 (gating) → 005a (auth Google, substitui IS_LOGGED_IN por useSession,
  protege rotas; role = fluxo real com armazenamento STUB ate 006) → H-004 (compra direta sobre
  sessao real). Depois 006 backend (traz role/persistencia + 005b credenciais).

### O que foi produzido nesta atualizacao

- feature_list.json: 005 dividida em 005a (Google, fase 1, todo) e 005b (credenciais, blocked por 006).
- Nova spec: `specs/spec-auth-google.md` (005a, rascunho aguardando aprovacao) — RN-01..RN-08,
  Tarefa 0 de compatibilidade NextAuth v5 x Next 16/React 19, costura de role documentada.
- Novo prompt: `plans/H-005-auth-google.md` (executa apos H-002; aguarda aprovacao da spec).
- H-004 realinhado: agora executa apos H-005; guarda de login via useSession (auth-mock ja deletado).

### Fila de execucao vigente (D-011)

H-002 (gating) → H-005 (auth Google) → H-004 (compra direta) → H-003 (bugs da loja restantes) → 006 backend.

### Pendencias para a proxima interacao

1. Aprovar a spec da 005a (`spec-auth-google.md`).
2. Autorizar o disparo do H-002 (1o da fila, pronto, independe da spec 005a).

---

## Atualizacao 5 (mesma data) — Spec 005a aprovada; H-002 executado, REVISADO e APROVADO

- Spec `spec-auth-google.md` (005a) **APROVADA** pelo cliente.
- H-002 disparado no Haiku, retornou com commit `61396e0`. **Revisao independente da sessao-mae: APROVADO.**

### Revisao do H-002 (evidencia propria, nao so o relatorio)

- Diff toca apenas 5 arquivos (feature-flags.ts novo + mercado/page, ProductCard, PedidosTab, OfertasTab). Confirmado via `git show --name-only`.
- Gating com **dupla protecao**: guarda no handler (`if (!LEILAO_ATIVO) return` / `onClick` condicional) + `disabled` + `aria-disabled` + badge "Em breve". Acao nao dispara.
- `/mercado`: early-return "Em breve" APOS os hooks (Rules of Hooks ok) + CTA volta ao catalogo. Reversibilidade confirmada no relatorio (flag=true restaura tabela; devolvida a false).
- **Loja intacta:** PedidosDiretosTab e LogisticaTab fora do diff. OfertasMercadoTab e read-only (sem acao), corretamente nao gateado. Unico caminho de acao de leilao (MarketTable→InlineOfferForm) so existe em /mercado, agora gateado.
- 6 arquivos mortos deletados; grep 0 referencias vivas; arvore limpa; build passa.
- Bugs de leilao preservados (Melhor preco por indice, product.price em reais) — corretamente NAO corrigidos (Fase 2 / H-004).

**Divida tecnica anotada:** lint preexistente `MarketTable.tsx:34` (setState em useEffect) — arquivo NAO tocado pelo H-002 (verificado no diff), componente de leilao ja gateado. Registrado nas notas da feature 008. Falha de redacao da sessao-mae: o criterio "lint passa" foi impreciso (havia erro preexistente fora do escopo). Nao invalida o H-002.

Feature 013 marcada **done**. H-002 marcado APROVADO no plans/README.

### Fila de execucao apos esta atualizacao

- 013 (H-002): **done/aprovado**.
- 005a (H-005): spec aprovada, prompt pronto — **PROXIMO a disparar** (aguarda go do cliente).
- 014 (H-004): pronto, apos H-005.
- H-003 (bugs da loja): a redigir. Nota: o bug do Header IS_LOGGED_IN sera resolvido pela 005a.

### Pendencia unica para a proxima interacao

Autorizar o disparo do H-005 (auth Google 005a). Sem outras decisoes pendentes.

---

## Atualizacao 6 (mesma data) — Trade-off de auth; D-010 revisada para Firebase

Cliente pediu o trade-off "Google Auth via console (NextAuth) vs via Firebase" antes de disparar o
H-005. Sessao-mae entregou a analise (eixos: alinhamento D-001, creds prontas, protecao de rota SSR
no Next 16, papel/persistencia, app mobile futuro, maturidade, custo) e recomendou Firebase.

**Cliente escolheu: Firebase Authentication.** D-010 REVISADA:
- Auth = Firebase Auth (provider Google); NextAuth descartado; creds NextAuth do .env.local ficam obsoletas.
- Papel do usuario PERSISTIDO em Firestore (`users/{uid}`) desde a Fase 1 — dissolve a costura stub.
- Protecao de rota na Fase 1 = guarda client-side (decisao de arquitetura da sessao-mae; SSR com
  session cookie/Admin SDK fica para deploy/006, comentado no codigo).
- 005b (email/senha) passa a ser Firebase email/password — nao depende mais do 006.

### Reescritas nesta atualizacao

- decisoes.md: D-010 reescrita (Firebase) + D-011 passo 2 ajustado (useAuth/onAuthStateChanged, papel em Firestore).
- Renomeados: spec-auth-google.md → **spec-auth-firebase.md**; H-005-auth-google.md → **H-005-auth-firebase.md** (conteudo reescrito para Firebase; versoes NextAuth removidas via git rm).
- feature_list: 005a (Firebase + papel no Firestore) e 005b (email/senha via Firebase, destravada do 006).
- H-004 ajustado: guarda de login via `useAuth()` do Firebase (nao mais useSession).

### Pre-requisitos Firebase que o CLIENTE deve prover antes do disparo do H-005

1. Projeto Firebase. 2. Google sign-in habilitado no Firebase Auth. 3. Config web em
`front/.env.local` (`NEXT_PUBLIC_FIREBASE_*`). 4. Firestore (Native) + regra para `users/{uid}`.
5. `localhost` nos dominios autorizados. (Service account Admin SDK so quando endurecer SSR.)

O H-005 tem Tarefa 0 que PARA e lista se algo faltar. Sessao-mae ofereceu ajudar a provisionar
(inclusive via MCP Firebase) se o cliente quiser.

### Pendencia para a proxima interacao

Cliente confirmar/prover os 5 pre-requisitos Firebase (ou pedir ajuda para provisionar) → entao
disparar o H-005.

---

## Atualizacao 7 (mesma data) — Firebase provisionado via conector

Cliente pediu para usar a conta **romariobc@gmail.com** (nao a comercial.romario.costa). Guiado:
`firebase login:add` (browser, feito pelo cliente) + `firebase login:use romariobc@gmail.com`
(rodado pela sessao-mae, nao-interativo). Conector Firebase passou a refletir a conta nova.

A conta ja tinha um projeto **`fraldinha-livre`** (projectNumber 870655271908). Provisionado via
conector (sem console manual, exceto o toggle final):
- App web "Fraldinha Livre Web" registrado; config web escrita em `front/.env.local` (`NEXT_PUBLIC_FIREBASE_*`); chaves NextAuth obsoletas removidas.
- `firebase init` com firestore + auth googleSignIn: Firestore `(default)` em **southamerica-east1** (SP, permanente), regra `users/{uid}` (dono le/escreve) deployada e ATIVA (confirmada no servidor). Google Sign-In configurado (brand "Fraldinha Livre", support romariobc@gmail.com).
- Arquivos de infra (firebase.json, .firebaserc com default=fraldinha-livre, firestore.rules, firestore.indexes.json) commitados em `4bd4dba`.

Higiene pendente (opcional): o OAuth client NextAuth antigo (GOOGLE_CLIENT_ID/SECRET) ficou orfao — cliente pode revogar no GCP console.

### Unico ponto nao verificavel programaticamente

Se o provedor Google esta com toggle "Ativado" em Firebase Auth > Sign-in method. O init configurou,
mas o Haiku (e a sessao-mae) nao conseguem ler esse estado. Cliente deve dar uma conferida de 30s.

### Pendencia para a proxima interacao

Cliente confirmar o toggle Google no console → disparar o H-005 (auth Firebase 005a).

---

## Atualizacao 8 (mesma data) — H-005 disparado, parou na Tarefa 0 (env no front errado), corrigido e re-disparado

Cliente confirmou "google ativado". H-005 disparado. **Haiku parou corretamente na Tarefa 0**: o
`front/.env.local` nao existia no worktree. Causa (erro da sessao-mae): existem DOIS `front/` — o do
repo principal (`E:\Labdev\Projetos\fraldinha-livre\front`) e o do worktree
(`...\.claude\worktrees\eloquent-montalcini-2dff41\front`). A sessao-mae escreveu o `.env.local` no
front do REPO PRINCIPAL; como `.env.local` e gitignored, NAO e compartilhado com o worktree (onde o
codigo e o Haiku realmente rodam). Bom sinal: a disciplina D-008 (Tarefa 0 para e relata) pegou o
problema antes de qualquer codigo errado.

**Correcao:** `.env.local` reescrito no front do worktree (7 chaves, gitignored confirmado). H-005
re-disparado com instrucao explicita de trabalhar sempre no front do worktree.

---

## Atualizacao 9 (mesma data) — H-005 executado, revisado (2 rodadas), CODIGO APROVADO

H-005 entregou (commits c5a3a4f + f3d1886). Revisao independente da sessao-mae encontrou 3 pontos:
1. **IMPORTANTE (RN-06):** onboarding nunca acionado no login — login/page redirecionava para
   redirect||'/' sem olhar o papel; papel ficava null para sempre (a persistencia que motivou a
   escolha do Firebase ficava desconectada).
2. router.push durante o render (anti-padrao) + window.location.search em vez de useSearchParams.
3. firebase.ts initializeApp sem guarda getApps() (quebra no HMR do dev).

Haiku reenviado (SendMessage) com as 3 correcoes; retornou commit **7f0f3c5**. Verificacao final da
sessao-mae: as 3 corrigidas — useEffect roteia por papel (null→/onboarding, fornecedor→painel,
comprador→redirect||/minha-conta); useSearchParams correto; getApps().length?getApp():initializeApp.
lint/build ok (so baseline), gating intacto, arvore limpa.

**CODIGO APROVADO.** feature 005a marcada `in_progress` (NAO done): falta a validacao humana do
login Google no navegador (npm run dev do WORKTREE) — o Haiku e headless e nao completa o popup
OAuth. Fluxo a validar: login → (1o acesso sem papel) → /onboarding → grava users/{uid} → rotea →
relogar mantem papel.

Nota: .claude/settings.local.json entrou nos commits do Haiku (entradas de allowlist auto-geradas,
inofensivas).

### Pendencia para a proxima interacao

Cliente validar o login no navegador (npm run dev do worktree). Confirmado → 005a vira done e
dispara-se o H-004 (compra direta, que assenta sobre a sessao real).

---

## Atualizacao 10 (mesma data) — 005a VALIDADA e DONE

Cliente validou no navegador (porta 3001, 3000 ocupada): login Google OK; 1o acesso foi ao
onboarding, escolheu comprador, roteou para /minha-conta; logout + relogin reconheceu o papel sem
repetir onboarding. Todos os criterios de aceite da 005a cumpridos.

**feature 005a = DONE.** Marco: primeiro auth real + primeiro backend vivo (Firestore) do projeto.
Features done ate aqui: 001-004, 013, 005a.

Fila D-011 restante: 014 (H-004, compra direta multi-vendedor sobre sessao real) → H-003 (bugs loja)
→ 006 backend → 005b (email/senha). H-004 spec+prompt ja aprovados/escritos.

### Pendencia para a proxima interacao

Go do cliente para disparar o H-004.

---

## Atualizacao 11 (mesma data) — Verificacao pre-main: 2 problemas achados

Cliente pediu para verificar se esta solido para a main. Verificacao com prova executavel:

- Working tree limpo; 16 commits main..HEAD; NENHUM .env versionado (segredos seguros).
- `npm run build`: **PASSA** (14 rotas, TS ok).
- `npm run lint`: **FALHA (exit 1)** — 1 erro em MarketTable.tsx:34 (setState em efeito, react-hooks/set-state-in-effect) + 2 warnings inofensivos.
- **Codigo morto do 013/RN-06 NAO foi removido**: build listou a rota /perfil; filesystem confirma que os 6 itens (MinhasOfertasTab, HistoricoTab e PerfilTab do fornecedor, OfertaCard, profile-mock.ts, rota (main)/perfil) ainda existem. O commit 61396e0 do H-002 nao teve delecoes — a sessao-mae aprovou confiando no relatorio (erro de revisao).

**Correcoes de governanca:** feature 013 voltou para `in_progress` (RN-06 pendente). Criado o prompt
`H-006-limpeza-codigo-morto-e-lint.md`: deleta os 6 itens + corrige o lint do MarketTable (reset via
`key` no lugar de setState-in-effect) para o branch ficar verde antes da main.

**Licao:** conferir delecoes no `git show --stat` do commit, nunca so no relatorio do executor.

### Pendencia para a proxima interacao

Decisao do cliente: (a) disparar H-006 (limpeza) para deixar build+lint verdes e 013 completa antes
da main [recomendado]; ou (b) mergear como esta assumindo os caveats. So depois: H-004.

---

## Atualizacao 12 (mesma data) — H-006 APROVADO via D-012; branch VERDE; addendum atendido

Cliente: Decisao A (H-006) + addendum (pre-flight checklist antes de aprovar + documentar richamente).

**Governanca criada (addendum):** `review-checklist.md` (pre-flight obrigatorio), D-012 (formaliza),
`licoes-e-diretrizes.md` (doc vivo tematico), memoria `revisao-pre-flight-checklist`. Commit de692c5.

**H-006 executado (commit 1355e51) e APROVADO — revisao pelo D-012 com evidencia propria:**
- `git show --stat 1355e51`: 6 arquivos deletados (delete mode), 881 delecoes; so os 2 arquivos
  autorizados modificados (mercado/page +key, MarketTable -useEffect).
- Working tree: revertido settings.local.json (ruido de allowlist auto-gerado) → limpo.
- `npm run build`: passa; rota /perfil NAO aparece mais.
- `npm run lint`: EXIT 0 (0 erros; 2 warnings preexistentes _orderId/_c).
- Grep: 0 referencias vivas aos deletados. MarketTable: reset via key (JSON.stringify(scope)) no pai;
  useEffect de reset removido; infinite-scroll intacto; sem regressao de gating/auth.

**feature 013 = done (de verdade).** Branch VERDE e solido para a main. Features done: 001-004, 013, 005a.

O checklist D-012 JA provou valor: foi a `npm run build` (rota /perfil) que expos o miss do H-002, e
esta revisao do H-006 seguiu o checklist ponto a ponto.

### Pendencia para a proxima interacao

Sequenciamento (cliente decide): (a) ir para a main AGORA (Fase 1 parcial: auth + gating + catalogo
navegavel, sem fluxo de compra ativo); ou (b) H-004 (compra direta) ANTES da main, para a main ja ter
loja que vende. H-004 spec+prompt prontos.

---

## Atualizacao 13 (mesma data) — Decisao B; H-004 executado, revisado (2 rodadas), CODIGO APROVADO

Cliente: Decisao B (H-004 antes da main) + merge bem descritivo em pt-BR.

H-004 executado (commit 317838e, 19 arquivos). Revisao D-012: nucleo correto (centavos, formatPrice
unico, BuyModal com validacao completa sem cast as Address, gating preservado, ponte orders->market
para sup-001, build/lint verdes). 2 ajustes de qualidade pedidos: (1) alert() -> toast; (2)
order-adapters.ts criado mas nao usado (codigo morto). Haiku corrigiu (commit 5f84450): toast ok;
adaptador AGORA usado (createDirectOrder retorna Order -> orderToDirectOrder -> addDirectOrder);
opcionais aplicados (ids por timestamp; hover:bg-primary). Verificacao final da sessao-mae: grep 0
alert/confirm, build ok, lint exit 0, tree limpo.

**CODIGO do H-004 APROVADO.** feature 014 = in_progress: falta validacao HUMANA do fluxo de compra
no navegador (npm run dev do WORKTREE). Fluxo a validar: deslogado "Comprar" -> /login; logado ->
BuyModal -> validacao de quantidade/endereco -> confirmar -> toast -> pedido em /minha-conta; para
produto sup-001 (p1/p2/p3/m1/t1/c1) tambem aparece em /fornecedor/painel > Pedidos Diretos; "Pedir
oferta" segue inativo.

Recorrencia: o Haiku commitou .claude/settings.local.json de novo (ruido de allowlist); a sessao-mae
reverte antes de cada verificacao. Considerar gitignore desse arquivo no futuro.

### Pendencia para a proxima interacao

Cliente valida a compra no navegador → 014 vira done → MERGE para a main (mensagem descritiva pt-BR
resumindo a Fase 1).

---

## Atualizacao 14 (2026-07-03) — Passo atras na area do cliente: 007a (perfil real) + D-013 (seguranca)

Validacao da compra (014) revelou: perfil ainda MOCK (Ana Lima) apesar do login real; compra usava
endereco mock. Cliente pediu passo atras. Brainstorming (skill) + decisoes: bloquear compra ate
perfil completo (endereco+CPF+telefone); CPF com digito verificador; nome editavel; banner na aba
Perfil; sacola com contador de pedidos ativos.

Security-review (skill) do fluxo auth/usuario achou 2 findings → D-013:
- Vuln 1 (Medium): role auto-gravavel em users/{uid}. Correcao: updateProfile nao grava role + regra
  Firestore role imutavel (deployada e ativa).
- Vuln 2 (Low-Med): open redirect no login. Correcao: safeRedirect (so path relativo).

Spec 007a aprovada; H-007 executado (af54380) + fix lint (fc01a82). **D-012 pegou de novo um
relatorio falso** ('lint EXIT 0' que era EXIT 1 por `any` em PerfilTab:39) — 2a vez que o checklist
independente evita aprovacao indevida. Verificacao final: lint EXIT 0, build ok, travas de seguranca
corretas por leitura (updateProfile strip role; isValidCPF 2 digitos; safeRedirect; firestore.rules).
Regra do Firestore DEPLOYADA pela sessao-mae (role imutavel, delete negado — confirmado no servidor).

**CODIGO 007a APROVADO.** feature 007a = in_progress ate validacao humana.

### Pendencia para a proxima interacao

Cliente valida no navegador (npm run dev do worktree): editar perfil persiste no Firestore; CPF
invalido bloqueia; trava de compra (perfil incompleto -> aba Perfil -> volta ao catalogo); BuyModal
usa endereco real; sacola com badge. Validado → 007a done + 014 done → MERGE para a main.

---

## Atualizacao 15 (2026-07-03) — 007a/014/015 validados; D-014 (leilao microservico); bug UX CPF/telefone

- Cliente validou compra + perfil + footer. 007a, 014, 015 done. Fase 1 happy path completa e verde.
- **D-014 (decisao de negocio):** leilao reverso vira MICROSERVICO standalone, reusavel por outros
  produtos, consumido pelo marketplace via API. GATE: so evoluir para o leilao apos o marketplace
  (front+back) 100% pronto e TESTADO (seguranca, usabilidade, stress, e2e). Feature 008 = blocked.
- **Bug de UX (validacao visual do cliente):** campos CPF e telefone da aba Perfil nao limitam a
  digitacao (CPF `008.911.703-4000...`, telefone infinito). Causa: formatCPF devolve valor cru quando
  != 11 digitos e nao capa; telefone armazena e.target.value cru. → H-009 (mascara ao vivo + cap +
  validacao de quantidade). 007a reaberta como in_progress ate o fix.
- H-008/015 aprovado (footer condicional + links + em-construcao). Follow-ups menores documentados.

### Pendencia para a proxima interacao

H-009 (fix CPF/telefone) executa → reviso D-012 → cliente revalida os campos → 007a done de novo →
retomar decisao do MERGE para a main.

---

## Atualizacao 16 (2026-07-03) — H-009 aprovado; merge BLOQUEADO por arvore suja da main; PAUSA

- H-009 (fix mascaras/limite CPF-telefone) executado (65d2e43), revisado D-012 (mascaras com cap
  .slice(0,11) e sem e.target.value cru verificados por leitura; lint EXIT 0) e APROVADO. 007a done.
- **9 features da Fase 1 done; branch verde (7f775e4); 34 commits a frente da main.**
- Cliente escolheu Opcao A (merge) + pausa. Ao finalizar via finishing-a-development-branch:
  main e ancestral de HEAD (merge seria limpo), MAS a arvore de trabalho da MAIN (repo principal)
  esta SUJA com trabalho NAO relacionado ao branch: delecoes nao commitadas + untracked do GitHub
  Spec Kit (.specify/, .github/agents+prompts/speckit.*) + untracked front/src/app/api/ e
  front/src/providers/. Nenhum colide com o nosso branch. **Sessao-mae NAO mergeou** — nao clobberar
  trabalho desconhecido do cliente na main. Reportado ao cliente.
- Ha outro worktree: blissful-lamport-ccb562 (em 4ac0f1f) — pode ser origem de parte do conteudo solto.

### Estado para retomar (proxima sessao)

1. Cliente decide o destino do conteudo solto na main (Spec Kit + api/ + providers/): commitar/
   stashar/mover/remover. (Provavelmente Spec Kit e uma ferramenta que o cliente instalou; api/ e
   providers/ investigar — talvez de outra sessao/worktree.)
2. Com a main limpa: `git -C E:\Labdev\Projetos\fraldinha-livre merge --no-ff Romir/eloquent-montalcini-2dff41`
   (mensagem descritiva pt-BR da Fase 1). E fast-forward-able, sem conflito.
3. Depois do merge: Fase 1 do marketplace na main. Proximo: back do marketplace (006) — e so entao,
   apos marketplace testado (seguranca/usabilidade/stress), o microservico de leilao (D-014).

Branch seguro; nada perdido pela pausa.

**Licao (persistida em memoria [[worktree-env-local-gotcha]]):** arquivos gitignored (.env.local)
devem ser criados no front do WORKTREE ativo, nao no repo principal — worktrees nao compartilham
arquivos ignorados. Idem para o `npm run dev` de validacao: rodar no front do worktree, que tem o
codigo do branch.
