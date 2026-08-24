---
name: session-finish
description: Fluxo rigoroso de encerramento de sessão. Garante persistência atômica de contexto, documentação e versionamento no final do trabalho.
---

# Fluxo de Encerramento de Sessão (Finish Workflow)

Esta skill deve ser invocada obrigatoriamente **ao final de uma sessão de trabalho** ou quando o usuário solicitar para "encerrar", "fechar a sessão" ou "finalizar o trabalho". O objetivo é empacotar o progresso feito de maneira atômica, garantindo que o `feature_list.json`, o `progresso.md` e o histórico do Git fiquem 100% alinhados para a próxima IA que assumir a tarefa amanhã.

## Instruções de Execução
Ao invocar esta skill, você deve seguir um rigoroso processo de **duas fases**. Nunca pule a pausa para obter a permissão do usuário.

### FASE 1: Análise de Versionamento e Check-in com o Usuário

1. **Varredura de Mudanças:** Use a ferramenta de terminal para rodar `git status` e `git diff --stat`. Identifique claramente quais arquivos foram criados, alterados ou deletados durante a sessão.
2. **Avaliação do Escopo:** Baseado no que você trabalhou, determine qual feature do backlog foi tocada (qual era o seu objetivo inicial).
3. **Elaboração da Mensagem:** Escreva uma proposta de mensagem de commit em PT-BR usando o formato Conventional Commits (ex: `feat(fornecedor): adiciona filtro de preços no catálogo`).
4. **Relatório de Aprovação:** Apresente ao usuário o seguinte relatório e **PARE A EXECUÇÃO COMPLETAMENTE** aguardando a resposta dele:
   - O que foi modificado (`git status`).
   - A sugestão da mensagem de commit.
   - A pergunta: *"Posso prosseguir com a atualização do contexto (progresso.md e feature_list.json) e realizar o commit com essa mensagem?"*

---
*(AGUARDE A APROVAÇÃO EXPLÍCITA DO USUÁRIO PARA INICIAR A FASE 2)*
---

### FASE 2: Consolidação e Commit Atômico (Após aprovação)

Se o usuário autorizar ou sugerir ajustes na mensagem de commit, execute IMEDIATAMENTE (sem pausar) todos os passos abaixo na ordem:

1. **Validação de Código (Prova Executável):** Se arquivos TypeScript foram tocados, execute `npx tsc --noEmit` para garantir que a tipagem não foi quebrada. *(Se houver erro, aborte e peça ajuda ao usuário).*
2. **Atualização do Backlog (`feature_list.json`):** Usando a ferramenta de edição, atualize o status da feature correspondente (ex: de `in_progress` para `done` se tudo foi concluído).
3. **Atualização do Progresso (`progresso.md`):** Adicione uma nova entrada no topo do histórico (logo após os cabeçalhos), seguindo o formato:
   ```markdown
   ## Marco (DATA DE HOJE) - [Resumo curto]
   **Resumo da Sessão:**
   [1-2 frases do que foi feito]

   **O que foi feito:**
   1. Item
   2. Item

   **Status:** [Build limpo, testes não executados/executados, etc]
   
   **Próximo Passo:**
   [Escreva a instrução exata que o próximo agente deve seguir ao iniciar o trabalho. Isso é crucial!]
   ```
4. **Commit Atômico:** Com os arquivos salvos, adicione-os ao stage (`git add .`) e realize o commit com a mensagem aprovada na Fase 1 (`git commit -m "sua mensagem"`). Dessa forma, a documentação de estado (`.claude/context/`) sobe junto com o código de forma atômica.
5. **Encerramento:** Responda ao usuário com uma mensagem de despedida, confirmando o commit efetuado e que o ambiente está limpo e documentado para a próxima sessão.
