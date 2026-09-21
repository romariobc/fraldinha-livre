---
name: session-start
description: Entrada seletiva, preservação do trabalho existente e alinhamento com a tarefa solicitada.
---

# Entrada de sessão

1. Confirme a raiz com `git rev-parse --show-toplevel` e examine `git status --porcelain`. Registre alterações preexistentes; não as sobrescreva.
2. Se a tarefa depender de atualidade remota, execute `git fetch origin`. Após sucesso, use `git rev-list --count HEAD..origin/main` (ajuste a referência se a principal for outra). Sem rede ou referência, registre a limitação; não declare sincronização. A contagem mostra commits de main ausentes, não equivalência das branches. Não rebaseie automaticamente.
3. Leia somente `context/estado/progresso.md`. Consulte no backlog `context/estado/feature_list.json` a tarefa solicitada e suas dependências. Status antigos em conflito com evidência recente precisam ser reconciliados, não seguidos cegamente.
4. Leia as skills e a spec/plano pertinentes. Histórico, PROJECT.md e grafo de dependências são consultas opcionais; o grafo gerado pode estar desatualizado e não substitui o código.
5. Prossiga no escopo autorizado. Pergunte apenas se faltar uma decisão necessária. Não exija confirmação genérica para começar, nem invente obrigação de paralelizar.

As instruções específicas de ambiente têm precedência sobre pressupostos de ferramentas. Para trabalho concorrente autorizado, consulte `.agents/skills/paralelize/SKILL.md`.
