# H-001 — Limpeza de documentacao e alinhamento de infra (Google Cloud)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** aguardando execucao
**Tipo:** somente documentacao — NENHUM arquivo de codigo-fonte pode ser alterado.

## Objetivo

Alinhar toda a documentacao ativa do repositorio as decisoes D-001 (infra 100% Google Cloud,
excluir mencoes a Vercel/Azure) e D-005 (caminho canonico `E:\Labdev\Projetos\fraldinha-livre`,
estrutura front/ back/ app/ legacy/). Ver `.claude/docs/decisoes.md`.

## Contexto minimo

- Projeto: marketplace de fraldas com licitacao reversa (fornecedores competem por pedidos).
- Frontend Next.js 16 + React 19 + TypeScript em `front/`, roda com `cd front && npm run dev`.
- Backend ainda nao existe (`back/` vazio); app mobile futuro (`app/`); `legacy/` e historico e NAO deve ser tocado.
- Infra decidida: Google Cloud, custo minimo, serverless (Cloud Run, Firestore, Cloud Storage, Firebase Auth/Identity Platform).

## Tarefas (nesta ordem)

1. **Reescrever `README.md` (raiz)** em pt-BR, substituindo o boilerplate do create-next-app:
   - O que e o projeto (2-3 paragrafos: marketplace de fraldas, modelo de licitacao reversa, dois perfis: comprador e fornecedor).
   - Estrutura de pastas (front/, back/, app/, legacy/, .claude/ — uma linha cada).
   - Como rodar: `cd front && npm install && npm run dev` (http://localhost:3000).
   - Stack: Next.js 16, React 19, TypeScript, Tailwind 3, shadcn/Base UI; dados mock em `front/src/lib/` (backend pendente).
   - Infra alvo: Google Cloud (uma linha, referenciar `.claude/docs/decisoes.md` D-001).
   - PROIBIDO mencionar Vercel ou Azure.

2. **Deletar `.claude/docs/backend/plan-session01.md`** (plano Azure superado pela D-001).

3. **Corrigir `.claude/docs/backend/integration-guide.md`:**
   - Linha ~11: trocar `E:\ROMARIO PC\fraldinha-livre\.env.local` por `E:\Labdev\Projetos\fraldinha-livre\front\.env.local`.
   - Linha ~27: trocar a frase sobre producao (`https://fraldinha-livre.com` esta ok, manter) removendo qualquer implicacao de deploy Vercel se houver.
   - Adicionar no topo, logo abaixo do titulo, o aviso:
     `> **Infra:** frontend e backend hospedados no Google Cloud (Cloud Run) — ver .claude/docs/decisoes.md D-001. Provedor de auth do backend sera definido na feature 005.`
   - NAO alterar o restante do conteudo tecnico (NextAuth, endpoints, seeds).

4. **Verificacao final:** rodar busca case-insensitive por `vercel` e `azure` em: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/docs/**`, `.claude/context/**`, `front/` (excluindo `node_modules`). Se sobrar alguma mencao fora de `legacy/` e `node_modules`, remover/ajustar e listar no relatorio.

5. **Commit** (um unico commit, pt-BR):
   `docs: alinha documentacao a infra Google Cloud e corrige caminhos (D-001, D-005)`

## Testes e verificacao (OBRIGATORIO — D-008)

Executar ANTES do relatorio final:

1. Busca case-insensitive por `vercel` e `azure` nos caminhos do item 4 — resultado esperado: 0 ocorrencias fora de `legacy/` e `node_modules`.
2. Conferir cada item do checklist de criterios de aceite abaixo, um a um.
3. Confirmar que `git status` mostra APENAS os arquivos previstos (README.md, integration-guide.md, plan-session01.md deletado).

**Loop de encerramento:** se alguma verificacao falhar, corrija e re-verifique — MAXIMO 3 TENTATIVAS.
Apos a 3a falha: PARE. Nao improvise nem mude a abordagem. Relate o que falhou, o que tentou
em cada tentativa e o estado atual dos arquivos.

## Criterios de aceite

- [ ] `grep -ri "vercel\|azure"` retorna 0 resultados em README.md, AGENTS.md, CLAUDE.md, .claude/docs/, .claude/context/ e front/src/
- [ ] README.md novo em pt-BR com as 5 secoes pedidas
- [ ] plan-session01.md deletado
- [ ] integration-guide.md com caminho novo e aviso de infra no topo
- [ ] Nenhum arquivo em `front/src/`, `legacy/`, `back/`, `app/` alterado
- [ ] 1 commit com a mensagem especificada

## Restricoes

- NAO tocar em codigo-fonte (`front/src/**`), `legacy/**`, `node_modules`, historico git.
- NAO tomar decisoes de arquitetura — qualquer duvida, parar e relatar.
- Commits em portugues brasileiro, Conventional Commits.

## Relatorio esperado ao final

Lista de arquivos alterados/deletados, resultado da busca de verificacao (item 4), e qualquer mencao a Vercel/Azure que voce encontrou e NAO removeu (com justificativa).
