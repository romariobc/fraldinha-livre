# Estado atual — 2026-11-05

## Reconciliação MP-01–MP-08 em preparação

- Branch `codex/reconcile-mp01-mp08`, worktree isolado, entrada MP-08 `4236d3e`; `origin/main` `d5b64c9` é ancestral, com nove commits acumulados antes desta sessão. Sem reaplicar PRs antigas ou importar alterações preexistentes do worktree CTX-01.
- [Matriz e evidências da reconciliação](../../docs/qa/reconciliacao-mp01-mp08.md): MP-04–07 são ancestrais; MP-01–03 foram consolidados no checkpoint `c12d4db`, com conteúdo preservado/evoluído. PRs #22–#29 abertas em rascunho.
- Proposta de produção: somente disparo manual com confirmação obrigatória (padrão false), main e validação do mesmo SHA antes de migração/deploy. Ainda sem efeito na main. Production remoto sem proteção de environment; nenhuma configuração remota alterada.
- Validação em andamento; resultados locais/CI finais serão registrados antes do encerramento. QA comercial somente em API/D1 locais separados, sem binding AI e notificações externas.
- Checkpoints de entrada: `checkpoint/pre-reconcile-main-2026-11-05` → `d5b64c9`; `checkpoint/pre-reconcile-mp08-2026-11-05` → `4236d3e`. Tags recuperam código/documentação, não banco/configuração/credenciais.

## Aprovações e limites preservados

- MP-00–07 aprovados. MP-08 tecnicamente entregue, aguardando aprovação humana; migração 0016 somente validada localmente. A reconciliação não aprova MP-08 nem autoriza MP-09.
- Compra/pagamento/entrega simulados. Ocorrências persistidas sem alterar pedido/estoque; recuperação de envio incerto limitada ao componente montado. Pedidos sem fornecedor persistido exigem reconciliação para novas ocorrências; reports antigos preservam acesso por snapshot.
- Cadastro/recuperação de identidade, operação/backup/legado e publicação/homologação pendentes das etapas próprias. Preparação/CI não comprovam operação em produção.
- Parada antes de merge, fechamento de PRs antigas, exclusão de branches ou alteração de publicação/proteção remota. Deploy/migração remota não autorizados.

## Contexto seletivo

[Arquitetura](../../docs/architecture/arquitetura-vigente.md), [backlog](../../docs/BACKLOG-FASES.md), pacote `order-occurrences`. [Estado MP-08 preservado integralmente](progresso-ate-mp08-2026-11-05.md), [MP-07](progresso-ate-mp07-2026-11-04.md), [MP-06](progresso-ate-mp06-2026-11-04.md).
