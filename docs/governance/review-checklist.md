# Revisão de entrega

- Conferir diff completo, arquivos novos/removidos e escopo autorizado; relatório de agente não substitui evidência.
- Conferir critérios de aceite relevantes, contratos compartilhados e consumidores.
- Para cada critério relevante, registrar: evidência (arquivo/teste/comando), resultado (passou/falhou/não verificado) e limitação. Quantidade total de testes não comprova critérios sem cobertura.
- Em operações com múltiplas gravações, verificar falha intermediária e ausência de efeitos parciais. Em listas paginadas, testar navegação além da primeira página e filtros, não apenas renderização inicial.
- Distinguir revisão concluída de produto aprovado. Falha de ferramenta significa verificação indisponível, não sucesso. Estado remoto herdado do contexto deve ser identificado como não revalidado.
- Registrar comandos executados, resultados e limitações conforme [validação](ciclo-de-sessao.md). Não repetir verificações sem mudança ou dúvida concreta.
- Distinguir implementação, teste local, deploy e homologação. Não declarar conclusão operacional com base apenas em testes mockados.
- Preservar mudanças de outras tarefas e revisar seleção de arquivos antes de commit.
- Conferir atualização do estado e links quando houver movimentação de documentação.
