# Relatórios de validação

Cada relatório deve indicar commit/base examinada, alterações locais relevantes, ambiente, escopo e evidências desta execução. Resultados herdados devem informar sua origem e não contam como execução atual.

## Matriz por critério

| Critério | Evidência verificável | Resultado | Limitação |
|---|---|---|---|
| Comportamento esperado | Arquivo, teste ou comando executado | Passou / falhou / não verificado | Mock, ambiente ou cobertura ausente |

Liste os comandos, códigos de saída e resultados finais. Para comandos assíncronos, aguarde a conclusão antes de declarar sucesso. Resumos de testes podem ser registrados no relatório; não copie segredos ou dados pessoais dos logs.

Avalie cenários negativos pertinentes: autorização negada, falha entre gravações, persistência/rollback, navegação para páginas seguintes e falha de submissão. Asserções devem observar o comportamento, não apenas existência de componentes.

O veredito explicita o escopo aprovado e o que falhou ou não foi verificado. A tarefa de revisão pode estar concluída com defeitos reportados; isso não aprova a funcionalidade. Nunca promova fatos remotos antigos a constatações atuais sem consulta autorizada.

Relatórios superados ficam em archive/ com indicação de que não são vereditos atuais. Agendamento não faz parte deste procedimento.
