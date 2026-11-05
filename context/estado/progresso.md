# Estado atual — 2026-11-05

## MP-09 — Notificações internas: entrega local concluída

- MP-08 aprovado para avançar pela instrução do usuário “siga para o próximo item”, autorizando somente MP-09. MP-09 aguarda aprovação humana; MP-10 não autorizado. Merge, deploy e migração remota permanecem separados.
- Branch `codex/mp-09-internal-notifications`; base reconciliada `c58c77e`, retorno `checkpoint/pre-mp09-2026-11-05`. Publicação manual confirmada preservada; reconciliação #30 ainda não integrada.
- [Relatório MP-09](../../docs/qa/MP-09-notificacoes-internas.md): /avisos, consulta/leitura/destino autenticados; avisos derivados de eventos na mesma transação, deduplicados por fonte/destinatário. Migração aditiva 0017 aplicada somente a D1 local novo. Sem caixa retroativa inventada, fanout admin, e-mail ou push.
- Fornecedor recebe novo pedido, comprador recebe estados, cancelamento avisa contraparte (admin avisa ambas); decisões de cadastro avisam fornecedor, respostas em ocorrência avisam outra parte (admin avisa ambas). Snapshot preservado; não remapear legado por proprietário atual do produto.
- Lista paginada, leitura idempotente e destinos reautorizados; UID esperado e descarte após troca de conta/papel; refresh ao abrir/foco/manualmente/30s visíveis. Falha visual não desfaz operação registrada.
- Harness com build aprovado: 791 front + 392 back + 73 contratos + 47 harness = 1.303 testes; tipos/lint aprovados, oito avisos existentes. Focais: 55 integração backend e 19 componentes. Jornada autenticada final aprovada em cinco grupos: todos os eventos com novas sessões, perda de resposta após leitura, falha de rede, conta alheia/admin negados e 375/1024px sem overflow. Servidores encerrados.
- CI e SHA final devem ser conferidos na PR desta etapa. `checkpoint/mp09-2026-11-05` reservado à ponta aprovada na CI; publicar/conferir depois, sem mover tags anteriores. Tags recuperam código/documentação, não banco/configuração/credenciais.

## Limites e contexto seletivo

- Compra/pagamento/entrega simulados. Cadastro novo/recuperação de senha, legado sem vínculo confiável, backup/restore e homologação operacional seguem pendentes das etapas próprias. Nenhuma publicação, migração remota, alteração de identidade ou fechamento de PRs anteriores.
- [Estado da reconciliação preservado](progresso-ate-reconciliacao-2026-11-05.md), [MP-08](progresso-ate-mp08-2026-11-05.md). Avisos começam com os eventos da versão compatível; não há backfill retroativo automático.
- Pacote `internal-notifications`; [arquitetura](../../docs/architecture/arquitetura-vigente.md), [backlog](../../docs/BACKLOG-FASES.md).
