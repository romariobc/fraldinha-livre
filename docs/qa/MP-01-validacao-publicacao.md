# MP-01 — Validação e publicação previsíveis

Implementação: 26/10/2026; consolidação: 29/10/2026 (America/Fortaleza). Etapa autorizada pelo usuário após aprovação do MP-00. O MP-02 não está autorizado.

## Base, escopo e preservação

- Checkout principal examinado: `1322ac6`. As alterações documentais não commitadas do MP-00 já existiam e foram preservadas.
- Após fetch, `origin/main` era `d5b64c97d58055e6ce89056687bfe69fa9571870`; a main local estava zero commits atrás e um à frente. Esse commit anterior contém alterações de aplicação que não pertencem ao MP-01.
- A branch `codex/mp-01-validation-gates`, no worktree `E:/Labdev/Projetos/.worktrees/fraldinha-mp01`, parte de origin/main e recebe apenas os caminhos de CI, scripts, manifestos e documentação desta entrega. O checkout principal e seu commit anterior não são resetados nem incluídos implicitamente na PR.
- Nenhum deploy, migração, alteração de segredo ou merge é parte desta validação. A PR em rascunho existe para revisão e execução dos checks hospedados.

## Comportamento entregue

1. PRs para main usam `.github/workflows/validation.yml`: nove verificações em matriz e build da imagem frontend. Sem filtro de caminhos e sem credenciais Cloudflare no workflow de validação.
2. Produção chama o mesmo workflow no próprio run. `deploy` depende de validação aprovada antes de aplicar migrações ou publicar. `check-ref` rejeita execução manual fora de main. Checkout usa `github.sha`, sem credenciais Git persistidas.
3. `Validation required` executa com `always()` e só aprova se testes e build forem `success`; falha, cancelamento, skip ou ausência de resultado são rejeitados pelo comando real `scripts/ci-gate.mjs`.
4. O antigo deploy automático de homologação foi separado em workflow manual, com confirmação inicialmente falsa, mesma validação e ambiente próprio. Executar testes ou abrir PR não publica homologação.
5. `run_checks.ps1` executa somente inspeção de recursos e QA. `scripts/run-checks.mjs` interrompe no primeiro erro, conserva o código de saída e fixa o diretório a partir do próprio arquivo. `-Build` acrescenta build local; o CI sempre exige a imagem Docker.
6. `check_resources.ps1` consulta espaço no volume do projeto e em C quando disponível; avisa ou falha, sem limpar arquivos. Os dois scripts antes eram locais/ignorados e passam a integrar o versionamento.
7. `.dockerignore` exclui arquivos de ambiente locais e `.dev.vars`, preservando apenas os dois arquivos públicos de configuração de produção já versionados. Os nomes das chaves desses arquivos foram inspecionados: todos começam com `NEXT_PUBLIC_`; valores não foram registrados no relatório.

## Testes de segurança do processo

`scripts/ci-safety.test.mjs` executa nove testes: código de saída do gate real, parada em cada verificação com falha, executável ausente/interrupção, ausência de publicação no runner, build explícito, política de PR, dependência de produção/mesma revisão, homologação manual e comportamento PowerShell/recursos. As asserções de configuração também comparam os comandos locais e os comandos efetivamente declarados na matriz do CI.

`js-yaml` foi declarado como dependência de desenvolvimento direta, na versão já instalada (4.3.1), para ler os workflows nos testes. Não houve atualização ampla de dependências.

## Inspeção remota inicial (26/10) e proteção aplicada (29/10)

| Consulta | Resultado nesta sessão | Implicação |
|---|---|---|
| Proteção da branch main | API retornou 404 `Branch not protected` | Um check declarado no YAML não se torna obrigatório para merge automaticamente. |
| Rulesets do repositório | Lista vazia | Não foi identificada regra alternativa de proteção. |
| GitHub Actions | Habilitado, ações permitidas | A execução hospedada pode ser validada pela PR. |
| Environments | `Production`, `Preview`, `github-pages`, sem regras de proteção retornadas | O workflow reutiliza o nome `Production`; o simples nome não comprova aprovação manual. |

Após aprovação dos 11 jobs do run hospedado, a proteção da main foi aplicada e relida pela API: PR obrigatória; check `validate / Validation required` vinculado ao GitHub Actions (app 15368); branch atualizada exigida (`strict=true`); aplicação também a administradores; conversas resolvidas; force-push e exclusão negados. O nome do check foi confirmado no run, sem inferência pelo YAML. Não foi exigida aprovação de outro revisor (`required_approving_review_count=0`); a aprovação da etapa pelo usuário e o merge continuam pendentes. Environments e segredos não foram alterados.

## Matriz por critério

| Critério | Evidência | Resultado | Limitação |
|---|---|---|---|
| Rejeitar falha, cancelamento e skip | Subprocesso real do gate nos testes | Passou localmente | Não executa migração/deploy de propósito. |
| QA para na primeira falha | Injeção de falha em cada posição e erros de processo | Passou localmente | Demais comandos simulados nesses testes específicos. |
| YAML e semântica Actions | `actionlint` 1.7.12 em contêiner | Passou, exit 0 | Não comprova resultado de runner hospedado. |
| Sintaxe PowerShell | Parser AST dos dois scripts | Passou | Execução completa registrada abaixo. |
| Suítes/tipos/lint via novo runner | `pwsh -NoProfile -File ./run_checks.ps1` | Passou, exit 0 em 29/10: 1.105 testes, tipos dos três workspaces e 0 erros/11 avisos no lint | 711 front + 296 back + 57 contratos + 32 runner + 9 segurança; log local em docs/qa-artifacts/mp01-qa-2026-10-29.log (ignorado pelo Git). |
| Imagem de produção | `docker build -f front/Dockerfile -t fraldinha-livre-frontend:mp01 .` | Passou, exit 0, confirmado em 29/10 | Contexto final exclui .env.local; repetição de 29/10 usou cache válido. |
| CI no GitHub | [PR #22](https://github.com/romariobc/fraldinha-livre/pull/22), [run 40849415706](https://github.com/romariobc/fraldinha-livre/actions/runs/40849415706), candidato `9b3f70f` | 11 jobs aprovados | Inclui subprocesso negativo real do gate e assertions do grafo; nenhum deploy foi tentado. |
| Proteção de merge | PUT seguido de GET da API em 29/10 | Aplicada e verificada | PR e check obrigatório, inclusive admins; sem merge ou publicação. |

## Resultado consolidado do CI

O run 40849415706 aprovou 11 jobs: 709 testes front, 296 back, 57 contratos, 32 runner e 9 de segurança do processo (**1.103 testes**), tipos dos três workspaces, lint com 0 erros/11 avisos, imagem Docker e gate agregado. A diferença de dois testes em relação ao checkout principal deriva do commit de aplicação local preservado fora da PR. Não equivale a regressão causada pelo MP-01.

## Uso e revisão operacional

- QA local: `pwsh -NoProfile -File ./run_checks.ps1`; com build Next local: acrescentar `-Build`. Nenhum dos comandos publica.
- PR: conferir os checks da revisão candidata e o agregado `Validation required`; não fazer merge com validação falha/ausente.
- Produção: push em main ou disparo manual de main chama a validação antes do job de deploy. Não disparar nesta etapa.
- Homologação: workflow separado, disparo manual e confirmação explícita; aplica migrações no D1 isolado. Não disparar como parte de QA local.
- Proteção de merge já exige PR, branch atualizada e check agregado real, inclusive para admins; não há force-push/exclusão. A contagem de revisores externos permanece zero. Não fazer merge antes da aprovação explícita do usuário nesta conversa.

## Limites e achados adjacentes

- O npm ci do build informou 26 vulnerabilidades (7 moderadas, 17 altas e 2 críticas). Isso é a saída automática do instalador, não uma auditoria de explorabilidade. Nenhum `npm audit fix` ou atualização ampla foi executado; precisa de triagem própria antes de aprovação de release em MP-11/MP-12.
- A aprovação local desta infraestrutura não conclui funcionalidades do marketplace nem autoriza MP-02.
- A proteção de branch já está ativa. Os workflows novos estão somente na PR: passam a substituir os workflows antigos após merge autorizado; o workflow antigo de main não foi executado por esta tarefa.

## Referências de plataforma

- [Reutilização de workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows): chamada local mantém o workflow na revisão do chamador.
- [Checks obrigatórios e jobs dependentes](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks): job agregado com always evita que dependência falha seja apenas ignorada.
- [Execução manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): workflow_dispatch depende da presença do workflow na branch padrão.

## Veredito da etapa — 29/10/2026

MP-01 implementado e validado, aguardando aprovação da entrega pelo usuário. PR #22 permanece em rascunho, sem merge, deploy ou migração. A proteção remota da main está ativa; os workflows novos só substituem os antigos após merge autorizado. MP-02 permanece todo e sem autorização.
