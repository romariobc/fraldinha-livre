# Estado atual — 2026-11-02

## MP-06 — Histórico e acompanhamento: entrega local concluída

- MP-05 aprovado para avançar; MP-06 autorizado pelo usuário. Compra, pagamento e entrega continuam demonstrativos.
- Base e retorno anterior: 7ad88a9, tag remota checkpoint/mp05-2026-11-02. Branch codex/mp-06-order-tracking; [PR #27](https://github.com/romariobc/fraldinha-livre/pull/27). Commit/CI/checkpoint finais registrados na PR.
- GET /orders/:id?scope=... entrega snapshot e eventos no mesmo D1.batch, com autorização por papel/vínculo. Fornecedor gravado no pedido prevalece; legado sem vínculo mantém o fallback anterior por itens.
- Histórico distingue completo, parcial e legado sem eventos; não inventa autoria/horários. OrderTracking apresenta os mesmos dados nos três perfis. [Relatório MP-06](../../docs/qa/MP-06-historico-acompanhamento.md).
- Listas/detalhes atualizam na abertura, foco/visibilidade, manualmente e a cada 30 segundos visíveis, sem sobreposição por recurso. Falha preserva dados; troca de conta oculta dados/seleção anterior e descarta respostas tardias.
- Verificação local: 753 testes frontend completos antes dos últimos acréscimos; regressões finais focais aprovadas; 63 contratos e 46 harness. Histórico/escopos D1: 13 testes focais aprovados. CI inicial confirmou 359 backend com limites originais; CI final obrigatória do commit compartilhado registrada na PR.
- Jornada autenticada local aprovada: polling real 30s, despacho pelo fornecedor, retorno ao foco, igualdade nos três papéis, falha de rede/recuperação e nova sessão. Capturas mobile/admin inspecionadas; 375px sem transbordamento. Limites e incidentes locais no relatório.
- Sem nova migração, merge, deploy ou migração remota. D1 local separado mp06-d1 recebeu apenas migrações existentes até 0015. Sem nova identidade ou escrita de perfil remoto.
- MP-07: todo, não iniciado; aguardar aprovação explícita desta entrega.

## Contexto seletivo e limites

- [Arquitetura](../../docs/architecture/arquitetura-vigente.md), [roteiro](../README.md); node scripts/context.mjs packet order-tracking seleciona os arquivos do acompanhamento. Contratos: packages/contracts/src/order.ts.
- Polling não é tempo real nem garantia de disponibilidade de rede. Histórico persistido exige API/D1 compatíveis; mocks não comprovam persistência. Registros sem vínculo confiável de fornecedor exigem reconciliação administrativa antes da liberação.
- Produção não homologada por este QA. Publicação exige reconciliar PRs sobrepostas, cumprir migrações/backup autorizados e validar o ambiente remoto; cadastro/recuperação de identidade mantêm homologação externa pendente.
- Checkpoints preservam código/documentação; não restauram dados, configurações ou credenciais remotas. MP-06 não altera o schema da MP-05.

## Histórico sob demanda

- [Estado da MP-05 preservado](progresso-ate-mp05-2026-11-02.md), [registro anterior](progresso-ate-2026-10-30.md), [histórico anterior](progresso-historico.md). PRs anteriores #22–#26 preservadas; nenhuma mesclada nesta etapa.
