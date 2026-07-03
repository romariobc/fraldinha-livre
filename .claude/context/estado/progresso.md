# Progresso — fraldinha-livre

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
