# Arquitetura vigente no código local — 2026-11-05

Este é um mapa curto de navegação. Não comprova deploy/migrações remotas nem substitui decisões aprovadas. Registros detalhados em docs/governance/decisoes.md; contrato da versão em docs/BACKLOG-FASES.md.

## Composição

- npm workspaces: front, back e packages/contracts (package.json raiz).
- Front: Next.js/React, App Router, layouts por público, comprador e fornecedor; admin em /admin. Infra preparada para Node standalone em Cloudflare Container; ver front/Dockerfile e src/container-worker.ts.
- Back: Hono em Cloudflare Worker; registro de rotas/middleware em back/src/index.ts; D1/SQLite com Drizzle e SQL parametrizado.
- Contratos: schemas Zod e tipos em packages/contracts/src/, compartilhados por HTTP.
- Identidade: Firebase Auth/JWT; verificação e papéis no backend. Perfil no Firestore; autorização comercial no D1. Não presumir que claim de fornecedor é aprovação comercial.
- Flutter em app/ é separado dos workspaces web; não é parte da liberação atual do marketplace.

## Frontend

| Área | Controller/entrada | Dados |
|---|---|---|
| Catálogo público | front/src/app/(main)/catalogo/ | ProductsProvider → HttpProductRepository |
| Comprador | front/src/app/(comprador)/minha-conta/ | OrdersProvider / AuthProvider |
| Checkout | front/src/app/(comprador)/checkout/page.tsx | use-checkout-session → checkout-attempt → HttpOrderRepository; decisão da simulação no servidor, resultados independentes por fornecedor |
| Fornecedor | front/src/app/(fornecedor)/painel-fornecedor/ | MarketProvider para pedidos diretos; catálogo próprio usa HttpProductRepository |
| Admin | front/src/app/admin/ | API para operação comercial; Firestore para listagem de perfis |

OrdersDataTable mantém estado e ações; orders-table/model.ts normaliza linhas, columns.tsx define colunas, OrdersTableView renderiza filtros/tabela/paginação e OrderDetailsDialog apresenta o detalhe. A decomposição não redefine regras de cancelamento ou transições.

## Representações e dependências

- DTO canônico: @contracts.
- Conta: domain/account.ts deriva o pedido do contrato, preservando explicitamente cotação legada e snapshots sem items.
- Fornecedor: domain/supplier.ts é projeção para painel, não uma segunda entidade persistida.
- Catálogo: products.ts deriva campos do DTO e preserva priceInCents na apresentação; conversão única em product-adapters.ts. Identificação pública por supplier-label.ts, sem nomes/estrelas de fixtures. Cadastro original em CreateOfferDialog; manutenção de preço/estoque em EditPriceDialog.
- order-adapters.ts concentra conversões de pedidos para conta/painel.
- account-mock.ts e supplier-mock.ts guardam fixtures; formatters.ts guarda helpers de exibição. Fixtures não conferem autenticação ou segurança.
- lib/compat/tanstack-table.ts e lib/compat/recharts.tsx são implementações locais; não equivalem automaticamente às APIs completas dos pacotes homônimos. Imports por caminho explícito.

## Recuperação de checkout

- checkout-attempt.ts persiste payload/chaves por UID antes de POST /orders; serializa submissões com Web Locks, conserva resultado desconhecido e permite replay da mesma chave. Não afirma transação única da sacola.
- cart-storage.ts usa fl.cart.v2 com itens e recibos na mesma gravação; migração de fl.cart.v1 preserva itens válidos. Confirmação desconta somente linhas compradas, idempotentemente.
- apiFetch pode exigir UID esperado, conferido antes/depois de obter token; tentativa antiga não é enviada por outra identidade.
- POST /orders gera metadados de simulação, recusa sem criar pedido, rejeita pending. Migração 0015 acrescenta payment_mode nullable, sem promover histórico antigo. Mock gateway e fulfillment não participam do checkout ativo.
- recordConfirmedOrders atualiza projeção do comprador a partir da resposta HTTP, sem renovação de sessão ou escrita em perfil.

## Backend e invariantes

- Rotas → validação Zod → autorização → persistência D1. O backend acessa dados por Drizzle/SQL; operações críticas podem ser extraídas em back/src/lib/.
- order-atomicity.ts grava pedido, itens, estoque e evento em D1.batch; controla concorrência/idempotência.
- suppliers.ts registra habilitação comercial versionada e decisão/auditoria na mesma transação; ofertas/novas compras exigem aprovação.
- Moderação administrativa usa moderation_blocked (migração 0014), separada de active; fornecedor não remove esse bloqueio. DELETE de produto desativa e preserva referências. Guards da compra revalidam ambos no D1.batch.
- Layout usa fontes locais com licenças em front/src/app/fonts/, sem fetch de fontes durante build.
- Pedidos anteriores continuam atendíveis por fornecedor suspenso, respeitadas regras de ownership/transição.
- Erros/requestId: packages/contracts/src/error.ts, back/src/lib/errors.ts, front/src/lib/api-client.ts e frontend-diagnostics.ts.

## Limites da versão

Compra/pagamento/entrega continuam simulados. Assistente/IA, leilão, push, gateway real e integrações externas são posteriores. MP-08 foi aprovado pelo usuário para avançar; MP-09 está tecnicamente concluído localmente, com avisos internos persistidos, aguardando aprovação humana. MP-10 continua não autorizado. A reconciliação não autoriza merge, deploy ou alteração de configuração remota. [Registro da reconciliação](../qa/reconciliacao-mp01-mp08.md).

## Navegação e evidência

Use node scripts/context.mjs packet e imports para escopo atual. CI em .github/workflows/validation.yml; testes front (Vitest/RTL), back (Vitest/D1 local), contratos e scripts. Homologação em navegador é evidência separada; mocks não comprovam integração real.

## Acompanhamento persistido — MP-06

A consulta GET /orders/:id?scope=... lê pedido, itens e order_events em um D1.batch. O contrato OrderDetail diferencia histórico completo, parcial e legado; IDs de ator e horários vêm dos eventos, sem inferir papéis ou fabricar eventos anteriores. Registros sem supplierId conservam o fallback legado por itens; quando existe snapshot do fornecedor, ele prevalece sobre o catálogo atual.

A apresentação OrderTracking é compartilhada por comprador, fornecedor e admin. Listas e detalhes usam use-live-order-query.ts: abertura/foco, 30 segundos com documento visível, atualização manual, uma consulta em andamento por recurso e descarte de respostas de outra conta. Falha de atualização preserva dados e apresenta erro. A leitura é HTTP; os adaptadores simulados não comprovam persistência. Consulta seletiva: node scripts/context.mjs packet order-tracking. Não há nova migração nesta etapa.

## Operações por papel — MP-07

As telas consultam a política visual order-actions.ts e usam use-order-operation.ts para serializar envios e reconciliar após sucesso/falha. O backend existente continua a impor ownership, transições e efeitos de estoque/eventos no D1.batch. Projeções preservam o vínculo do DTO; mutações HTTP conferem UID esperado. A resposta real atualiza o painel fornecedor. OrderTracking recebe uma revisão após operação; refresh(true) aguarda leitura em andamento antes da leitura atual, preservando ausência de sobreposição.

Fornecedor confirma/despacha/entrega; comprador cancela aguardando; fornecedor/admin cancelam antes do despacho com motivo. Estados terminais não reabrem. A orientação provisória do marco MP-07 foi substituída pela conversa persistida do MP-08 descrita abaixo. MP-07 não acrescentou migração ou alteração de autorização backend.

## Ocorrências persistidas — MP-08

Contrato em packages/contracts/src/occurrence.ts; handlers em back/src/routes/occurrences.ts; pacote seletivo order-occurrences. reports preserva a mensagem inicial, ID, read e horário; migração aditiva 0016 acrescenta estado/versão/autoria/resolução e report_messages para respostas. Registros anteriores continuam abertos, identificados como legados, sem inventar mensagens ou data de resolução.

GET/POST /orders/:id/occurrences e POST /orders/:id/occurrences/:reportId/messages usam identidade/papel do token e vínculo persistido. Comprador/fornecedor abrem; partes/admin consultam/respondem e podem resolver com uma resposta. Admin não abre em nome das partes. Toda resposta passa de aberta a em_atendimento ou encerra como resolvida; não existe transição de reabertura. Versão esperada e D1.batch tornam atualização de estado e resposta atômicas; requestId identifica replay, incluindo resposta perdida após commit.

Sem supplier_id no pedido, somente um snapshot de report anterior concede acesso ao fornecedor daquele report. Novas aberturas aguardam reconciliação do vínculo; não se atribui o fornecedor pelo proprietário atual do produto. Pedido/estoque/eventos comerciais não são alterados. O endpoint fornecedor POST /orders/:id/report permanece compatível com {message}, retornando {success,reportId}; consumidores novos enviam requestId para replay.

OrderOccurrences é compartilhado nas telas de comprador/fornecedor/admin; valida leitura e recibos contra os contratos, vincula UID e isola dados/rascunhos por conta/pedido. Atualiza ao abrir/foco/manualmente/30s visíveis; falha mantém o histórico, conflito exige revisão e envio incerto conserva a mesma solicitação no componente montado. Essa recuperação não promete durabilidade após recarga/fechamento ou entre dispositivos. Notificações internas são MP-09, sem promessa de caixa de avisos nesta etapa. Compra/pagamento/entrega continuam simulados.

## Avisos internos persistidos — MP-09

Migração 0017 cria notifications com fonte/ID/destinatário únicos, referência ao pedido/report, detalhe e created_at/read_at. Projeções em internal-notifications.ts são acrescentadas ao mesmo D1.batch de order_events, decisão/auditoria e report_messages; falha de aviso reverte a transação, replay não duplica nem reseta leitura. NOTIFICATIONS_ENABLED continua governando somente o canal externo preexistente. Não há caixa retroativa automática nem inferência de fornecedor pelo catálogo atual.

GET /notifications lista a caixa do token por cursor de ID (30 por página, máximo 50), com contagem global de não lidos; PATCH /notifications/:notificationId/read confirma leitura idempotente; GET /notifications/:notificationId/destination revalida propriedade do aviso e acesso atual ao recurso. Contrato notification.ts. Admin não recebe acesso à caixa de terceiros. Novo pedido vai ao fornecedor, estados ao comprador, cancelamento à contraparte; decisão ao fornecedor; resposta de ocorrência à outra parte. Ação administrativa de cancelamento/resolução avisa ambas, excluído o próprio ator.

Central /avisos para os três papéis, com entrada nos cabeçalhos público/fornecedor/admin e contagem de não lidos na página. NotificationCenter vincula UID/papel, pagina, atualiza em abertura/foco/30s visíveis e preserva dados em falha. Leitura é explícita; resposta perdida é recuperada por refresh/retry. Destinos são tipados, sem URL externa; OrderOccurrences aceita initialReportId para abrir a conversa exata. Consulte pacote internal-notifications e relatório MP-09. Sem email/push, merge, publicação ou migração remota.


## Supervisão e relatórios persistidos — MP-10

GET /admin/occurrences lista ocorrências com paginação/busca/estado; a conversa reutiliza o contrato de ocorrências e revalida autorização no destino. Admin só cancela pedidos aguardando/confirmado com motivo; confirmação/despacho/entrega pertencem ao fornecedor. Cancelamento administrativo acrescenta audit_logs a partir de order_events no mesmo D1.batch de pedido/estoque/aviso. Resposta/resolução administrativa acrescenta audit_logs no batch de reports/report_messages/aviso; motivo é o trecho inicial da resposta (até 500 caracteres), metadata aponta reportId/messageId e a mensagem integral permanece persistida. Replay não cria outra intervenção; falha de auditoria desfaz o batch. Moderação e decisões de fornecedor continuam com seus fluxos auditados.

GET /admin/reports/orders e GET /reports/orders retornam OrderReport (packages/contracts/src/report.ts). O segundo exige fornecedor e filtra exclusivamente orders.supplier_id persistido; não atribui legado pelo proprietário atual do produto. from/to inclusivos, calendário America/Fortaleza, moeda BRL, até 366 dias; default últimos30 dias. Uma consulta D1.batch lê até5001 linhas e conta datas inválidas no mesmo escopo. Acima5000, erro explícito sem total/CSV parcial. Busca literal por ID/UID/produto, estado atual e UID do fornecedor opcional para admin. Relatório agrupa pedidos CRIADOS no período pela situação atual, não eventos de entrega ocorridos no período.

Totais e série diária derivados das mesmas linhas. Valor simulado soma preços válidos dos pedidos não cancelados com payment_mode=simulated; valor legado fica separado. Recebimento financeiro é null (não apurado). Preço ausente/inválido não é imputado como zero; registros sem data válida são contados como excluídos do período, sem atribuição temporal fictícia. OrderReportPanel pagina20 linhas e exporta TODAS as linhas desse snapshot, sem segunda requisição. CSV UTF8 BOM, ponto-e-vírgula, células entre aspas, escape de aspas e neutralização de fórmulas; preços em centavos e datas/calendário explícitos.

Overview/relatórios ativos do fornecedor usam a API persistida, sem deltas, curvas, SLA, categorias ou motivos percentuais fixos. Helpers antigos de use-supplier-data permanecem apenas por compatibilidade com consumidores/testes legados; não alimentam os relatórios ativos. Novas consultas/mutações usam UID esperado; abas administrativas remontam na troca de conta. Nenhuma migração adicional ao esquema0017 e nenhuma ativação remota nesta etapa. Pacote seletivo admin-supervision.
