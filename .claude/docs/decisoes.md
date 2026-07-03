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
