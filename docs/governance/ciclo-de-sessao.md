# Ciclo de sessão e validação

O núcleo é [AGENTS.md](../../AGENTS.md); os procedimentos são [entrada](../../.agents/skills/session-start/SKILL.md) e [encerramento](../../.agents/skills/session-finish/SKILL.md). Este documento reúne referências e comandos, sem duplicar suas políticas.

## Fontes de contexto

Estado: context/estado/progresso.md. Critérios/status: context/estado/feature_list.json. Produto: docs/PRD-Fraldinha-Livre.md. Decisões: docs/governance/decisoes.md. Planos/specs: docs/features/. Arquivos históricos só são consultados sob demanda; decisões antigas de modelo, ferramenta e diretório pessoal não regem o harness atual.

## Comandos a partir da raiz

Execute separadamente, verificando o resultado de cada comando. Não dependa de encadeamento de shell.

| Verificação | Comando |
|---|---|
| Testes frontend | `npm test --workspace front` |
| Testes backend | `npm test --workspace back` |
| Testes contratos | `npm test --workspace packages/contracts` |
| Tipos frontend | `npm exec --workspace front -- tsc --noEmit -p tsconfig.json` |
| Tipos backend | `npm exec --workspace back -- tsc --noEmit -p tsconfig.json` |
| Tipos contratos | `npm exec --workspace packages/contracts -- tsc --noEmit -p tsconfig.json` |
| Lint frontend | `npm run lint --workspace front` |
| Build frontend | `npm run build --workspace front` |

Escolha conforme impacto. Mudança exclusivamente documental: conferir links/caminhos, JSON, diff e preservação dos arquivos movidos. Mudança funcional: testes pertinentes e tipos; build/lint quando necessários ao escopo. Use as versões de ferramentas do repositório e os requisitos de engines dos package.json.

Deployment e migrações remotas são operações separadas de validação local; não as execute como efeito colateral de QA.
