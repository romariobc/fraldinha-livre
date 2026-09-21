---
name: session-finish
description: Encerramento com evidência proporcional, estado atualizado e preservação de alterações alheias.
---

# Encerramento de sessão

1. Revise o diff e separe suas alterações das preexistentes. Verifique também arquivos novos.
2. Execute as verificações pertinentes de `docs/governance/ciclo-de-sessao.md`. Corrija falhas introduzidas pela tarefa; relate limites e falhas preexistentes com precisão. Documentação exige validação de links, caminhos, JSON e preservação de conteúdo, não testes de aplicação sem mudança de código.
3. Atualize `context/estado/progresso.md` com resultado, evidências e pendências reais. Preserve o histórico antes de substituir um marco que tenha valor de rastreabilidade. No backlog, altere apenas a tarefa afetada; implementação local não equivale a deploy ou homologação.
4. Commit, push e deploy seguem o escopo autorizado. Se houver commit, selecione explicitamente os caminhos da tarefa com `git add -- <caminhos>` e confira `git diff --cached`; nunca use `git add .` para empacotar uma sessão. Não inclua mudanças alheias nem afirme árvore limpa sem conferir.
5. Informe o que mudou, o que foi verificado e o que continua pendente. Não exija commit para concluir uma revisão ou edição local.
