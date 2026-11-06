# Estado atual — 2026-11-05

## Reconciliação MP-01–MP-08 preparada para revisão

- Branch `codex/reconcile-mp01-mp08`, worktree isolado, entrada MP-08 `4236d3e`; `origin/main` `d5b64c9` é ancestral, com nove commits acumulados antes desta sessão. Sem reaplicar PRs antigas ou importar alterações preexistentes do worktree CTX-01.
- [Matriz e evidências da reconciliação](../../docs/qa/reconciliacao-mp01-mp08.md): MP-04–07 são ancestrais; MP-01–03 foram consolidados no checkpoint `c12d4db`, com conteúdo preservado/evoluído. PRs #22–#29 abertas em rascunho.
- Proposta de produção: somente disparo manual com confirmação obrigatória (padrão false), main e validação do mesmo SHA antes de migração/deploy. Ainda sem efeito na main. Production remoto sem proteção de environment; nenhuma configuração remota alterada.
- [PR #30](https://github.com/romariobc/fraldinha-livre/pull/30) em rascunho. Harness com build aprovado: 1.266 testes, tipos, lint sem erros/oito avisos. Catálogo, sete grupos de checkout, quatro de operações e quatro de ocorrências passaram em navegador; migrações até 0016 em D1 novo. QA comercial local, sem AI/notificações externas; servidores encerrados. CI final/SHA/checkpoint devem ser conferidos na PR antes do merge.
- Checkpoints de entrada: `checkpoint/pre-reconcile-main-2026-11-05` → `d5b64c9`; `checkpoint/pre-reconcile-mp08-2026-11-05` → `4236d3e`. Resultado: `checkpoint/reconcile-mp01-mp08-2026-11-05`, publicar/conferir somente após CI da ponta. Tags recuperam código/documentação, não banco/configuração/credenciais.

## Aprovações e limites preservados

- MP-00–07 aprovados. MP-08 tecnicamente entregue, aguardando aprovação humana; migração 0016 somente validada localmente. A reconciliação não aprova MP-08 nem autoriza MP-09.
- Compra/pagamento/entrega simulados. Ocorrências persistidas sem alterar pedido/estoque; recuperação de envio incerto limitada ao componente montado. Pedidos sem fornecedor persistido exigem reconciliação para novas ocorrências; reports antigos preservam acesso por snapshot.
- Cadastro/recuperação de identidade, operação/backup/legado e publicação/homologação pendentes das etapas próprias. Preparação/CI não comprovam operação em produção.
- Parada antes de merge, fechamento de PRs antigas, exclusão de branches ou alteração de publicação/proteção remota. Deploy/migração remota não autorizados.

## Contexto seletivo

[Arquitetura](../../docs/architecture/arquitetura-vigente.md), [backlog](../../docs/BACKLOG-FASES.md), pacote `order-occurrences`. [Estado MP-08 preservado integralmente](progresso-ate-mp08-2026-11-05.md), [MP-07](progresso-ate-mp07-2026-11-04.md), [MP-06](progresso-ate-mp06-2026-11-04.md).
