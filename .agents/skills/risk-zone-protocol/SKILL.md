---
name: risk-zone-protocol
description: Coordenação e validação de mudanças em código compartilhado.
---

# Alterações em áreas compartilhadas

Escopo: front/src/lib/, front/src/contexts/, front/src/components/ui/, componentes e layouts compartilhados, front/tailwind.config.ts, front/src/app/globals.css, back/src/lib/, back/src/middleware/ e packages/contracts/src/.

1. Examine `git status --porcelain` e o diff dos arquivos que pretende alterar. Isso detecta alterações locais, não propriedade nem agentes ativos. Consulte tarefas/agentes ativos se a ferramenta oferecer essa capacidade. Outros worktrees podem ter alterações invisíveis aqui: use `git worktree list` quando houver execução concorrente conhecida e coordene arquivos com os responsáveis. Um commit recente não comprova concorrência; uma árvore limpa não comprova exclusividade. Só peça esclarecimento quando houver sobreposição concreta sem coordenação suficiente.
2. Identifique consumidores com busca no código, avalie contratos e documente impacto e compatibilidade na entrega. O grafo de dependências é auxiliar opcional; confirme seu conteúdo no código atual.
3. Faça a menor mudança que resolva o problema, preservando alterações alheias. Não force um prefixo de commit que descreva incorretamente a mudança.
4. Execute testes e verificação de tipos dos workspaces afetados conforme `docs/governance/ciclo-de-sessao.md`. Alterações em contracts podem afetar front e back. Não declare compatibilidade apenas porque uma nova propriedade é opcional.
