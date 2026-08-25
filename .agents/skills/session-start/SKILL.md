---
name: session-start
description: Fluxo rigoroso de inicialização de sessão. Deve ser invocado no início de cada nova conversa.
---

# Fluxo de Inicialização de Sessão (Start Workflow)

Esta skill representa o **Passo 0 obrigatório** de qualquer nova sessão neste repositório. O objetivo é evitar que o agente trabalhe com contexto defasado e alinhar o conhecimento do LLM sobre o estado real do projeto, o backlog e a arquitetura de paralelização, *antes* de executar qualquer ação solicitiva.

## Instruções de Execução
Ao invocar esta skill, **você deve executar as etapas abaixo na exata ordem listada**, sem pular etapas e sem pedir permissão do usuário entre elas. Você só deve responder ao usuário após concluir o Passo 3.

### Passo 1: Checagem de Defasagem (Staleness Check)
O estado do projeto documentado em arquivos pode estar atrasado em relação à branch `main` remota. 
- Execute o comando no terminal: `git fetch && git log --oneline HEAD..origin/main | wc -l`
- Guarde o resultado. Se for maior que 0, significa que o branch atual está defasado, e você deverá alertar o usuário no seu relatório final (Passo 3).

### Passo 2: Absorção do Estado do Projeto
Use a ferramenta de visualização de arquivos para ler os seguintes arquivos silenciosamente (não resuma agora):
- [.claude/context/estado/progresso.md](file:///.claude/context/estado/progresso.md) (para entender onde o desenvolvimento parou e quais os próximos passos táticos).
- [.claude/context/estado/feature_list.json](file:///.claude/context/estado/feature_list.json) (para identificar a feature atualmente em 'in_progress' ou 'todo' e seus critérios de aceite).
- [PROJECT.md](file:///PROJECT.md) (para entender os milestones e arquitetura de alto nível do monorepo).
- [graphify-out/GRAPH_REPORT.md](file:///graphify-out/GRAPH_REPORT.md) (para entender o mapa mental das dependências, as comunidades isoladas e a arquitetura geral do frontend).

### Passo 3: Consciência de Orquestração e Paralelização
Para trabalhar no Fraldinha Livre, o agente usa habilidades de domínio isoladas para não gerar conflito. 
- Use a ferramenta de visualização de arquivos para ler a skill [paralelize](file:///.agents/skills/paralelize/SKILL.md).
- Use a ferramenta para listar (`list_dir`) o diretório `.agents/skills/` para memorizar quais domínios e regras customizadas existem (como `domain-fornecedor`, `domain-comprador`, `ui-system`, `api-contract`, etc).

### Passo 4: Relatório Final
Após executar os 3 passos acima, apresente sua única e primeira resposta ao usuário na sessão, formatada de maneira clara e amigável, contendo:
1. **Status do Git:** Informar se a branch está atualizada com a origin/main (resultado do passo 1).
2. **Resumo do Progresso:** 1-2 frases sobre o que foi feito na última sessão.
3. **Foco Atual:** Qual a feature/tarefa tática que você identificou como o próximo passo.
4. **Ferramentas Prontas:** Confirmar brevemente que você entende o uso dos agentes paralelos e as skills de domínio necessárias para a tarefa atual.
5. **Confirmação:** Perguntar ao usuário se ele aprova a execução do foco atual ou se deseja mudar a prioridade.

> [!CAUTION]
> Durante a execução desta skill, NÃO modifique arquivos, NÃO inicie o trabalho de código solicitado pelo usuário. O foco aqui é exclusivamente leitura e alinhamento tático.
