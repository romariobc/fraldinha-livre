# MP-09 — Notificações internas persistidas

Início autorizado em 05/11/2026 pela instrução do usuário seguir para o próximo item, após esclarecimento MP-08/MP-09. Isso aprova MP-08 para avançar e inicia somente MP-09; não autoriza MP-10, merge, deploy ou migração remota. Base reconciliada `c58c77e`, branch `codex/mp-09-internal-notifications`, retorno `checkpoint/pre-mp09-2026-11-05`. Compra/pagamento/entrega simulados.

## Decisões e implementação

- Migração aditiva 0017 cria notifications: ID sequencial, fonte/tipo/ID, destinatário, referência ao pedido/report, detalhe do evento, horário e read_at. Unicidade por fonte/ID/destinatário; índice por conta/ID e não lidos. Nenhuma aprovação ou identidade alterada pela migração.
- Avisos são projeções dos eventos reais de order_events, audit_logs de decisão comercial e report_messages. Cada projeção entra depois do evento no mesmo D1.batch. Não depende de resposta HTTP, visualização, email, push ou NOTIFICATIONS_ENABLED (este último é controle do canal externo preexistente).
- Sem triggers sobre tabelas comerciais: preservadas as guardas e contagens de changes das mutações. Falha de gravação de aviso reverte a transação completa; cliente repete a chave/versão original. Falha de consulta/UI não desfaz uma operação já registrada.
- Novo pedido avisa fornecedor; confirmação/despacho/entrega avisam comprador; cancelamento avisa contraparte, ou ambas quando administrador é ator. Decisão de cadastro avisa fornecedor. Resposta/resolução em ocorrência avisa outra parte, ou ambas quando admin responde. Não avisar o próprio ator; não inventar lista de destinatários admin nem vincular pelo proprietário atual do produto.
- Entrega prospectiva: eventos anteriores à instalação não são convertidos automaticamente em uma caixa retroativa. Pedidos sem fornecedor persistido não recebem fornecedor inferido; respostas em reports legados usam o snapshot daquele report, com acesso revalidado. Texto do aviso é genérico e não copia mensagens/endereço/dados privados.
- GET /notifications usa destinatário do token, cursor estável por ID e limite 1–50 (padrão 30); lista e contagem de não lidos no mesmo batch de leitura. PATCH /notifications/:notificationId/read usa COALESCE/read_at e recibo persistido, seguro para concorrência/repetição. Nenhuma API aceita escolher outro destinatário.
- GET /notifications/:notificationId/destination revalida dono do aviso e papel/vínculo atual. Retorna destino tipado de pedido, ocorrência ou cadastro, sem URL arbitrária. Nem admin lê caixa de outro usuário. Um aviso não concede acesso ao recurso.
- /avisos é protegida para os três papéis. Entrada nos cabeçalhos público/fornecedor e administração; contagem de não lidos na central. Paginação, atualização ao abrir/foco/30s visíveis, retry, preservação em erro e isolamento por UID/papel. Leitura é ação explícita; abrir destino não marca silenciosamente como lido.
- Destino de pedido usa OrderTracking; destino de ocorrência abre o report exato via initialReportId em OrderOccurrences; cadastro aponta somente à rota fixa do fornecedor após autorização. Componentes existentes mantêm guardas da API.

## Matriz de validação

| Critério | Evidência | Resultado |
|---|---|---|
| Destinatário correto, sem self/fanout indevido | back/test/mp09-notifications.test.ts, fontes transacionais reais | 17 testes MP-09 incluídos nos 55 focais de backend aprovados |
| Isolamento, links, role/ownership atual, legado sem remapeamento | Mesmo conjunto D1; NotificationCenter e contratos | Focal aprovado; tipos front/back aprovados |
| Retry, perda após commit, read idempotente/concorrente, dedupe sem reset de leitura | D1 e teste do componente com resposta perdida | Focal aprovado |
| Falha entre gravações | Trigger de teste força falha de aviso; pedido/estoque/evento, decisão/auditoria e report/mensagem revertem | Focal D1 aprovado |
| Paginação estável com novos avisos, nova consulta/sessão | D1 e componente | Focal aprovado |
| UI: conta/papel, recibo inválido, destino inválido, conflito/perda de acesso | 19 testes focais de NotificationCenter/OrderOccurrences | Aprovado |
| Contratos/tipos/lint/build e regressão ampla | `node scripts/run-checks.mjs --build` | Saída 0: 791 front, 392 back, 73 contratos, 47 harness = 1.303; tipos dos três workspaces, lint sem erros/oito avisos anteriores e build Next/webpack aprovados |
| Migrações em D1 novo e jornada autenticada de todos os eventos com nova sessão | `node scripts/qa-mp09-browser.cjs`, Edge/Playwright, API/D1 locais | Saída 0: cinco grupos completos; decisão, pedido, estados, cancelamentos, respostas/resolução com novas sessões; leitura após resposta perdida, falha de consulta, troca de conta e terceiros/admin negados |
| CI da revisão final | PR e run vinculados ao SHA final | Conferir na PR desta etapa; o SHA final deve ter todos os checks aprovados, incluindo imagem e gate obrigatório, antes de publicar checkpoint |

Logs e artefatos ficam ignorados em docs/qa-artifacts. O teste de falha usa somente D1 local do pool, sem migração remota. Mocks de identidade em teste não comprovam login real; jornada autenticada real foi executada separadamente, conforme abaixo. Não publicar credenciais, sessões, bancos ou capturas locais por consequência desta entrega.

## Jornada autenticada e evidência local

- Instalação limpa com `npm ci --prefer-offline --no-audit --no-fund`, saída 0, 950 pacotes; lockfile preservado. Focal backend final: `npm test --workspace back -- --maxWorkers=1 test/mp09-notifications.test.ts test/mp08-occurrences.test.ts test/order-atomicity.test.ts test/supplier-approval.test.ts`, 55 testes, saída 0. Focal frontend: NotificationCenter/OrderOccurrences, 19 testes, saída 0; repetido após ajuste apenas de texto da central. Harness completo/build aprovado; contexto/CI com 15 testes repetidos e context check com 199 fontes aprovados.
- Configuração temporária docs/qa-artifacts/mp09-wrangler.json aponta somente ao código deste worktree, sem binding AI e NOTIFICATIONS_ENABLED=false. `wrangler d1 migrations apply DB --local --config ... --persist-to docs/qa-artifacts/mp09-d1-final`, saída 0 até 0017. Front localhost:3005, API 127.0.0.1:8794; não usar o D1 remoto como teste.
- Quatro contas Firebase QA existentes: comprador, dois fornecedores e admin; autenticação/leitura de perfil, sem criar usuário, alterar claims ou editar perfil remoto. Operações comerciais somente na API/D1 locais. O roteiro recusa origem API/front fora de loopback antes de autenticar; teste negativo com QA_API_ORIGIN=https://example.invalid rejeitou corretamente sem solicitação externa.
- Cinco grupos finais aprovados: cadastro/replay/destino; pedido/replay/leitura dupla/persistência; cada estado e cancelamento por papel em nova sessão; conversa exata/resolução; rede/leitura incerta/mobile/troca de conta/recusa a terceiros. Admin não recebe acesso a caixas alheias. O token identifica quem recebe: UID de query/body não concede acesso.
- SQL local final: 18 avisos, 16 não lidos, quatro pedidos, dez eventos de pedido, três mensagens e zero grupos de fonte/ID/destinatário duplicados. O único produto criado pela jornada terminou com estoque 28 (30 iniciais, duas unidades entregues; três pedidos cancelados restituídos). Não representa inventário de produção.
- Capturas desktop/mobile inspecionadas; sem transbordamento em 375 e 1024px; links/botões percorridos por teclado. Mensagem de leitura perdida foi reconciliada por refresh, sem assumir rollback; falha de consulta manteve a lista anterior. Logout e login na outra conta retiraram a conversa e o destino antigo retornou recusa. Servidores de frontend/backend encerrados.
- Primeira tentativa parou antes de dados comerciais porque o roteiro previa BUYER2 não configurado; usou-se o fornecedor QA existente para isolamento. A segunda percorreu os eventos, mas esperava somente / após logout; a rota protegida redirecionou corretamente para /login e a espera terminou por timeout. Roteiro corrigido para aceitar ambas as saídas anônimas, mantendo login na outra conta e recusa ao destino como obrigatórios. Execução integral final repetida em outro D1 novo, saída 0; nenhum banco anterior foi apagado e nenhuma asserção de privacidade foi retirada.

Credenciais em .env.qa.local ignorado; PLAYWRIGHT_MODULE_PATH e QA_BROWSER_EXECUTABLE indicam o runtime local. QA_FRONTEND_ORIGIN/QA_API_ORIGIN permitem trocar somente origens HTTP de loopback. Logs, bancos, configuração e capturas em docs/qa-artifacts não são publicados. Evidência pública durável: testes/roteiro versionados, este resumo e CI no SHA final.

## Retorno e limites

0017 é aditiva. Retornar ao código da base deixa a tabela de avisos no banco; não remover dados para reverter código. Recuperação por worktree separado a partir do checkpoint, ou PR de revert revisada após integração, mantendo publicação manual. Tags não restauram banco/configuração/secrets. Nenhum deploy/migração remoto executado.

Leitura/retry recuperam estado persistido do servidor, inclusive após recarga/nova sessão. Não há push, email, autoabertura ou garantia de entrega em tempo real/offline; consultas exigem conectividade e autenticação. Avisos e links não substituem a autorização do recurso. Operação, backup/restore, reconciliação remota de legado e homologação externa permanecem nas etapas próprias.

## Veredito

Implementação e validação locais concluídas, sem mudança de publicação automática herdada da base reconciliada. MP-09 aguarda aprovação humana; MP-10 não iniciado. CI/SHA/PR e checkpoint finais serão vinculados à revisão versionada, sem confundir validação local com merge, migração remota ou homologação de produção. A ativação futura exige 0017 antes da API compatível e coordenação de versões/janela operacional; esta entrega não executa essa ativação.
