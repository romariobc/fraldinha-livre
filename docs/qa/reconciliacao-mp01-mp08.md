# Reconciliação MP-01–MP-08 — 05/11/2026

Preparação autorizada de uma integração consolidada, sem merge, publicação, migração remota ou aprovação implícita de MP-08. Datas em America/Fortaleza. Compra, pagamento e entrega permanecem simulados.

## Entradas e estratégia

Após fetch, `origin/main` foi reconfirmada em `d5b64c97d58055e6ce89056687bfe69fa9571870`; a entrega acumulada está em `4236d3eeb6377e475f1f0facbbedfaf776a89f00`. Antes das alterações desta sessão, `git rev-list --left-right --count origin/main...HEAD` retornou `0 9`. A principal é ancestral: não existe conflito textual entre essas entradas. Isso não demonstra, por si, equivalência semântica das PRs antigas.

Branch de integração: `codex/reconcile-mp01-mp08`, criada diretamente do MP-08 em worktree separado. Preservar os nove commits acumulados e recuperar apenas contribuição comprovadamente ausente; não reaplicar as PRs antigas em sequência. Main local e remota não são modificadas.

Os sete worktrees foram inventariados: CTX-01 tinha 73 alterações preexistentes; os demais estavam limpos na inspeção inicial. Nenhum desses diretórios foi movido, resetado, sobrescrito ou excluído.

## Matriz das entregas

PRs #22–#29 abertas, em rascunho, base main. Seus textos de aprovação descrevem marcos históricos; o backlog vigente mantém MP-00–07 aprovados e MP-08 aguardando aprovação.

| Marco | PR / head original | Relação com MP-08 e decisão | Conteúdo e evidência a preservar |
|---|---|---|---|
| MP-00 | Registro documental | Consolidado; não reabrir contrato de produto | Backlog/feature_list mantêm regras, critérios e aprovações |
| MP-01 | [#22](https://github.com/romariobc/fraldinha-livre/pull/22) / `f88027f27a29cd420029dac1873a484598211333` | Não ancestral; conteúdo consolidado | Tooling preservado entre MP-03 e c12d4db; validation.yml/run-checks.mjs acrescentam apenas teste de contexto nessa comparação |
| MP-02 | [#23](https://github.com/romariobc/fraldinha-livre/pull/23) / `580f2d857ea8d4ca4c44185444f8f17f5d1cc0e8` | Não ancestral; consolidado e evoluído | Backend/contratos idênticos entre MP-03 e c12d4db; diálogo de cancelamento preservado; testes D1 de atomicidade/concorrência/replay |
| MP-03 | [#24](https://github.com/romariobc/fraldinha-livre/pull/24) / `17db34e632ba8dff3cf8f53747f7cd3f57a3a2d8` | Não ancestral; conteúdo consolidado | Backend/contratos sem diferença até c12d4db; cadastro/login/onboarding/recuperação, auth-context e AdminSupplierApprovals idênticos |
| CTX-01 | `c12d4dbfe4b43e4721c68d70a684fa34ae5f29e0` | Ancestral preservado | Checkout/tabela decompostos; tipos fora de fixtures; adapters; compat movidos com similaridade 100%; contexto seletivo |
| MP-04 | [#25](https://github.com/romariobc/fraldinha-livre/pull/25) / `251cb25ec37678d8dcde10c27e97e207a33becea` | Ancestral; não reaplicar | Catálogo, moderação, preço/estoque; migração 0014 e legado |
| MP-05 | [#26](https://github.com/romariobc/fraldinha-livre/pull/26) / `7ad88a9d7d5dc5aad512d653846eec3944370c68` | Ancestral; não reaplicar | Checkout/replay por fornecedor/UID; migração 0015 sem promover pagamento legado |
| MP-06 | [#27](https://github.com/romariobc/fraldinha-livre/pull/27) / `3463cfdc2275c3b0a5c6e2d7e1ffcea5d02a748c` | Ancestral; não reaplicar | Snapshot, histórico, refresh e isolamento após troca de conta |
| MP-07 | [#28](https://github.com/romariobc/fraldinha-livre/pull/28) / `a0984bf9fff8b3f69867997ec158433c3f612278` | Ancestral; orientação provisória de ocorrência superada | Operações por papel/estado, motivo e reconciliação de conflito |
| MP-08 | [#29](https://github.com/romariobc/fraldinha-livre/pull/29) / `4236d3eeb6377e475f1f0facbbedfaf776a89f00` | Ponta acumulada escolhida; aprovação humana pendente | Ocorrências, respostas, resolução/replay/concorrência; reports preservados na migração 0016 |

Comparações executadas: ancestralidade dos sete heads anteriores; nomes/status/blobs entre MP-03 e c12d4db; diff frontend, tipos/adaptadores, providers e Header. As diferenças relevantes do frontend são extração CTX-01, redirecionamento de imports/tipos e ajuste administrativo `1322ac6`, já presente na linha consolidada. Não foi identificada contribuição exclusiva ausente a reaplicar. Identidade de blobs se refere somente à comparação indicada; os MPs posteriores evoluem o código, cuja preservação comportamental depende das regressões.

O diff acumulado original tinha 239 arquivos; MP-08 isolado tinha 29. Não houve resolução global ours/theirs. Relatórios históricos permanecem; arquitetura/guia API vigentes deixam de orientar indisponibilidade de ocorrências como comportamento atual. O estado anterior foi copiado integralmente para `context/estado/progresso-ate-mp08-2026-11-05.md`.

## Automação e proteções verificadas

- Main exige PR, branch atualizada (strict), check `validate / Validation required` do GitHub Actions (app 15368) e conversas resolvidas; aplica a administradores. Force-push/exclusão negados, zero aprovações externas exigidas. Rulesets vazios na investigação inicial; nada alterado remotamente.
- Environments Production, Preview e github-pages sem regras de proteção/política de branch. O nome Production no YAML não comprova aprovação humana. Webhooks do repositório: zero na consulta administrativa.
- Origin/main e MP-08 publicam por push em main: D1 `--remote`, backend e frontend. A proteção de merge não impede essa publicação.
- Cloudflare: conta acessível sem projetos Pages; Workers backend, backend-homologacao e frontend sem triggers Workers Builds. Somente metadados de automação lidos; nenhum banco remoto consultado/modificado.
- Vercel: deployments históricos pelo bot. Conector sem equipes/projetos; CLI com 11 projetos em romariobcs-projects, nenhum ligado a romariobc/fraldinha-livre. Evidência restrita ao escopo acessível; reconfirmar antes do envio.

Mudança escolhida pelo usuário: somente workflow_dispatch para produção, confirmação booleana obrigatória com padrão false, gate de evento/confirmação antes da validação e verificação de ref main. Migração/deploy dependem da validação do mesmo SHA e conservam environment Production. Homologação continua manual separada, sem acionamento nesta sessão. Nenhuma configuração remota ou secret é alterado.

No YAML proposto, um merge não dispara produção por push. Antes de merge futuro, reconfirmar base, diff de workflows e integrações externas. Dispatch manual continua aplicando migrações/publicando e exige autorização operacional própria. Não usar falta de secrets ou CI vermelha como bloqueio.

## Validação desta reconciliação

A CI herdada foi reconfirmada: MP-01–03 com 11 checks aprovados por PR; MP-04–08 com 12. Isso não comprova o resultado da reconciliação.

| Critério | Verificação | Resultado |
|---|---|---|
| Contratos, autorização, transações, estoque, replay, histórico e ocorrências | Harness completo com testes/tipos/lint/build | Pendente |
| Migrações e legado | D1 local novo até 0016 e fixtures de upgrade nas suítes existentes | Pendente |
| Publicação manual e bloqueio após falha | Regressões de CI e lint de workflows | Pendente |
| Jornada entre papéis | Navegador autenticado com API/D1 local novo | Pendente |
| Documentação | Context check, JSON, links, diff e histórico preservado | Pendente |
| CI final | Checks do SHA final, incluindo container | Pendente |

## Retorno, PRs anteriores e parada

Checkpoints exclusivos de entrada:

- `checkpoint/pre-reconcile-main-2026-11-05` → `d5b64c97d58055e6ce89056687bfe69fa9571870`.
- `checkpoint/pre-reconcile-mp08-2026-11-05` → `4236d3eeb6377e475f1f0facbbedfaf776a89f00`.
- Checkpoint do resultado: criar após validação/CI, sem mover tags existentes.

Para inspecionar uma entrada sem alterar trabalho posterior: fetch da tag e `git worktree add --detach <diretorio-novo> <tag>`. Para desfazer integração compartilhada: PR de revert revisada, preservando a separação de publicação para não restaurar deploy automático. Não reescrever main. Tags recuperam código/documentação, não banco, secrets, configuração, identidade ou backup operacional.

Manter #22–#29 abertas durante a revisão. Após aprovação explícita da reconciliação, de MP-08 e do merge, propor fechamento como substituídas, com referência à matriz e à PR consolidada; não executar o fechamento nesta sessão.

Pendências distintas: reconciliação/CI; aprovação humana de MP-08; autorização de merge; operação/backup/legado; publicação/homologação. MP-09–12 não são implementados por esta tarefa. Parar antes do merge, encerramento de PRs, exclusão de branches ou alteração remota de configurações.
