# Estado atual — 2026-11-04

## MP-08 — Ocorrências com resposta: entrega local concluída

- MP-07 aprovado para avançar pela instrução iniciar MP-08. Branch codex/mp-08-order-issues; base a0984bf, retorno checkpoint/mp07-2026-11-04.
- Comprador/fornecedor vinculados abrem; partes/admin consultam, respondem e resolvem com texto, ator e horário. Resolvida não reabre; sem efeitos automáticos no pedido/estoque.
- Migração aditiva local 0016 preserva reports anteriores, acrescenta estado/versão/autoria e report_messages. Endpoint fornecedor /report compatível. Nenhuma migração remota aplicada.
- [Relatório MP-08](../../docs/qa/MP-08-ocorrencias-com-resposta.md): nove testes D1 novos e 54 testes finais MP-08/RBAC passaram; sete testes finais de conversa passaram. Front amplo 778 antes do cenário adicional, contratos 65, harness 46 e tipos passaram. Lint sem erros (oito avisos em arquivos não alterados). Matriz final do commit compartilhado registrada na PR.
- Jornada autenticada local aprovada: comprador abre com clique duplo único, fornecedor responde, admin resolve; comprador lê após recarga. Pedido/eventos/estoque preservados; nova resposta após resolução recebe 409. Desktop/mobile 375px inspecionados, sem transbordamento; foco/Escape verificados. QA comercial restrito a API/D1 locais separados, sem binding AI e notificações externas desativadas.
- Recuperação de envio incerto vale no componente montado; após fechar/recarregar, consultar a conversa antes de novo envio. Nova abertura em pedido legado sem supplier_id depende de reconciliação; reports anteriores seguem acessíveis pelo snapshot preservado.
- Sem merge/deploy/alteração de identidade. Compra/pagamento/entrega permanecem simulados. MP-09 não autorizado.

## Contexto seletivo e limites

- Próxima etapa proposta: MP-09 — notificações internas persistidas, somente após aprovação explícita.
- Pacote order-occurrences; [arquitetura](../../docs/architecture/arquitetura-vigente.md), [backlog](../../docs/BACKLOG-FASES.md).
- Pedidos sem fornecedor persistido exigem reconciliação para novas aberturas; reports antigos mantêm acesso pelo fornecedor registrado. Cadastro/recuperação de identidade, PRs sobrepostas e operação de produção seguem pendentes das etapas próprias.
- Checkpoints recuperam código/documentação, não banco/configuração/credenciais.

## Histórico sob demanda

- [Estado MP-07 preservado](progresso-ate-mp07-2026-11-04.md), [MP-06](progresso-ate-mp06-2026-11-04.md).
