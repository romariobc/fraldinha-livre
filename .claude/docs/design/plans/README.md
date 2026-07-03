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
| H-004 | Compra direta multi-vendedor (feature 014) | 1 | redigido — executar apos H-005 |
| H-006 | Remove codigo morto (013/RN-06) + conserta lint do MarketTable | 1 | APROVADO (commit 1355e51) via D-012 — branch verde (build+lint) |
| H-003 | Bugs da loja (catalogo ?page, busca 'todos', hydration mocks) | 1 | a redigir (Header flag ja resolvido pela 005a) |

**Ordem de execucao (D-011):** H-002 → H-005 → [H-006 limpeza para main] → H-004 → H-003 → 006 backend.

**Nota (2026-07-02):** verificacao pre-main revelou que o H-002 NAO removeu o codigo morto (RN-06)
apesar do relatorio afirmar — erro de revisao da sessao-mae (confiou no relatorio sem conferir as
delecoes no commit). Alem disso `npm run lint` falha por MarketTable.tsx:34. H-006 fecha ambos.
Licao: sempre conferir delecoes no `git show --stat` do commit, nao no relatorio do executor.
