# MP-05 — Checkout simulado e recuperação de falhas

Entrega de 01/11/2026. Execução autorizada pelo usuário após MP-04. Base preservada: `251cb25`, tag remota `checkpoint/mp04-2026-11-01`. Branch desta etapa: `codex/mp-05-checkout`. MP-06 não iniciada. A base MP-04 foi recuperada diretamente do GitHub em repositório separado; git fsck e comparação da árvore df68cf0f126f13a545940ff5a0e5e300a3bd5ad6 aprovados.

## Problema e resultado

O checkout anterior aprovava a simulação no navegador, mantinha a chave somente em memória e só apresentava sucesso depois de todos os fornecedores. Uma falha intermediária ocultava pedidos já persistidos; recarga trocava a chave e podia repetir a compra. A limpeza integral da sacola também não distinguia sucesso parcial.

Agora o servidor decide o cenário demonstrativo e gera `paymentMode=simulated`, `paymentStatus=approved` e `paymentTransactionId=sim-<orderId>`. Recusa não cria pedido, item, evento ou reserva. `pending` é rejeitado no checkout; não há coleta de dados de cartão nem cobrança real. Campos antigos enviados pelo cliente não determinam a origem da transação.

O navegador conserva uma tentativa por usuário, com requisição imutável e chave por fornecedor gravadas antes da rede. As chaves não dependem da quantidade de fornecedores restantes. Cada resposta é apresentada separadamente; erros de transporte permanecem como resultado desconhecido, com recuperação da mesma chave. O servidor mantém idempotência, ownership e validação de catálogo/estoque na transação.

## Matriz de aceite

| Critério | Implementação | Evidência |
|---|---|---|
| Aprovação simulada persistida com metadados de servidor | POST /orders define método padrão, modo, status e identificador; pedido, itens, estoque e evento seguem no D1.batch. Total e quantidade são validados/derivados de itens. | Testes MP-05 em D1; consulta SQL e jornada de aprovação. |
| Recusa sem pedido/estoque; nenhum cartão real | Cenário aprovado/recusado explícito, sem pending; recusa retorna PAYMENT_DECLINED antes da escrita. | Testes de recusa/pending e navegador com dois fornecedores; SQL comprova zero pedidos/eventos e estoque intacto. |
| Um pedido por fornecedor e resultado parcial | Grupos independentes, sem promessa de transação única da sacola. Resultados exibem confirmação, recusa, falha ou desconhecido por fornecedor. | API/D1, testes de workflow e navegador com um fornecedor sem estoque. |
| Remover somente itens confirmados | fl.cart.v2 guarda itens e recibos na mesma gravação; confirmação subtrai apenas a quantidade comprada e não repete o desconto após recarga. Leitura de fl.cart.v1 preservada para migração. | Testes de sacola/workflow; SQL e inspeção da sacola no navegador. |
| Tentativa por usuário e retry estável | fl.checkout.v1:<UID>, chave fixa por grupo antes de POST; Web Locks serializa submissões entre abas; API confere UID esperado antes/depois de obter token. | Testes de conta/sessão, clique duplo, duas abas, perda de resposta e recarga. |
| Timeout antes/depois do commit | Resultado desconhecido conserva chave/payload. Replay recupera o pedido existente, com a mesma transação, sem repetir reserva/evento. | Interceptações de rede antes do envio e após resposta da API local; SQL direto no D1 e testes do handler. |
| Endereço e itens válidos; simulação clara | CheckoutAddressSchema exige campos não vazios, bairro, UF e CEP; sacola valida itens/valores inteiros seguros; servidor revalida preço, total, fornecedor e disponibilidade. | Testes de contratos, UI, API e inspeção desktop/mobile. |

## Fronteiras de código

- `checkout/page.tsx`: navegação entre endereço/revisão/pagamento e apresentação do resultado; sem decisão de pagamento local.
- `use-checkout-session.ts`: restauração por UID, trava imediata contra clique duplo, coordenação de execução e conciliação da sacola.
- `checkout-attempt.ts`: snapshot, persistência, chaves, exclusão controlada, timeout e classificação de resultados; HTTP obrigatório para o checkout ativo.
- `cart-storage.ts` e CartProvider: envelope v2 e recibos atômicos; API antiga useCart preservada, API interna useCheckoutCart acrescentada.
- `recordConfirmedOrders`: atualiza a projeção da conta usando respostas HTTP confirmadas, sem escrita de perfil ou renovação forçada da sessão. Resultados desconhecidos disparam leitura dos pedidos com refreshSession=false, para conferir o histórico sem forçar token/perfil; o comportamento de atualização manual anterior permanece compatível.
- MockPaymentGateway e MockFulfillmentService permanecem como adaptadores/fixtures legados; não participam do checkout ativo. A flag legada de OrdersProvider não transforma o novo checkout em uma compra apenas em memória.

## Persistência e compatibilidade

Migração `0015_server_simulation.sql`: acrescenta payment_mode nullable; não altera nem atribui origem de servidor aos metadados históricos. Teste aplica até 0014, cria pedido legado, aplica 0015 e confere preservação. O contrato de leitura aceita histórico sem modo; confirmação do checkout novo exige modo simulado emitido pelo servidor.

0015 foi aplicada apenas em D1 local separado de QA. Publicação futura exige migração e backend compatível antes do frontend, pelo procedimento de implantação autorizado. Não houve merge, deploy, migração remota ou mudança de credenciais/perfis nesta etapa.

## Validação executada

- Suítes completas locais: frontend com 739 testes e backend com 354 testes antes dos últimos acréscimos de regressão. Depois, 31 testes focados de checkout/conta/recuperação e dois testes de migração aprovados. A matriz completa do commit compartilhado é revalidada na CI da PR.
- Contratos: 63 testes; harness: 46. Tipos dos workspaces verificados; lint sem erros, com dez avisos existentes. Imagem Docker de produção construída, com 25 páginas geradas.
- Navegador: aprovação, clique duplo, recusa de dois fornecedores, sucesso parcial, recarga, timeout antes do envio, perda de resposta após commit e duas abas concorrentes. Na perda após commit, Ver meus pedidos também confirmou o registro antes de recuperar a tentativa.
- SQL direto no D1 local confirmou estoque, quantidade de pedidos/eventos e payment_mode para todos os produtos dos cenários. Capturas de resultado parcial e resultado desconhecido em 375 px inspecionadas, sem transbordamento horizontal.
- Autenticação e leitura de perfil usaram contas QA existentes no Firebase real. Pedidos, aprovações de fornecedores, produtos e migrações usaram exclusivamente o D1 local `docs/qa-artifacts/mp05-d1`, com notificações externas desabilitadas.
- O host genérico localhost:8787 respondeu por outro gateway do ambiente. O QA foi isolado explicitamente em 127.0.0.1:8787; nenhum processo desconhecido foi encerrado. A primeira tentativa recebeu 404 e não realizou mutação de negócio nesse gateway.
- Ajustes no script de espera por perfil/navegação não substituem autenticação nem utilizam bypass. A atualização de cache de pedidos foi separada da renovação de sessão, evitando leitura adicional de perfil na conclusão da compra.

Artefatos locais ignorados pelo Git: `mp05-browser-result.json`, `mp05-d1-assertions.json`, capturas `mp05-*.png` e logs em docs/qa-artifacts/. O script reproduzível `scripts/qa-mp05-browser.cjs` não contém credenciais e restringe operações comerciais ao backend local.

## Limites e ponto de parada

- A recuperação é por conta no mesmo navegador, com armazenamento e Web Locks disponíveis; não sincroniza tentativas entre dispositivos e não promete sobreviver à exclusão manual de dados do navegador.
- Armazenamento indisponível/corrompido não é substituído silenciosamente por chave nova. Resultado desconhecido nunca autoriza nova compra automática. Uma rejeição posterior de catálogo não libera outra chave enquanto houver resposta anterior incerta; o usuário mantém a tentativa e consulta seus pedidos.
- Recibos locais servem à conciliação da sacola, sem conferir identidade ou autoridade sobre pedidos. Autenticação, propriedade, metadados de simulação e estoque permanecem no servidor/D1. Não equivalem a comprovante bancário.
- Pedidos já registrados não são desfeitos porque outro fornecedor falhou. Cancelamento, acompanhamento e atendimento continuam nos MPs correspondentes.

Commit, CI final e ponto de retorno desta entrega ficam registrados na PR e na tag de encerramento. MP-06 depende de aprovação explícita do usuário.
