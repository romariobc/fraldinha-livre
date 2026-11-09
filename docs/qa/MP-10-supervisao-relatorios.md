# MP-10 — Supervisão e relatórios confiáveis

Base: c3dd8495adc155b75cc1b3cf621daf64bd092066, MP-09 aprovado em 06/11/2026 pelo usuário: “aprovado prossiga para o MP-10”. Branch codex/mp-10-admin-supervision; worktree isolado. Retorno previsto checkpoint/pre-mp10-2026-11-06. Etapa autorizada: MP-10 somente; merge/deploy/migração remota continuam separados.

## Alteração e regras

Admin acompanha solicitações/pedidos/ocorrências, preservando moderação de produtos e auditoria anteriores. Cancelamento administrativo antes do despacho exige motivo e audit_logs na mesma transação de pedido/estoque/evento/avisos. Admin não confirma/despacha/entrega em nome do fornecedor. Resposta/resolução usa a mensagem pública como justificativa, guarda trecho inicial de até 500 caracteres no ledger e referências à ocorrência/mensagem integral. Não há auditoria retroativa inventada. Replay idempotente; falha de auditoria desfaz a intervenção inteira.

Admin e fornecedor consultam relatório persistido. from/to inclusivos em America/Fortaleza, BRL, até 366 dias (default 30); busca literal, estado atual e fornecedor (admin). Coorte por data de CRIAÇÃO, situação atual. Snapshot único até 5000 linhas: métricas/série/paginação 20/CSV completo derivam das mesmas linhas; acima disso, recusa sem exportação parcial. CSV UTF8 BOM/ponto-e-vírgula, escape e proteção contra fórmulas. Linhas com preço desconhecido e registros sem data válida têm avisos explícitos. Datas inválidas não podem ser atribuídas ao período. Relatórios de fornecedor usam vínculo persistido, sem remapeamento do legado por dono atual do produto.

Valor simulado não cancelado e valor legado ficam separados. Recebimento financeiro não apurado; pagamento aprovado simulado não comprova dinheiro recebido. Overview e relatórios ativos abandonam os deltas/curvas/distribuições/SLA fixos e o perfil/gerente fictícios. Helpers antigos ficam por compatibilidade, sem uso no fluxo ativo.

## Matriz de validação

| Critério | Evidência | Resultado | Limite |
|---|---|---|---|
| Filtros, calendário, dados e totais | back/test/mp10-supervision.test.ts; packages/contracts/src/report.test.ts | 13 testes backend focais e 2 de calendário passaram | D1 local, sem leitura de dados remotos |
| Autorização e auditoria | testes focais de cancelamento concorrente, bloqueio pós-despacho e rollback forçado de auditoria | Passou | Sem alteração de claims/perfis |
| Paginação e CSV | front/src/components/__tests__/OrderReportPanel.test.tsx | 7 testes passaram | Componentes/mock HTTP; jornada real separada |
| Operação no navegador | scripts/qa-mp10-browser.cjs | Passou: cinco grupos na execução integral final | Firebase existente; API/Worker e D1 locais |
| Compatibilidade e build | node scripts/run-checks.mjs --build | Passou: 1.319 testes, tipos/lint/build | Oito avisos de lint preexistentes; não publica |

## Comandos e resultados

Primeira regressão identificou teste antigo autorizando admin a confirmar, incompatível com a regra aprovada de entrega pelo fornecedor. Expectativa corrigida para 403 e pedido inalterado. Testes antigos de UI com cards/curvas e export anterior foram atualizados para a nova fonte persistida e estados de erro. A primeira fixture tentava payment_mode=legacy, valor proibido pelo CHECK do esquema: corrigida para NULL, que representa o legado real; nenhum esquema afrouxado.

## Retorno e limites

Sem nova migração; utiliza esquema até 0017 da base. Retorno ao checkpoint anterior recupera código/documentação, não banco/configuração/credenciais. Reversão após integração exige PR própria preservando dados; não apagar banco para reverter. Compra/pagamento/entrega permanecem simulados. MP-11 e publicação não autorizados por esta entrega. CI e SHA final serão vinculados na PR desta etapa. O checkpoint final será publicado somente após conferir a CI da mesma ponta; não mover tags anteriores.


Harness local completo: `node scripts/run-checks.mjs --build`, saída 0: 405 backend, 792 frontend, 75 contratos, 5 fronteiras de contexto, 10 regressões de segurança do harness e 32 runner E2E (1.319). Tipos dos três workspaces, lint (zero erros, oito avisos existentes) e build webpack aprovados. Pacote admin-supervision, context check (205 fontes) e mapa de imports regenerado; artefato gerado permanece ignorado. Testes focais de UI atualizados: 48 em cinco arquivos passaram. Resultados de mocks/componentes não substituem o D1 nem o navegador.

Proteção conferida por leitura em 06/11: origin/main=d5b64c97d58055e6ce89056687bfe69fa9571870; main ainda contém deploy automático por push, por isso não houve merge. Branch de entrega herda workflow_dispatch confirmado, restrito a main e validação do mesmo SHA. Metadados remotos: três Workers Fraldinha sem triggers de build, nenhum Pages, zero hooks no repositório, 11 projetos Vercel acessíveis e nenhum vínculo ao repositório. Somente consultas de configuração; nenhum recurso ou proteção remota alterado.


## Jornada autenticada final

Execução integral em 06/11/2026, saída 0, no D1 novo mp10-d1-verified. Migrações existentes até 0017 aplicadas com `--local`; nenhuma migração nova. Quatro contas Firebase QA existentes: comprador, dois fornecedores e admin. Autenticação/leitura de perfil são remotas; operações comerciais e auditoria somente no Worker/D1 de loopback. Sem criar identidade, editar perfil ou alterar claims. Credenciais ignoradas em .env.qa.local; nunca incluir esses arquivos na entrega.

Cinco grupos aprovados pelo roteiro versionado:

1. Persistência de 23 pedidos e negativas reais: comprador e fornecedores não acessam relatórios/ocorrências administrativos; fornecedor2 não seleciona outro UID nem recebe linhas alheias. Painel acompanha solicitações e preserva a lista de produtos/moderação.
2. Relatório conciliado: total 23, um entregue, valor simulado 4.600 centavos antes do cancelamento, recebimento financeiro null; páginas 20/3, CSV com 23 IDs únicos e cabeçalho de centavos/fuso, busca sem resultado e filtro entregue. CSV usa todas as páginas do snapshot, sem nova consulta de exportação.
3. Falha de rede conserva os dados, bloqueia CSV e permite recuperar; navegação por teclado; admin 375/1024px e fornecedor 375px sem transbordamento da página. Tabela ampla tem rolagem interna. Capturas finais inspecionadas. Encontrado e corrigido min-width intrínseco no layout do fornecedor; campo de busca ocupa a largura disponível no celular.
4. Cancelamento administrativo com motivo, resposta e resolução pela interface; histórico/auditoria com referências à mensagem integral. Recarga confirma resolução. Após cancelar: total 23, um cancelado, um entregue, valor simulado 4.400 centavos. A ocorrência não altera status comercial/estoque.
5. Relatório/overview do fornecedor usam a mesma fonte; sessão nova do fornecedor2 mostra vazio, não herda dados e não entra em /admin.

Conferência SQL após encerrar o servidor: 21 aguardando, um cancelado e um entregue; estoque 56 no único produto QA (100 iniciais menos 44 unidades de pedidos não cancelados); uma ocorrência resolvida, versão 2, duas respostas; cinco auditorias (duas aprovações de fornecedor, um cancelamento, uma resposta e uma resolução). O texto inicial permanece em reports, separado das duas respostas de report_messages. Não confundir com dados/inventário remoto.

## Ambiente e reprodução

`node scripts/qa-mp10-browser.cjs` executa a jornada completa. QA_FRONTEND_ORIGIN/QA_API_ORIGIN aceitam apenas HTTP loopback; teste negativo com https://example.invalid rejeitou antes de autenticar. PLAYWRIGHT_MODULE_PATH aponta o runtime Playwright local; QA_BROWSER_EXECUTABLE aponta Edge instalado. O modo opcional QA_REUSE_MP10_FIXTURE=1 só aceita um produto e 23 pedidos ainda sem cancelamento, com uma ocorrência aberta; usado apenas para retomar diagnósticos antes das intervenções. A execução integral final usou banco novo e nenhum modo de retomada.

O Wrangler 4.125.0 sofreu falha interna repetível no ProxyController/ProxyWorker (`Network connection lost`) após registrar HTTP 200 de /orders, encerrando o servidor de desenvolvimento. O mesmo handler/contratos/dados passaram por Miniflare 4.20260722.0 diretamente. Não houve atualização de pacote ou alteração do handler para contornar a ferramenta. O roteiro `scripts/qa-mp10-local-api.cjs` empacota back/src/index.ts com o esbuild instalado e serve o Worker real (incluindo JWT e D1) sem o proxy do Wrangler. Essa é evidência local, não execução em produção. Um primeiro acesso frio de JWKS retornou 401 no diagnóstico, sem concessão de acesso; a execução final aqueceu/verificou os tokens pelos próprios endpoints e passou integralmente.

Para reproduzir, prepare configuração JSON local ignorada docs/qa-artifacts/mp10-wrangler.json, apontando main/migrations_dir para este checkout, compatibilidade 2026-07-19/nodejs_compat, binding DB local e as variáveis Firebase/UID QA já autorizadas; sem AI e NOTIFICATIONS_ENABLED=false. Escolha um diretório de persistência NOVO por execução, sem apagar anteriores. Aplique até 0017 com `wrangler d1 migrations apply DB --local` nessa configuração e diretório. Inicie `node scripts/qa-mp10-local-api.cjs` com QA_LOCAL_PERSIST apontando para o mesmo diretório/v3/d1; QA_LOCAL_CONFIG permite trocar o JSON. Frontend em localhost:3006 com NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8795, NEXT_PUBLIC_USE_BACKEND=true e authDomain Firebase apropriado a QA. Execute o roteiro de navegador em outro terminal. Configurações, logs, CSV, bancos e capturas ficam ignorados em docs/qa-artifacts; evidência durável: código dos roteiros, testes, este registro e CI.

A espera de login do roteiro foi conferida isoladamente e ajustada para preencher somente após a resolução do estado habilitado; não houve bypass de autenticação. A falha de largura em 375px foi mantida como falha até a correção e repetição integral. Servidores próprios encerrados; portas 3006/8795 sem listener ao fim. O build foi repetido após os ajustes visuais. Testes focais finais: 21 em dois arquivos de relatório e pedidos administrativos, saída 0.
