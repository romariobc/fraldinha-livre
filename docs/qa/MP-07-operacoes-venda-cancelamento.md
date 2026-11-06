# MP-07 — Operações de venda e cancelamento

Base: 3463cfd (MP-06), preservada na tag remota checkpoint/mp06-2026-11-02. Branch: codex/mp-07-order-operations. Execução autorizada em 04/11/2026. Somente MP-07; pagamentos, compras e entregas continuam demonstrativos.

## Implementação identificada por leitura de código

- A política de apresentação em front/src/lib/order-actions.ts combina papel, vínculo disponível e estado. Comprador cancela apenas aguardando; fornecedor confirma, despacha e marca entregue; fornecedor/admin cancelam em aguardando/confirmado. Estados entregue/cancelado não oferecem reabertura. Vínculos explícitos prevalecem; snapshots legados retornados na lista autorizada mantêm compatibilidade. O backend continua a autorização definitiva.
- DTOs projetados para comprador/fornecedor preservam uid/supplierId para conferir ownership na interface. HttpOrderRepository vincula cancelamento e mudança de status ao UID esperado, conferido pelo apiFetch antes e depois de obter token.
- use-order-operation.ts serializa as ações do controller, preserva erro acionável/código de suporte e reconcilia a consulta após sucesso ou falha. Conta anterior não recebe feedback/alterações na nova conta. Uma falha de leitura posterior não transforma escrita confirmada em instrução para repetir a mutação.
- O fornecedor usa o snapshot efetivamente retornado pelo servidor, evitando retroceder a projeção para um status solicitado que já foi ultrapassado. Detalhes e linha do tempo recebem uma revisão após operação. Se uma leitura antiga estiver em andamento, aguardam seu fim antes da consulta atual, sem sobrepor as duas leituras.
- Cancelamento por fornecedor/admin exige motivo de 5 a 500 caracteres. O diálogo preserva motivo em erro, bloqueia clique repetido imediatamente e só fecha após confirmação de sucesso. O administrador ganhou a ação de cancelar no detalhe, sem expor confirmação/despacho/entrega nas suas telas.
- Mensagens de conflito ficam visíveis no diálogo ativo e na lista quando ele fecha. Menus e detalhes não oferecem cancelamento após despacho. Pedidos terminais continuam legíveis.
- Após despacho/entrega, Problema com o pedido abre orientação sobre ocorrência e identifica o pedido. A tela informa expressamente que abertura/resposta/acompanhamento de ocorrências ainda não estão disponíveis e que nada foi enviado. O fluxo completo pertence à MP-08; não há endpoint novo nem simulação de submissão nesta etapa.

## Matriz por critério

| Critério | Evidência | Resultado e limite |
|---|---|---|
| Ações por papel, ownership e estado | order-actions.test.ts; controles de fornecedor/admin/comprador; token de outra conta em checkout-session-auth.test.ts | Verificada por execução; autorização final continua no backend |
| Ciclo confirmar/despachar/entregar e terminal | back/test/mp07-operations.test.ts e scripts/qa-mp07-browser.cjs | Verificada por execução D1 e navegador autenticado |
| Comprador cancela aguardando; fornecedor/admin antes do despacho com motivo | D1: motivo vazio/ausente negado; UI: botão bloqueado, motivo persistido e estoque conferido | Verificada por execução; compra e restituição são demonstrativas |
| Disputas concorrentes e atualização após erro | D1: cancelamento vs confirmação/despacho; navegador: ação obsoleta recebe 409 real e atualiza lista/detalhe/histórico | Verificada por execução; não é teste contra produção |
| Cliques repetidos, perda de autorização e resposta tardia | Hook/diálogo: uma operação; UID esperado; teste de troca de conta e resposta já avançada | Verificada por execução focal |
| Após despacho, encaminhamento para ocorrência | Orientação acessível ao fornecedor, comprador e admin; nenhuma ação de cancelar | Verificada na interface; criação/resposta/resolução dependem da MP-08 |

## Validação executada e escopo da evidência

- Sete testes de integração novos passaram no D1 real do runtime de testes, com limites originais. Conferem estados, eventos, motivo, papéis/ownership e estoque. As disputas usam Promise.all e exigem um único vencedor e uma única transição persistida.
- A suíte frontend inicial executou 771 casos: 768 passaram; três falharam porque dois testes de apresentação não forneciam AuthProvider/useAuth. Os testes passaram a declarar o papel que exercitam. A revalidação focal de seis arquivos passou com 44 testes, incluindo essas apresentações, operação, UID e leitura após mutação. Os três testes do diálogo de motivo passaram, incluindo clique repetido no mesmo ciclo de eventos. A revisão final de providers, comprador, fornecedor, admin e leitura após mutação passou em seis arquivos com 101 testes. A CI final valida a árvore compartilhada inteira.
- Jornada autenticada executada em localhost:3003 e 127.0.0.1:8792, com quatro grupos de cenários: ciclo completo do fornecedor e terminal; cancelamento do comprador com clique duplo; cancelamentos fornecedor/admin com motivo; conflito real com atualização de lista/detalhe/linha do tempo. Conferências usam a API real e estoque do produto; não usam respostas inventadas para declarar sucesso.
- No conflito, uma leitura é temporariamente bloqueada para manter a ação obsoleta. Outro papel cancela pelo backend local; o PATCH da interface é enviado de verdade, recebe 409 e a interceptação libera a leitura para reconciliar. Estado/estoque/eventos são novamente conferidos. O teste não forja a resposta de conflito.
- Capturas desktop e mobile em 375px inspecionadas. A revisão inicial encontrou lista cancelada com linha do tempo ainda aguardando o polling; foi corrigida a atualização imediata do detalhe após operação e acrescentada regressão de leitura antiga seguida da leitura atual.
- Tipos frontend verificados. Lint sem erros; um aviso introduzido no teste administrativo foi removido, com lint focal limpo. Dez avisos preexistentes permanecem. Resultado final de tipos, testes, lint, harness e imagem de produção fica registrado na PR junto do commit exato.

## Ambiente, limites e retorno

D1 de QA separado em docs/qa-artifacts/mp07-d1 recebeu apenas as migrações existentes até 0015. Configuração local de teste derivada da configuração vigente, com main apontando para o backend real, notificações externas desativadas e sem binding AI. Não houve nova migração, alteração de configuração de produção, deploy ou migração remota.

Contas QA existentes do Firebase real foram usadas para autenticação/leitura de perfil. Operações comerciais/aprovações de QA ocorreram somente no D1 local; nenhuma identidade ou perfil remoto foi criado/alterado. O script restringe rotas comerciais do navegador ao backend local. Credenciais, configuração local e capturas/logs ficam ignorados pelo Git; o script versionado não contém segredos.

Legacy sem fornecedor confiável ainda requer reconciliação administrativa antes da liberação, conforme MP-06. A autorização SQL/atômica existente não foi substituída por políticas da tela. Ocorrências com resposta e notificações completas seguem suas etapas aprovadas.

Estado/backlog serão encerrados com MP-07 aguardando aprovação da entrega e MP-08 não autorizado. Base de retorno: checkpoint/mp06-2026-11-02 (3463cfd). Checkpoint final checkpoint/mp07-2026-11-04 publicado somente após CI aprovada. Tags restauram código/documentação, não banco/configuração/credenciais. Nenhum merge nesta etapa.
