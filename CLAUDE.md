@AGENTS.md

## Ciclo de sessao (harness de referencia)

Este projeto adota o ciclo de sessao definido em:
https://github.com/romariobc/dev_flow_create_harness (branch: dominio/vendas-b2b, ou main enquanto branch de dominio nao existe)

Antes de qualquer tarefa:
1. Leia context/estado/progresso.md — sabe onde a sessao anterior parou
2. Leia context/estado/feature_list.json — pegue a proxima feature (status: todo)
3. Trabalhe em exatamente 1 feature por sessao
4. Verifique antes de declarar feito — so prova executavel conta
5. Atualize feature_list.json e progresso.md antes de encerrar

Divergencias deste projeto em relacao ao harness: stack Next.js/TypeScript (nao Python); contexto de dominio em AGENTS.md (nao em context/dominio.md).

