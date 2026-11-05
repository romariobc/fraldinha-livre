# MP-08 — Ocorrências com resposta — 04/11/2026

Base: a0984bf (MP-07), retorno checkpoint/mp07-2026-11-04. Branch codex/mp-08-order-issues. Commit, CI e checkpoint finais são registrados na PR da entrega. MP-07 aprovado e MP-08 iniciado pela instrução explícita iniciar MP-08. Nenhuma autorização de MP-09 decorre desta entrega.

## Implementação examinada

- Contratos compartilhados occurrence.ts: abertura, conversa, resposta, recibos e estados. Texto obrigatório de 5–4000 caracteres; campos de autoria/ownership fornecidos pelo cliente são rejeitados. Autor/papel/horário vêm da sessão e servidor.
- Rotas GET/POST /orders/:id/occurrences e POST /orders/:id/occurrences/:reportId/messages. Comprador/fornecedor vinculados abrem; partes/admin leem, respondem e resolvem com resposta obrigatória. Admin não abre no lugar das partes. Resolvida não reabre nem recebe novas mensagens.
- Migração aditiva 0016 conserva reports (ID, pedido, partes, texto inicial, read, criação), acrescentando estado, versão, autoria e resolução. report_messages registra as respostas. O texto inicial continua no registro original e é projetado na conversa. read não é promovido a prova de atendimento ou resolução. Registros antigos são identificados como legados; nenhum evento é inventado.
- Versão esperada + D1.batch tornam resposta/estado/resolução atômicos. Um requestId por envio admite replay após perda da resposta sem duplicar mensagem. Conteúdo divergente com mesmo identificador recebe conflito. A API lê estado e mensagens no mesmo batch.
- Endpoint antigo de fornecedor /orders/:id/report conserva payload {message} e recibo {success,reportId}; novas mensagens seguem validação de texto e são consultáveis como ocorrências. Clientes antigos sem requestId não possuem recuperação idempotente entre envios independentes.
- Sem supplier_id, somente o fornecedor registrado no report anterior pode atender aquele report. Novas aberturas exigem reconciliação do pedido. O proprietário atual do produto não recebe acesso histórico por inferência.
- OrderOccurrences compartilhado por comprador/fornecedor/admin, incluindo o diálogo legado. Leitura e recibos validados, UID esperado, dados e rascunhos isolados por conta/pedido, consulta ao abrir/foco/manual/30s visíveis. Bloqueio de cliques repetidos, conflito com reconciliação, falha de leitura preservando dados e recuperação do envio incerto no componente montado.
- Ocorrências não mudam status comercial, estoque, pagamento ou eventos do pedido. Compra/pagamento/entrega permanecem simulados. Nenhuma promessa de notificação interna, email ou push; MP-09 continua separado.

## Matriz de aceite

| Critério | Evidência desta execução | Resultado | Limite |
|---|---|---|---|
| Partes abrem; partes/admin leem/respondem; terceiros negados | back/test/mp08-occurrences.test.ts; rbac-adversarial.test.ts | Passou, 54 testes finais nestes dois arquivos | Identidades controladas nos testes D1; jornada autenticada separada |
| Estados, mensagens, resolução com resposta/ator/hora; sem reabrir | MP-08 D1 + OrderOccurrences.test.tsx | Passou | Sem anexos/reabertura por contrato |
| Concorrência e replay sem duplicação/sobrescrita | Duas resoluções concorrentes, retry de abertura/resposta, conteúdo divergente | Passou | Serialização do cliente por componente; backend protege versão/replay |
| Falha intermediária não deixa estado parcial | Trigger D1 força falha de INSERT; status/versão/resolução preservados | Passou | Banco D1 local do pool de testes |
| Não altera pedido/estoque | Comparação de snapshot/eventos D1; jornada local compara pedido completo e estoque | Passou em D1 e navegador | Sem operação remota |
| Compatibilidade do histórico | Fixture inserida antes de 0016 e relida depois, read/texto/ID/horário/autoria preservados; endpoint antigo | Passou | Sem inventário/reconciliação do banco remoto |
| UI: clique repetido, conta, conflito, erro, recibo inválido, resolução | Sete testes de OrderOccurrences | Passou | RTL usa HTTP controlado; não substitui navegador |
| Jornada comprador → fornecedor → admin → comprador após recarga | scripts/qa-mp08-browser.cjs, D1 separado mp08-d1 | Passou | Firebase QA existente + operação comercial local |

## Verificações executadas

- Backend focal inicial: nove testes MP-08, saída 0. Após corrigir resposta de autorização da rota antiga, MP-08 + RBAC: 54 testes, saída 0.
- Backend amplo: primeira execução padrão interrompida após sobrecarga/timeouts locais. Repetida com --maxWorkers=2 --testTimeout=30000 --hookTimeout=60000: 374/375 passaram; a única falha foi o erro de autorização da rota antiga, corrigido e reexecutado no conjunto de 54 acima. CI do commit final verifica a matriz padrão em ambiente separado.
- Frontend completo: 80 arquivos, 778 testes passaram, saída 0. Depois do ajuste de leitura posterior à abertura, sete testes focais finais passaram, saída 0 (um cenário adicional). A contagem final completa é a da CI.
- Contratos: 65 testes passaram, saída 0. Harness: 46 testes, saída 0 (context.test, ci-safety.test, test-e2e-logic.test).
- Tipos front/back/contratos: saída 0. Tipos front repetidos após ajuste final: saída 0.
- Lint completo: saída 0, oito avisos em arquivos não alterados pela etapa (variáveis/imports não usados e imagens). Lint focal dos novos componentes/testes: saída 0, sem avisos.
- Migrações 0000–0016 aplicadas apenas ao D1 local separado; sem binding AI e notificações externas desativadas. Nenhuma migração/deploy remoto.

Logs, configurações temporárias, D1 local e capturas ficam em docs/qa-artifacts, ignorado pelo Git. Não versionar credenciais ou dados de sessão. scripts/qa-mp08-browser.cjs usa contas QA existentes via arquivo local ignorado; comandos e resultados não imprimem credenciais/tokens.

## Jornada autenticada e inspeção visual

Execução final: saída 0, quatro grupos aprovados em mp08-browser-result.json. Navegador Edge/Playwright, front localhost:3004, API 127.0.0.1:8793 e D1 separado docs/qa-artifacts/mp08-d1. Contas Firebase QA existentes; configurações de produção não alteradas.

Comprador abriu com clique duplo (um POST/uma ocorrência); fornecedor respondeu na tela de pedido; admin resolveu com texto obrigatório e autoria/horário persistidos. Comprador leu a resolução após atualização e recarga limpa. Leitura da API confirmou três mensagens, estado resolvida, pedido/eventos iguais ao snapshot anterior e estoque 8 (reserva original de duas unidades preservada). Nova resposta após resolução recebeu 409 real. Sem alteração implícita no pedido.

Capturas mp08-conversation-desktop.png e mp08-conversation-mobile.png inspecionadas: diálogo rolável, mensagens identificadas e sem transbordamento horizontal em 375px. Foco permaneceu no diálogo; Escape fechou e retornou ao botão de origem. A primeira tentativa de jornada foi interrompida porque o diálogo do comprador desapareceu durante atualização do código no servidor de desenvolvimento; a execução final foi repetida com código estabilizado e passou. Uma tentativa inicial anterior ao servidor ficar disponível encerrou com fetch failed, sem iniciar jornada comercial.

## Limites e retorno

- Recuperação de envio incerto conserva a solicitação enquanto o componente permanece montado. Após recarga/fechamento ou em outro dispositivo, consultar a conversa antes de novo envio; não há persistência local de rascunhos ou garantia entre dispositivos nesta etapa.
- Pedidos legados sem fornecedor exigem reconciliação administrativa antes de nova ocorrência; reports existentes continuam atendíveis pelo snapshot preservado.
- Notificações internas, supervisão, backup/restore testado, configuração e liberação integrada pertencem a MP-09–MP-12. Cadastro e recuperação de identidade mantêm homologação externa pendente.
- Checkpoints Git recuperam código/documentação. A migração é aditiva, sem DROP ou alteração do texto antigo; retorno ao código MP-07 deixa novos campos/tabela no banco e não exibe a conversa nova. Não executar reversão destrutiva para retornar código. Recuperação real de dados/configuração é etapa operacional separada.
- PRs de etapas anteriores são rascunhos sobrepostos e não foram integradas. Sem merge, publicação, alteração de secrets/claims ou migração remota. Resultado local/CI não é homologação de produção.

## Veredito

Implementação e jornada autenticada locais concluídas. CI do commit final será acompanhada e registrada na PR/checkpoint; não confundir este resultado com publicação. Entrega aguarda aprovação humana; MP-09 não iniciado.
