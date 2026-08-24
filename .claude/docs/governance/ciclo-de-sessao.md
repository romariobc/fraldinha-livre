# Ciclo de Sessao e Mapa de Contexto — Fraldinha Livre

> **O que este documento e:** o mapa unico do "sistema nervoso" do projeto — o ciclo que toda sessao
> segue (inicio → trabalho → encerramento) e **todos os arquivos** que uma sessao le (referencia),
> escreve (persistencia) e onde a memoria vive. Se voce esta comecando uma sessao, comece por aqui.
>
> **Fonte de verdade do ciclo:** o harness de referencia
> https://github.com/romariobc/dev_flow_create_harness (branch `dominio/vendas-b2b`, ou `main`
> enquanto a branch de dominio nao existir). Este doc e a materializacao local dele, com as
> divergencias do projeto (ver §7).

---

## 1. Contexto base (SEMPRE carregado — o pano de fundo de toda sessao)

Estes arquivos entram no contexto no inicio de toda sessao (via CLAUDE.md/AGENTS.md ou injecao do
harness). Nao sao "lidos por tarefa" — sao o chao.

| Arquivo | Papel | Escopo |
|---|---|---|
| `E:\Labdev\CLAUDE.md` | Quem e o usuario (Romario), maquina, discos, WORKFLOW.md, conectores, contrato do tutor | Disco inteiro (todos os projetos em `E:\Labdev`) |
| `CLAUDE.md` (raiz do projeto) | Aponta o ciclo de sessao; inclui `AGENTS.md`; lista os caminhos de specs/plans/guia | Este projeto |
| `AGENTS.md` | Contexto de dominio; Next.js customizado (ler docs antes de codar); **skills por pasta** (domain-fornecedor, ui-system, risk-zone-protocol, etc.) | Este projeto |
| `MEMORY.md` (fora do repo — ver §5) | Indice da memoria persistente entre sessoes | Por projeto, na pasta do usuario |

> Divergencia registrada: neste projeto o contexto de dominio fica em `AGENTS.md`, **nao** em
> `context/dominio.md` (o harness usa Python + `context/dominio.md`; aqui e Next.js/TS).

---

## 2. O ciclo (inicio → trabalho → encerramento)

```
   ┌─────────────────────────── INICIO ───────────────────────────┐
   │ 0. Checar staleness ANTES de confiar no proprio checkout:     │
   │    `git fetch && git log --oneline HEAD..origin/main | wc -l` │
   │    Se > 0 (e principalmente se for dezenas+ de commits), os   │
   │    arquivos abaixo (passos 1-2) sao uma FOTO CONGELADA do     │
   │    momento em que este worktree/branch nasceu — nao o estado  │
   │    atual do projeto. Rebasear/atualizar (ou pelo menos avisar │
   │    o usuario da defasagem) antes de tratar progresso.md/      │
   │    feature_list.json como fonte de verdade.                   │
   │ 1. Ler context/estado/progresso.md   (onde a ultima parou)    │
   │ 2. Ler context/estado/feature_list.json (proxima feature todo)│
   │ 3. Ler a spec/plano da feature (se ja existir)                │
   │ 4. Conferir MEMORY.md (fatos duraveis relevantes)             │
   └───────────────────────────────┬──────────────────────────────┘
                                    ▼
   ┌────────────────────────── TRABALHO ──────────────────────────┐
   │ • 1 feature por sessao (foco)                                 │
   │ • Spec-driven (D-002): sem spec aprovada, nao codifica        │
   │ • Papeis (D-006): Opus/mae PLANEJA+REVISA; Haiku EXECUTA      │
   │ • Verificar antes de declarar feito (D-008 auto-teste Haiku;  │
   │   D-012 revisao independente da mae — git show --stat+build+lint)│
   └───────────────────────────────┬──────────────────────────────┘
                                    ▼
   ┌──────────────────────── ENCERRAMENTO ────────────────────────┐
   │ 5. Atualizar feature_list.json (status da feature)            │
   │ 6. Atualizar progresso.md (o que foi feito + proximo passo)   │
   │ 7. Gravar memoria SE houver fato duravel (§5)                 │
   │ 8. Commit(s) em pt-BR (Conventional Commits)                  │
   └───────────────────────────────────────────────────────────────┘
```

**Regras de ouro (do harness + decisoes locais):**
- Exatamente **1 feature por sessao**.
- **So prova executavel conta** — nunca declarar "feito" pelo relatorio (D-012).
- Toda entrega passa pelo `review-checklist.md` antes de "aprovado" (D-012).

---

## 3. Arquivos de CONSULTA (ler para referencia — nao necessariamente escrever)

| Arquivo | Papel | Quando ler |
|---|---|---|
| `.claude/context/estado/progresso.md` | Diario cronologico: onde cada sessao parou, proximo passo | **Sempre, no inicio** |
| `.claude/context/estado/feature_list.json` | Backlog com status (todo/in_progress/blocked/done), fase, criterio de aceite | **Sempre, no inicio** |
| `.claude/context/chatsessions/` | Registro narrativo por sessao significativa (D-006). `README.md` = formato + indice | Ao retomar; para entender uma decisao passada em detalhe |
| `.claude/docs/governance/decisoes.md` | Log de decisoes D-NNN (arquitetura/infra/processo) — **fonte de verdade quando docs divergirem** | Ao planejar; quando um doc antigo conflita | 
| `.claude/docs/features/specs/` | Specs de design (spec-driven, D-002). `README.md` = template + indice | Antes de implementar qualquer feature |
| `.claude/docs/features/plans/` | Planos/prompts Haiku (H-NNN, threads S/T/U/B). `README.md` = template + indice | Ao executar uma feature |
| `.claude/docs/features/adr/` | ADRs — decisoes de arquitetura extensas (ex.: adr-001 backend) | Ao mexer em arquitetura/infra |
| `.claude/docs/governance/review-checklist.md` | Passo a passo da revisao pre-aprovacao (D-012) | Ao revisar entrega Haiku |
| `.claude/docs/governance/licoes-e-diretrizes.md` | Licoes aprendidas + backlog de UX/pendencias menores | Ao planejar; ao caçar divida tecnica |
| `.claude/docs/architecture/integration-guide.md` | Guia de integracao do backend ⚠️ **DESATUALIZADO** (assume NextAuth; reescrever na thread B) | Só com ressalva; sera reescrito (D-027) |
| `.claude/docs/governance/leilao-reverso-filosofia-e-contexto.md` | Contexto do leilao reverso (Fase 2 / microservico, D-014) | Ao tratar do leilao (fase 2) |
| `.claude/docs/architecture/tokens-legacy.md` | Tokens de design legados | Ao mexer em UI/tokens |

---

## 4. Arquivos de PERSISTENCIA (escrever para atualizar o estado — no encerramento)

| Arquivo | O que gravar | Quem escreve |
|---|---|---|
| `.claude/context/estado/feature_list.json` | Novo status da feature; notas de execucao (commits, decisoes) | Sessao-mae, ao encerrar |
| `.claude/context/estado/progresso.md` | Entrada da sessao: o que foi feito, estado do branch, proximo passo | Sessao-mae, ao encerrar |
| `.claude/context/chatsessions/` + `README.md` | Registro narrativo da sessao (se significativa) + linha no indice | Sessao-mae, ao encerrar sessao significativa |
| `.claude/docs/governance/decisoes.md` | Nova decisao D-NNN (com Why + How to apply) | Sessao-mae, quando uma decisao e tomada |
| `.claude/docs/features/specs/` + `README.md` | Nova spec + linha no indice | Sessao-mae, na fase de design |
| `.claude/docs/features/plans/` + `README.md` | Novo plano/prompt Haiku + linha no indice | Sessao-mae, antes de disparar execucao |
| `.claude/docs/features/adr/` | Novo ADR ou atualizacao de status | Sessao-mae, em decisao de arquitetura |
| **Codigo** (`front/`, futuramente `back/`, `packages/`) | A implementacao | Sessao Haiku (executor), revisada pela mae |

> **Regra:** o `decisoes.md` prevalece quando qualquer doc antigo divergir. `progresso.md` e narrativa;
> `feature_list.json` e o estado maquina-legivel. Os dois sao atualizados juntos no encerramento.

---

## 5. Memoria persistente (FORA do repo — entre sessoes)

A memoria automatica **nao e versionada com o projeto**. Vive na pasta do usuario:

```
C:\Users\romar\.claude\projects\E--Labdev-Projetos-fraldinha-livre\memory\
├── MEMORY.md          ← indice (1 linha por memoria; carregado a cada sessao)
├── <slug>.md          ← 1 fato por arquivo, com frontmatter
└── ...
```

**Formato de cada memoria** (frontmatter + corpo):
```markdown
---
name: <slug-kebab-case>
description: <resumo de 1 linha — usado para decidir relevancia no recall>
metadata:
  type: user | feedback | project | reference
---
<o fato. Para feedback/project: seguir com **Why:** e **How to apply:**. Linkar com [[outro-slug]].>
```

**Tipos:** `user` (quem e o usuario) · `feedback` (como Claude deve trabalhar — com o porque) ·
`project` (trabalho/estado nao derivavel do codigo/git) · `reference` (URLs, dashboards, tickets).

**Quando gravar:** so fatos duraveis e nao-obvios que o repo NAO ja registra (codigo, git, CLAUDE.md).
Ao gravar: checar duplicata (atualizar em vez de duplicar), adicionar 1 linha no `MEMORY.md`.

**Relacao com o repo:** a memoria e o "o que aprendi que nao esta no codigo"; o `progresso.md`/
`decisoes.md` sao o "estado e as decisoes versionadas". Memorias `project` costumam **espelhar** um
ponteiro para o estado do repo (ex.: [[estado-backend-proxima-frente]] aponta para a spec/plano da vez).

> ⚠️ Memorias sao observacoes datadas — se citam um arquivo/linha, **verificar no codigo atual** antes
> de tratar como fato.

---

## 6. Fluxo de um artefato (da ideia ao codigo)

O ciclo de trabalho spec-driven, ponta a ponta:

```
ideia/pedido
   → brainstorming (skill)              → decisao registrada em decisoes.md (D-NNN) / ADR
   → spec em design/specs/ (D-002)      → aprovada pelo cliente
   → plano em design/plans/ (breakdown) → tarefas pequenas (H-NNN ou thread)
   → prompt Haiku por tarefa (D-006)    → executor implementa + auto-testa (D-008)
   → revisao da mae (D-012)             → git show --stat + build + lint proprios
   → feature_list.json + progresso.md   → estado atualizado
   → commit pt-BR                       → (memoria, se fato duravel)
```

---

## 7. Divergencias e lacunas conhecidas

- **RESOLVIDO (2026-08-02, D-040):** o ciclo nao mandava checar defasagem do worktree
  contra `origin/main` antes de confiar em `progresso.md`/`feature_list.json` — uma
  sessao (branch `Romir/fraldinha-livre-app-strategy-309c5a`, worktree criado la pelo
  PR #9) seguiu o passo 1-2 corretamente, mas o worktree ja nascia ~120 commits atras
  do `main` real, entao o "estado do projeto" que ela leu (D-001 a D-029, front "sem
  deploy publico") estava obsoleto havia semanas — faltavam D-030 a D-039, a feature
  010 (notificacoes), a 012 (painel admin) e todo o deploy real de producao. O trabalho
  dela (spec da feature 018, chat-agent de compra) e tecnicamente solido e nao precisou
  ser refeito — so precisava de um passo 0 que agora existe. Ver D-040 em `decisoes.md`.
- ~~`chatsessions/` nao existe no repo.~~ **RESOLVIDO (2026-07-17):** `.claude/context/chatsessions/`
  materializado (README com formato/indice + 1a entrada). A D-006 agora e fiel. Registrar ali toda
  sessao significativa (decisao/spec/plano/marco).
- **Memoria fora do repo.** A memoria automatica (§5) fica na pasta do usuario, nao no git — outra maquina
  ou um clone limpo nao a tem. O `progresso.md`/`decisoes.md` versionados sao o backup durável do estado.
- **`integration-guide.md` desatualizado** (NextAuth) — sera reescrito na thread B (D-027) para o fluxo
  Firebase ID Token → Worker → Drizzle → D1.
- **Harness em Python vs. projeto em Next.js/TS** — o ciclo e o mesmo; os caminhos e a stack diferem
  (dominio em `AGENTS.md`, nao `context/dominio.md`).

---

## 8. Referencia rapida (cola)

**Inicio:** `progresso.md` → `feature_list.json` → spec/plano da feature → `MEMORY.md`.
**Trabalho:** 1 feature · spec-driven · Opus planeja/Haiku executa · verificar (D-008/D-012).
**Fim:** `feature_list.json` + `progresso.md` → memoria (se duravel) → commit pt-BR.
**Duvida sobre decisao:** `decisoes.md` manda. **Duvida sobre revisao:** `review-checklist.md`.
