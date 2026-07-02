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

## Aprovacoes registradas em 2026-07-02

- Spec do gating do leilao (feature 013) **APROVADA** pelo cliente → H-002 liberado para redacao/execucao.
- Disparo do H-001 em sessao Haiku **AUTORIZADO** pelo cliente.
- Spec da compra direta (feature 014, Modelo A) **APROVADA** pelo cliente.

## D-010 — Stack de autenticacao: NextAuth v5 + Google (2026-07-02) — VIGENTE

Confirmado por fato: `front/.env.local` ja contem `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXTAUTH_SECRET` e `NEXTAUTH_URL` preenchidos. A stack de auth e **NextAuth v5 (Auth.js) com
provider Google**. Firebase Auth/Identity Platform fica **fora** (nao ha motivo para trocar dado
que as credenciais NextAuth ja existem). Hospedagem futura em Cloud Run (D-001). O login por
e-mail/senha (CredentialsProvider) depende do backend 006 e fica na fatia 005b.

Risco a verificar na implementacao: compatibilidade NextAuth v5 com Next 16 + React 19 (pacote e
nome das env vars — v5 prefere `AUTH_SECRET`/`AUTH_URL`). Se nao houver versao estavel compativel,
parar e relatar (nao fazer downgrade do Next).

## D-011 — Sequencia hibrida: gating → auth Google → compra direta (2026-07-02) — VIGENTE

O login Google e autocontido (nao depende do backend 006), mas "login pronto" NAO e "fundacao da
loja pronta". A fundacao tem tres pilares: identidade (Google entrega), autorizacao/role (Google
NAO entrega) e persistencia (mock ate 006). Para nao construir o fluxo de compra sobre um login
falso, a ordem de execucao passa a ser:

1. **H-002** — gating do leilao (feature 013), independente de auth.
2. **005a** — auth Google (fatia identidade): NextAuth v5 + Google, substitui `IS_LOGGED_IN` por
   `useSession()` em todo lugar (corrige na raiz o bug de flag duplicada do Header), protege rotas
   privadas. **Costura de role temporaria:** apos o login Google, a escolha comprador/fornecedor e
   um FLUXO REAL (onboarding) com ARMAZENAMENTO STUB (na sessao, nao em banco) — reseta quando o
   006 chegar. Documentada como divida tecnica, nunca apresentada como definitiva.
3. **H-004** — compra direta (feature 014), agora sobre sessao real.

Depois: 006 backend (traz role/persistencia + login por credenciais 005b) → 011 pagamento → 007.
