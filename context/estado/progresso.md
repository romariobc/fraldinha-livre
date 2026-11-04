# Estado atual — 2026-11-04

## MP-07 — Operações de venda e cancelamento: entrega local concluída

- MP-06 aprovado para avançar; MP-07 autorizado em 04/11/2026. Compra, pagamento e entrega continuam simulados.
- Base e retorno: 3463cfd, tag remota checkpoint/mp06-2026-11-02. Branch codex/mp-07-order-operations. Commit/CI/checkpoint finais registrados na PR desta entrega.
- Ações combinam papel/vínculo/estado na interface, preservando decisão definitiva do backend. Fornecedor confirma/despacha/entrega; comprador cancela aguardando; fornecedor/admin cancelam antes do despacho com motivo. Terminais não reabrem.
- Mutations vinculam UID esperado, serializam cliques e usam o snapshot devolvido pelo servidor. Falha/conflito reconcilia lista e detalhe com mensagem acionável. Linha do tempo atualiza após operação, aguardando leitura anterior se necessário.
- [Relatório MP-07](../../docs/qa/MP-07-operacoes-venda-cancelamento.md): sete testes D1 novos aprovados; 101 testes focais finais e três testes de diálogo aprovados; tipos front/back e 46 testes do harness verificados. Matriz completa do commit compartilhado registrada na PR.
- Jornada autenticada local aprovada: ciclo completo, clique duplo, três papéis, motivo obrigatório, estado terminal, estoque e 409 real por ação obsoleta. Lista/detalhe/linha do tempo reconciliados. Capturas desktop/mobile inspecionadas; 375px sem transbordamento.
- Após despacho, orientação para ocorrência identifica o pedido e informa indisponibilidade de abertura/resposta nesta versão. Nenhuma ocorrência fictícia foi enviada; fluxo completo é MP-08.
- Sem nova migração, merge, deploy ou alteração remota. D1 local separado mp07-d1 usa migrações existentes até 0015, sem binding AI e com notificações externas desativadas. Contas QA existentes, sem nova identidade ou escrita de perfil remoto.
- MP-08: todo, não iniciado; aguardar aprovação explícita desta entrega.

## Contexto seletivo e limites

- [Arquitetura](../../docs/architecture/arquitetura-vigente.md), [roteiro](../README.md); node scripts/context.mjs packet order-operations seleciona ações/conflitos; packet order-tracking seleciona leitura/histórico. Contratos HTTP não foram alterados nesta etapa.
- Legado sem vínculo confiável de fornecedor mantém compatibilidade anterior e exige reconciliação administrativa antes da liberação. Mocks não comprovam operação remota; ocorrências/notificações completas seguem os MPs correspondentes.
- Produção ainda requer homologação, reconciliação das PRs sobrepostas e procedimentos autorizados de backup/migração/publicação. Cadastro/recuperação de identidade mantêm homologação externa pendente.
- Checkpoints recuperam código/documentação, não banco/configuração/credenciais. MP-07 não altera o schema da MP-06.

## Histórico sob demanda

- [Estado MP-06 preservado](progresso-ate-mp06-2026-11-04.md), [MP-05](progresso-ate-mp05-2026-11-02.md), [registro anterior](progresso-ate-2026-10-30.md). PRs anteriores #22–#27 preservadas, sem merge nesta etapa.
