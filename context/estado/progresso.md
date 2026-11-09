# Estado atual — 2026-11-08

O usuário aprovou o MP-10 e autorizou avançar em 08/11. O MP-11 concluiu a preparação local na branch `codex/mp-11-operational-readiness`, sobre `c3c8dbc` da PR #32. A entrega aguarda aprovação e o MP-12 é a próxima etapa.

- O Worker, o frontend e as regras candidatas retiram a exceção administrativa por UID. O token real da conta QA foi verificado e obteve 200 no endpoint administrativo local. Comprador recebeu 403 e token inválido recebeu 401. Onze verificações de regras passaram no emulador Firestore.
- O assistente exibe o aviso de indisponibilidade e o link para catálogo em 375 e 1024 px. A API retorna 404 e a implementação de IA permanece no código.
- A restauração SQLite isolada preservou hash lógico, estoque e relações. O ensaio de exportação/importação D1 local recuperou 24 produtos e o ledger de 19 migrações. As metas propostas são RPO de 15 min e RTO de 60 min.
- A suíte completa passou com 1.318 testes, tipos, lint e build. O lint manteve oito avisos preexistentes.
- A configuração consultada em 08/11 mostra bindings distintos para produção e homologação. Alertas dedicados e validação da recuperação em escala ficam como pendências operacionais. A main remota `d5b64c9` ainda usa gatilho de produção por push. A publicação e a migração remota requerem a janela de liberação aprovada.

[Relatório MP-11](../../docs/qa/MP-11-operacao-recuperacao.md) · [Runbook](../../docs/operations/marketplace.md) · [Estado anterior MP-10](progresso-ate-mp10-2026-11-08.md)
