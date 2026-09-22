# Estado atual — 2026-09-22

## Marco corrente

Harness comum em AGENTS.md e .agents/, documentação em docs/ e estado em context/. QA agora exige evidência por critério, cenários negativos e distinção entre revisão concluída e aprovação. [Relatório corrigido](../../docs/qa/AUDIT-001-QA-relatorio.md).

## Resultado local

- AUDIT-001-QA: revisão concluída, incluindo correção de atomicidade da moderação, paginação SQL/UI, import de contratos e testes negativos. 909 testes nas suítes completas; tipos dos três workspaces passaram.
- TOOLING-001: concluída em 2026-09-22. Node 22.23.2 ativo; lockfile sincronizado; 909 testes e tipos dos três workspaces passaram; lint 0 erros/19 avisos. Repetição com concorrência limitada após falhas de inicialização na primeira tentativa. [Evidências e limites](../../docs/qa/TOOLING-001-validacao-2026-09-22.md).
- Documentação de arquitetura: [DER para agentes](../../docs/architecture/der-agentes.md) revisado contra schemas, migrations, contratos e rotas locais; corrigidas relações lógicas/FKs físicas, perfil opcional, autoria dos reportes e alvos polimórficos da auditoria. Vinculado ao AGENTS.md para consulta seletiva; não comprova estado remoto.
- Alterações locais sem commit. Mudanças anteriores de documentação foram incorporadas; front/.claude/ preexistente preservado. Agendamento adiado pelo usuário.

## Continuidade

- AUDIT-001 permanece in_progress: ambiente remoto, migration 0010, claims e publicação não consultados nesta rodada. Homologação real e validação em navegador ainda necessárias; build não executado.
- TOOLING-001 não depende mais de atualização do host. Avisos de lint/Vite triados; build e inspeção visual continuam fora da validação realizada.
- Registro anterior de 2026-09-21 relatava migrations 0008/0009, deploy e checkout/pedidos validados, com 0010 fora daquele deploy. Informação histórica, não constatação remota atual. Pagamento permanece simulado conforme registro anterior.
- Feature 011: gateway real pendente. 010 e 018 in_progress; 008 bloqueada. Confirmar evidência atual antes de retomar esses itens.
- Demais critérios em [feature_list.json](feature_list.json). Histórico da consolidação em [progresso-historico.md](progresso-historico.md). O [relatório original de QA](../../docs/qa/archive/README.md) foi preservado e seu veredito superado.

## Próxima sessão

Atender à tarefa autorizada. Se retomar AUDIT-001, executar build e validação em navegador; confirmar estado remoto antes de qualquer migração/publicação. Não há agendamento ativo criado por esta rodada.
