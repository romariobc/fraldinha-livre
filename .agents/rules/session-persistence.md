# Regra de Manutenção de Contexto e Persistência de Sessão

Esta regra é obrigatória e deve ser seguida rigorosamente por qualquer agente de IA (Gemini, Claude, ou outros) que atue no repositório. O objetivo é garantir que o estado de desenvolvimento seja mantido íntegro e contínuo entre sessões.

---

## 1. Entrada de Sessão (Mapeamento Obrigatório)

Antes de iniciar qualquer análise ou modificação de código, execute os seguintes passos:

1. **Passo 0 (Verificação de Staleness)**:
   Verifique se o checkout atual está defasado em relação à branch remota principal (`main`):
   ```bash
   git fetch && git log --oneline HEAD..origin/main | wc -l
   ```
   Se a contagem for maior que zero, rebaseie ou alerte o usuário antes de confiar nos arquivos de estado locais, pois eles podem representar uma foto congelada e obsoleta do projeto.

2. **Passo 1 (Leitura do Progresso)**:
   Abra e leia o arquivo `.claude/context/estado/progresso.md` para entender onde a sessão anterior parou e qual o próximo passo planejado.

3. **Passo 2 (Leitura do Backlog)**:
   Abra e leia o arquivo `.claude/context/estado/feature_list.json` para extrair os critérios de aceite e o status da feature atual da rodada.

4. **Passo 3 (Verificação da Memória)**:
   Verifique no índice `MEMORY.md` (fora do repositório) se há fatos duráveis ou feedbacks comportamentais relevantes para o escopo da tarefa atual.

---

## 2. Saída de Sessão (Atualização Obrigatória de Contexto)

Ao encerrar o trabalho de uma sessão, o agente deve atualizar o estado para a próxima LLM que assumir:

1. **Atualização do Progresso (`progresso.md`)**:
   Insira uma nova entrada datada no topo do histórico detalhando:
   - Qual feature foi trabalhada.
   - Quais arquivos foram criados, modificados ou removidos.
   - Status dos testes executados e build de produção.
   - O **próximo passo exato e detalhado** com o qual a próxima sessão deve iniciar.

2. **Atualização do Backlog (`feature_list.json`)**:
   Mude o status da feature correspondente (ex: de `in_progress` para `done` ou de `todo` para `in_progress`).

3. **Geração de Evidências Reais**:
   Não declare uma tarefa concluída com base apenas em suposições. Testes automatizados locais e compilação de tipos (`npx tsc --noEmit`) devem rodar limpos antes de atualizar os arquivos de contexto para `done`.

4. **Atomicidade no Git**:
   A atualização de `progresso.md` e `feature_list.json` **deve ser incluída no mesmo commit de código** (ou no grupo de commits finais) que entrega a funcionalidade. O histórico do repositório deve refletir a documentação de estado alinhada atomicamente com o código.
