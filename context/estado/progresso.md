# Estado atual — 2026-09-23

## Marco corrente

Harness comum em AGENTS.md e .agents/, documentação em docs/ e estado em context/. QA exige evidência por critério, cenários negativos e distinção entre revisão concluída e aprovação. Estado remoto da infraestrutura Cloudflare D1 e Workers verificado. [Relatório QA AUDIT-001](../../docs/qa/AUDIT-001-QA-relatorio.md).

## Resultado de infraestrutura e local

- **Migration D1 remota**: `0010_audit_logs.sql` verificada e confirmada como aplicada no D1 remoto `fraldinha-livre-db` (`applied_at: 2026-09-22 15:17:53 UTC`). Tabela `audit_logs` e 4 índices existem e estão íntegros. `wrangler d1 migrations apply DB --remote` e `migrations list` confirmam ausência de migrações pendentes.
- **Deployments Cloudflare**: Backend (`fraldinha-livre-backend`, versão `3778249a...`) e Frontend Container (`fraldinha-livre-frontend`, versão `22a641b4...`) permanecem com deployments ativos de `2026-09-21`.
- **Defasagem identificada**: O Worker ativo em produção NÃO contém as correções atômicas e paginação SQL consolidadas no commit `3fbde48` (2026-09-22). O banco está preparado; o código necessita de deploy quando autorizado.
- **Pipeline CI/CD**: Diagnosticado que `.github/workflows/cloudflare-deploy.yml` executa apenas `wrangler deploy` sem migrações D1. Proposta com diff registrada no relatório de QA.
- **AUDIT-001-QA local**: Revisão local concluída anteriormente (909 testes verdes, tipos dos 3 workspaces limpos, lint 0 erros/19 avisos).
- **Regras Firestore (`firestore.rules`) e Segurança de Identidade**: Endurecidas as regras `allow create` e `allow update` em `users/{uid}` com restrição a `comprador` e `fornecedor`, `hasOnly()`, validação estrita de tipos e tamanhos de campos e bloqueio de exclusão. No frontend (`auth-context.tsx`), `isAdmin` e permissões de UI foram desacoplados de `data.role` e condicionados estritamente a Custom Claims verificadas (mantido fallback temporário de UID). **Regras publicadas com sucesso no Firebase produção** (Ruleset `da8cfd7c-6472-480e-a23b-8094964ed4e1` liberado em `2026-09-23T11:06:15Z`). Suítes de testes ampliadas para 933 testes (41 contracts, 274 back, 618 front), todos 100% verdes, com `tsc` e `eslint` limpos.

## Continuidade

- AUDIT-001 permanece in_progress: deploy do Worker backend e frontend pendentes de autorização; homologação funcional com claims reais de admin em produção necessária após o deploy.
- Feature 011: gateway real pendente. 010 e 018 in_progress; 008 bloqueada. Confirmar evidência atual antes de retomar esses itens.
- Demais critérios em [feature_list.json](feature_list.json). Histórico da consolidação em [progresso-historico.md](progresso-historico.md).

## Próxima sessão

Atender à tarefa autorizada. Para AUDIT-001: efetuar deploy do Worker backend e frontend quando autorizado, executar homologação funcional com token admin em produção e aplicar correção no workflow de deploy via PR. Não há agendamento ativo.
