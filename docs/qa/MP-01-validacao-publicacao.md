# MP-01 — Validação e publicação previsíveis

Data: 26/10/2026 (America/Fortaleza). Etapa autorizada pelo usuário após aprovação do MP-00. O MP-02 não está autorizado.

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

## Inspeção remota somente leitura

| Consulta | Resultado nesta sessão | Implicação |
|---|---|---|
| Proteção da branch main | API retornou 404 `Branch not protected` | Um check declarado no YAML não se torna obrigatório para merge automaticamente. |
| Rulesets do repositório | Lista vazia | Não foi identificada regra alternativa de proteção. |
| GitHub Actions | Habilitado, ações permitidas | A execução hospedada pode ser validada pela PR. |
| Environments | `Production`, `Preview`, `github-pages`, sem regras de proteção retornadas | O workflow reutiliza o nome `Production`; o simples nome não comprova aprovação manual. |

Essas configurações remotas não foram alteradas. O gate de publicação protege o caminho do workflow entregue; a ausência de proteção de merge continua uma limitação explícita, a ser resolvida antes de considerar o processo operacionalmente encerrado. Após o primeiro run, usar o nome real do check agregado retornado pela API ao configurar checks obrigatórios; não inventar esse nome a partir da aparência no YAML.

## Matriz por critério

| Critério | Evidência | Resultado | Limitação |
|---|---|---|---|
| Rejeitar falha, cancelamento e skip | Subprocesso real do gate nos testes | Passou localmente | Não executa migração/deploy de propósito. |
| QA para na primeira falha | Injeção de falha em cada posição e erros de processo | Passou localmente | Demais comandos simulados nesses testes específicos. |
| YAML e semântica Actions | `actionlint` 1.7.12 em contêiner | Passou, exit 0 | Não comprova resultado de runner hospedado. |
| Sintaxe PowerShell | Parser AST dos dois scripts | Passou | Execução completa registrada abaixo. |
| Suítes/tipos/lint via novo runner | `pwsh -NoProfile -File ./run_checks.ps1` | Em execução | Resultado final pendente. |
| Imagem de produção | `docker build -f front/Dockerfile -t fraldinha-livre-frontend:mp01 .` | Em execução | Primeiro build passou; repetição confere exclusão do .env.local. |
| CI no GitHub | PR em rascunho | Pendente | Não confundir validação local com run hospedado. |
| Proteção de merge | Consultas API acima | Ausente | Critério operacional ainda não encerrado. |

## Uso e revisão operacional

- QA local: `pwsh -NoProfile -File ./run_checks.ps1`; com build Next local: acrescentar `-Build`. Nenhum dos comandos publica.
- PR: conferir os checks da revisão candidata e o agregado `Validation required`; não fazer merge com validação falha/ausente.
- Produção: push em main ou disparo manual de main chama a validação antes do job de deploy. Não disparar nesta etapa.
- Homologação: workflow separado, disparo manual e confirmação explícita; aplica migrações no D1 isolado. Não disparar como parte de QA local.
- Proteção de merge deve exigir PR e o check agregado real; permissões de bypass e revisão precisam ser definidas pelo responsável antes de ativar restrições no repositório. A aprovação de uma etapa nesta conversa não é uma regra configurada no GitHub.

## Limites e achados adjacentes

- O npm ci do build informou 26 vulnerabilidades (7 moderadas, 17 altas e 2 críticas). Isso é a saída automática do instalador, não uma auditoria de explorabilidade. Nenhum `npm audit fix` ou atualização ampla foi executado; precisa de triagem própria antes de aprovação de release em MP-11/MP-12.
- A aprovação local desta infraestrutura não conclui funcionalidades do marketplace nem autoriza MP-02.
- Resultados de CI, revisão candidata e veredito serão consolidados ao final da sessão.

## Referências de plataforma

- [Reutilização de workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows): chamada local mantém o workflow na revisão do chamador.
- [Checks obrigatórios e jobs dependentes](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks): job agregado com always evita que dependência falha seja apenas ignorada.
- [Execução manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): workflow_dispatch depende da presença do workflow na branch padrão.
