# Diretrizes de agentes — Fraldinha Livre

Este é o núcleo comum a qualquer agente, modelo, editor ou terminal. Caminhos são relativos à raiz do repositório.

## Fluxo e precedência

- Siga a tarefa autorizada pelo usuário; não substitua seu escopo pela próxima feature do backlog.
- Comece por [.agents/skills/session-start/SKILL.md](.agents/skills/session-start/SKILL.md). Consulte apenas estado atual e contexto necessário.
- Regras operacionais vigentes: este arquivo e os guias em .agents/. Decisões de produto/arquitetura: [decisões](docs/governance/decisoes.md), considerando emendas posteriores. Histórico não redefine o processo atual.
- Planejamento, execução e revisão são papéis, sem modelo obrigatório. Delegação só quando autorizada; isolamento depende do ambiente, nunca é presumido.
- Ao concluir, siga [session-finish](.agents/skills/session-finish/SKILL.md). Preserve mudanças preexistentes e limite validações ao escopo.

## Mapa do projeto

| Escopo | Caminhos | Guia |
|---|---|---|
| Frontend | front/src/, front/package.json | [Next.js](.agents/rules/nextjs-rules.md) |
| Fornecedor | front/src/components/fornecedor/, front/src/app/(fornecedor)/painel-fornecedor/ | [Fornecedor](.agents/skills/domain-fornecedor/SKILL.md) |
| Comprador | front/src/components/minha-conta/, front/src/app/(main)/minha-conta/ | [Comprador](.agents/skills/domain-comprador/SKILL.md) |
| Catálogo | front/src/components/catalogo/, front/src/app/(main)/catalogo/ | [Catálogo](.agents/skills/domain-catalogo/SKILL.md) |
| API | back/src/ | [Contrato](.agents/skills/api-contract/SKILL.md) |
| Contratos compartilhados | packages/contracts/src/ | [Contrato](.agents/skills/api-contract/SKILL.md) e [risco](.agents/skills/risk-zone-protocol/SKILL.md) |
| UI | front/src/components/ | [UI](.agents/skills/ui-system/SKILL.md) |
| Código compartilhado e layouts | front/src/lib/, front/src/contexts/, front/src/components/ui/, back/src/lib/, back/src/middleware/, front/tailwind.config.ts, front/src/app/layout.tsx | [Risco](.agents/skills/risk-zone-protocol/SKILL.md) |

Leia o guia relevante antes de alterar o escopo correspondente. Ler um SKILL.md é suficiente quando o ambiente não tem ferramenta própria de skills. Outros layouts compartilhados, configuração global e contratos também exigem análise de impacto.

## Contexto seletivo

- [Estado atual](context/estado/progresso.md): ponto de entrada.
- [Backlog](context/estado/feature_list.json): critérios e status da tarefa selecionada.
- [Modelo de dados para agentes](docs/architecture/der-agentes.md): consultar em tarefas de persistência, relações e contratos de dados; descreve o código local, não o estado homologado em produção.
- [Planos](docs/features/plans/README.md), [specs](docs/features/specs/README.md) e [integração](docs/architecture/integration-guide.md): consultar por necessidade.
- [Ciclo e comandos](docs/governance/ciclo-de-sessao.md): referência operacional.
- Histórico em context/estado/progresso-historico.md, context/chatsessions/, docs/archive/ e docs/features/plans/archive/: não carregar nem pesquisar por padrão. Inclua explicitamente quando precisar de evidência histórica.
- Configurações de ferramentas e memória pessoal são opcionais; nenhuma informação indispensável pode existir somente nelas.
