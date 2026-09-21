---
name: paralelize
description: Coordenação de trabalho paralelo autorizado, independente de ferramenta ou modelo.
---

# Trabalho paralelo

Use somente quando a delegação estiver autorizada. Planejamento, execução e revisão podem ser feitos pelo mesmo agente ou por agentes distintos conforme o ambiente.

- Verifique se os agentes compartilham diretório ou possuem worktrees isolados. Não presuma isolamento a partir do nome da ferramenta.
- Delimite tarefa, caminhos permitidos, dependências, critérios de aceite e responsável por cada arquivo.
- Use o mapa de domínios em AGENTS.md e o protocolo de risco para arquivos compartilhados. Domínios diferentes ainda podem compartilhar contratos e consumidores.
- Em diretório compartilhado, não permita escrita simultânea no mesmo arquivo. Em worktrees, combine a ordem de integração e confira conflitos sem perder alterações.
- Contratos compartilhados devem ser acordados antes dos consumidores. Não delegue uma dependência ainda indefinida.
- Cada entrega deve informar alterações, verificações reais e pendências; o responsável pela integração revisa o conjunto.

O briefing deve ser autocontido: objetivo, guia de domínio, arquivos, restrições e evidência esperada. Registros temporários de agentes não são regras permanentes do projeto.
