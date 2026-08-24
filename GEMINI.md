@AGENTS.md

## Ciclo de Sessão (Harness de Referência)

Este projeto adota o ciclo de sessão definido em:
https://github.com/romariobc/dev_flow_create_harness

**Mapa completo do ciclo + contexto/persistência/memória:** [.claude/docs/governance/ciclo-de-sessao.md](file:///.claude/docs/governance/ciclo-de-sessao.md)
(contexto base, arquivos de consulta, persistência, memória e divergências). Resumo abaixo.

**CRÍTICO PARA NOVAS SESSÕES:**
Sempre que iniciar uma **nova sessão**, ANTES de escrever qualquer código ou executar comandos relativos à solicitação do usuário, **você DEVE INVOCAR OBRIGATORIAMENTE a skill `session-start`** (lendo o arquivo [.agents/skills/session-start/SKILL.md](file:///.agents/skills/session-start/SKILL.md)) e executar todos os seus passos em sequência silenciosa. Isso garante o alinhamento total de contexto.

Resumo do ciclo (que será executado automaticamente por você através da skill `session-start`):
0. **Cheque defasagem**: `git fetch && git log --oneline HEAD..origin/main | wc -l`.
   Se > 0, alerte o usuário antes de confiar nos arquivos de estado.
1. **Leia o progresso**: [.claude/context/estado/progresso.md](file:///.claude/context/estado/progresso.md) (histórico cronológico).
2. **Leia o backlog**: [.claude/context/estado/feature_list.json](file:///.claude/context/estado/feature_list.json) (status e critérios de aceite).
3. **Foco**: Trabalhe em exatamente 1 feature por sessão.

**CRÍTICO PARA ENCERRAMENTO DE SESSÕES:**
Ao finalizar o trabalho do dia ou quando o usuário solicitar o encerramento da sessão, **você DEVE INVOCAR OBRIGATORIAMENTE a skill `session-finish`** (lendo o arquivo [.agents/skills/session-finish/SKILL.md](file:///.agents/skills/session-finish/SKILL.md)) para empacotar o contexto, validar o código e gerar os commits antes de se despedir.
4. **Verifique**: Só prova executável conta (testes automatizados e `tsc`).
5. **Atualize**: Salve o progresso em `feature_list.json` e `progresso.md` antes de encerrar e comite-os junto com o código.

---

## Atalhos de Documentação

- **Especificações de Design**: [.claude/docs/features/specs/](file:///.claude/docs/features/specs/)
- **Planos de Implementação**: [.claude/docs/features/plans/](file:///.claude/docs/features/plans/)
- **Decisões Arquiteturais (ADRs)**: [.claude/docs/governance/decisoes.md](file:///.claude/docs/governance/decisoes.md)
- **Guia de Integração Backend**: [.claude/docs/architecture/integration-guide.md](file:///.claude/docs/architecture/integration-guide.md)

Divergências deste projeto em relação ao harness: stack Next.js/TypeScript (não Python); contexto de domínio mapeado em `AGENTS.md` e regras nativas sob `.agents/`.