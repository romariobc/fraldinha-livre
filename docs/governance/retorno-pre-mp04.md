# Ponto de retorno anterior à MP-04 — 31/10/2026

Referência preservada: tag `checkpoint/pre-mp04-2026-10-31` e branch `codex/checkpoint-pre-mp04-20261031`. Ambas apontam para o mesmo commit, contendo o código, documentos, testes e harness locais de MP-00 a MP-03 e CTX-01, além do ajuste local anterior `1322ac6`.

A autorização do usuário nesta data permite versionar o conjunto e iniciar somente MP-04. A tag é criada antes das alterações de MP-04 e deve permanecer fixa; não usar push forçado. Main e as PRs anteriores não são mescladas automaticamente.

## Recuperação sem apagar trabalho posterior

Em um clone com acesso ao repositório:

```powershell
git fetch origin --tags
git worktree add --detach ../fraldinha-retorno-pre-mp04 checkpoint/pre-mp04-2026-10-31
```

O diretório separado permite inspecionar, testar e recuperar arquivos sem alterar a árvore de trabalho atual. Para desenvolver uma correção a partir desse estado, criar uma nova branch nesse diretório com `git switch -c codex/recuperacao-pre-mp04`. Para desfazer uma entrega já compartilhada, revisar um `git revert` em uma nova PR, preservando o histórico; não reescrever main nem usar reset destrutivo.

## O que este ponto preserva

Arquivos versionáveis do projeto. Arquivos ignorados, credenciais, tokens, variáveis locais, dependências instaladas, imagens de container, capturas de QA e bancos locais/remotos não são enviados ao GitHub. Artefatos de QA permanecem locais, com resultados sintetizados nos relatórios versionados.

Este é um retorno de código e documentação. Não restaura dados, identidades, configuração remota ou migrações aplicadas. Nenhuma publicação ou migração remota faz parte desta operação. Uma futura recuperação operacional exige o plano de backup/restauração da etapa correspondente e autorização específica.
