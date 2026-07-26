# Plans / Prompts Haiku — Fraldinha Livre

> Cada arquivo `H-NNN-<tema>.md` e um prompt completo para uma sessao Haiku executar.
> A sessao-mae escreve, o Haiku executa, a sessao-mae revisa e aprova (D-006).
> Nenhum prompt de codigo sem spec aprovada em `../specs/` (spec-driven, D-002).
> **Revisao de entrega: obrigatorio seguir `../review-checklist.md` (D-012) — nunca aprovar so pelo relatorio.**

## Estrutura obrigatoria de todo prompt

```markdown
# H-NNN — <titulo>

**Executor:** sessao Haiku | **Autor:** sessao-mae (data) | **Status:** aguardando execucao / executado / aprovado
**Spec:** caminho da spec aprovada (ou "somente docs — sem spec")

## Objetivo
1-2 frases; o que muda e por que.

## Contexto minimo
So o que o Haiku precisa para nao desviar (stack, pastas, decisoes D-NNN relevantes).

## Passo 0 — OBRIGATORIO antes de qualquer arquivo (desde 2026-07-22, achado da revisao de P1)
Confirmar o diretorio de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser o worktree especificado neste prompt (ver "Contexto minimo"), NUNCA o repo
principal (`E:\Labdev\Projetos\fraldinha-livre` sem `.claude\worktrees\...`). Se nao bater, PARAR e
relatar antes de continuar — nao criar nem commitar nada no lugar errado. (Ja aconteceu um executor
commitar no repo principal por engano, avancando a `main` local sem revisao — ver
[[feedback-verificar-diretorio-commit-executor]] na memoria do projeto.)

## Tarefas (nesta ordem)
Passos pequenos e numerados, com caminhos exatos de arquivos.

## Testes e verificacao (OBRIGATORIO — D-008)
Executar ANTES do relatorio, nesta ordem:
1. `cd front && npm run lint` (quando houver mudanca de codigo)
2. `cd front && npm run build` (quando houver mudanca de codigo)
3. Verificacoes especificas do prompt (greps, criterios de aceite testaveis)

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MAXIMO 3 TENTATIVAS.
Apos a 3a falha: PARE. Nao improvise, nao mude a abordagem por conta propria.
Relate o que falhou, o que tentou em cada tentativa e o estado atual dos arquivos.

## Criterios de aceite
Checklist verificavel — so prova executavel conta.

## Restricoes
O que NAO pode ser tocado; sem decisoes de arquitetura; commits em pt-BR (Conventional Commits).

## Relatorio esperado
Arquivos alterados, resultado de cada verificacao, pendencias.
```

## Indice

| Prompt | Tema | Fase | Status |
|---|---|---|---|
| H-001 | Limpeza docs/infra (Google Cloud, caminhos, README) | — | APROVADO (commit 027edaf, revisado 2026-07-02) |
| H-002 | Gating do leilao (feature 013) + codigo morto | 1 | APROVADO (commit 61396e0, revisado 2026-07-02) |
| H-005 | Auth Google via Firebase (feature 005a) | 1 | DONE — validado pelo cliente no navegador (2026-07-02) |
| H-004 | Compra direta multi-vendedor (feature 014) | 1 | CODIGO APROVADO (317838e + fix 5f84450) via D-012 — aguardando validacao humana no navegador |
| H-006 | Remove codigo morto (013/RN-06) + conserta lint do MarketTable | 1 | APROVADO (commit 1355e51) via D-012 — branch verde (build+lint) |
| H-007 | Area do cliente real: perfil Firestore + travas de seguranca (feature 007a) | 1 | CODIGO APROVADO (af54380 + fix fc01a82) via D-012; regra Firestore deployada; aguarda validacao humana |
| H-008 | Footer condicional + correcao de links + paginas 'Em construcao' (feature 015) | 1 | APROVADO (f87b84f) via D-012 — branch verde |
| H-009 | Fix mascaras/limite de CPF e telefone no perfil (feature 007a) | 1 | APROVADO (65d2e43) via D-012 — cap+mascara verificados por leitura; lint 0 |
| H-003 | Bugs da loja (catalogo ?page, busca 'todos', hydration, esqueci-senha, EmConstrucao) | 1 | APROVADO (b6c4e6c) via D-012 — lint 0, build ok |
| B (breakdown) | Backend de pedidos (Cloudflare Workers + D1) — fatia 1, tarefas B1..B9 | 1 | breakdown APROVADO (2026-07-17); prompts B1..Bn a escrever no disparo |
| B1 | packages/contracts: schemas Zod de Order/OrderItem/Address | 1 | APROVADO (commit b908dfe) via D-012 pela sessão de frontend |
| B2 | back/: scaffold Worker Hono + D1 + migration de pedidos | 1 | APROVADO (commits b6aa44b, 44aa81a, aa5d4e1) via D-012 pela sessão de frontend — incluindo D1 real criado via MCP |
| B3 | back/: auth Firebase ID Token + GET /orders | 1 | APROVADO (commits 2af35f6, 20c62dc) via D-012 pela sessão de frontend |
| B4 | back/: POST /orders + PATCH /orders/:id/cancel | 1 | APROVADO (commit 6309a1e) via D-012 pela sessão de frontend |
| B5 | front/: OrderRepository (porta) + MockOrderRepository | 1 | APROVADO (commit 5ba3b81) via D-012 pela sessão de frontend |
| B6 | front/: contract test reutilizável runOrderRepositoryContract | 1 | APROVADO (commit 4b18648) via D-012 pela sessão de frontend |
| B7 | front/: HttpOrderRepository + api-client | 1 | APROVADO (commits a8ea692, fa32b6f) via D-012 pela sessão de frontend — verificação linha a linha do fix zod |
| B8 | front/: OrdersProvider assíncrono + loading/erro + flag backend | 1 | APROVADO (commit 3299c98) via D-012 pela sessão de frontend |
| B9 | Deploy real do Worker + validação humana (fatia 1 = Pedidos) | 1 | FECHADO (2026-07-21) — produção validada, PR #8 mesclado na main (13ad06b) |
| P (breakdown) | Backend de produtos (fatia 2 da 006) — P1/P2/P3 | 1 | breakdown APROVADO (2026-07-22, com P3 adicionado na revisão) |
| P1 | back/: schema products + migrations + seed + GET /products | 1 | APROVADO (commits 6a0c9f4, ed1e9bb, 7d08f46) via D-012 — incidente de commit no repo errado corrigido; ressalva do seed resolvida com teste-sensor |
| P2 | back/: POST /orders revalida preco/existencia/fornecedor | 1 | APROVADO (commit 256d22a) via D-012 |
| P3 | Deploy real do Worker + migrations remotas + validação humana (fatia 2 = Produtos) | 1 | FECHADO (2026-07-23) — produção validada pelo cliente (checkout completo), registro em feature_list.json/integration-guide.md feito |
| H-010 | Deploy do frontend via Cloudflare Containers (substitui adapter OpenNext, spec commit c2952b2) | — | PRONTO para disparo (2026-07-25) — 2 correções da sessão-mãe sobre a spec: `max_instances` (não `instances`) e caminho do standalone verificado com build real |
| C (breakdown) | Catálogo do Fornecedor: CRUD de produtos + sync do painel (feature 007) — C1..C11 | 1 | breakdown APROVADO (2026-07-25); prompts C1..Cn a escrever no disparo |
| C1 | packages/contracts: ProductSchema/CreateProductRequestSchema/UpdateProductRequestSchema | 1 | APROVADO (commit 32a4ae7) via D-012 — 15/15 testes verdes, tsc 0, escopo confere |
| C2 | back/: schema products estendido + migrations 0003/0004 | 1 | APROVADO (commits c4ae8dd + 46f4d05, executado pela sessao de backend) via D-012 — bug de migration achado e corrigido (D-031), 35/35 testes verdes, sqlite3 isolado confirma 24 produtos |
| C3 | back/: GET /products filtra active + GET /products?scope=fornecedor | 1 | APROVADO (commits 70b9ee0 + 627a86a, executado pela sessao de backend) via D-012 — 39/39 testes verdes, tsc 0, escopo confere |

**Ordem de execucao (D-011):** H-002 → H-005 → [H-006 limpeza para main] → H-004 → H-003 → 006 backend.

**Nota (2026-07-02):** verificacao pre-main revelou que o H-002 NAO removeu o codigo morto (RN-06)
apesar do relatorio afirmar — erro de revisao da sessao-mae (confiou no relatorio sem conferir as
delecoes no commit). Alem disso `npm run lint` falha por MarketTable.tsx:34. H-006 fecha ambos.
Licao: sempre conferir delecoes no `git show --stat` do commit, nao no relatorio do executor.
