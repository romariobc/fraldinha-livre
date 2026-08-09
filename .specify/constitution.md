# Fraldinha Livre Constitution

## Core Principles

### I. Session Cycle Protocol (Harness Reference)
O projeto adota um fluxo de trabalho rigoroso por sessão. Antes e depois de qualquer tarefa, o agente deve:
1. **Ler o Progresso**: Revisar `.claude/context/estado/progresso.md` para saber onde a sessão anterior parou.
2. **Pegar a Próxima Feature**: Consultar `.claude/context/estado/feature_list.json` para obter a próxima feature (`status: todo`).
3. **Foco Único**: Trabalhar em exatamente 1 feature por sessão. Nunca misturar escopos.
4. **Verificação Executável**: Só declarar uma tarefa como feita se houver prova executável (testes passando, build bem-sucedido ou UI rodando sem erros).
5. **Atualização de Estado**: Atualizar `feature_list.json` e `progresso.md` obrigatoriamente antes de encerrar.

### II. Next.js & TypeScript Stack
- O projeto usa Next.js (App Router) e TypeScript, divergindo de frameworks em Python.
- **Aviso Crítico**: Esta versão do Next.js possui *breaking changes*. As APIs, convenções e estrutura de arquivos podem diferir do padrão conhecido.
- Consulte sempre os guias locais em `node_modules/next/dist/docs/` antes de escrever qualquer código. Preste muita atenção a avisos de depreciação.

### III. Separação de Domínios e Skills
Agentes operando no projeto devem respeitar os limites de domínio e invocar as "skills" (ou sub-agentes) correspondentes antes de realizar modificações:
- **Fornecedor** (`src/components/fornecedor/` ou `src/app/(main)/fornecedor/`) → Invoque `Skill(domain-fornecedor)`
- **Comprador** (`src/components/minha-conta/` ou `src/app/(main)/minha-conta/`) → Invoque `Skill(domain-comprador)`
- **Catálogo** (`src/components/catalogo/` ou `src/app/(main)/catalogo/`) → Invoque `Skill(domain-catalogo)`
- **UI System** (Qualquer componente de interface visual) → Invoque `Skill(ui-system)`
- **Integração de APIs** (Migração de mocks para chamadas reais) → Invoque `Skill(api-contract)`
- **Protocolo de Zona de Risco**: Ao modificar `src/lib/`, `src/components/ui/`, `tailwind.config.ts`, ou layouts compartilhados → Invoque `Skill(risk-zone-protocol)`

### IV. Desenvolvimento Orientado a Especificações (Spec-Driven)
- Utilize os artefatos e ferramentas do `spec-kit` (`.specify/`) para nortear o trabalho.
- O código só deve ser implementado `/speckit.implement` após uma especificação clara `/speckit.specify`, o planejamento estruturado `/speckit.plan`, e a quebra de tarefas `/speckit.tasks`.
- Em caso de dúvidas estruturais, deve-se gerar checklists `/speckit.checklist` e análises de divergência `/speckit.analyze`.

## Arquitetura de Documentação
- Especificações de Design estão em: `.claude/docs/design/specs/`
- Planos de Implementação estão em: `.claude/docs/design/plans/`
- Guia de Integração do Backend está em: `.claude/docs/backend/integration-guide.md`

## Governança
- Esta Constituição serve como a lei suprema do projeto, substituindo o comportamento padrão do agente.
- Qualquer adição de tecnologia ou alteração de convenção fundamental deve ser atualizada e registrada neste documento.

**Version**: 1.0.0 | **Ratified**: 2026-07-01
