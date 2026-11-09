---
name: domain-comprador
description: Conta e checkout do comprador: controllers, providers e modelos de apresentação.
---

# Comprador

- Rotas: front/src/app/(comprador)/minha-conta/ e checkout/. O layout do grupo exige papel comprador via RoleProtectedRoute.
- Conta: controller usa useOrders/useAuth, com tabs pedidos/historico/perfil; tab inicial pode vir de ?tab= e returnTo é encaminhado ao perfil.
- Perfil real: AuthProvider/Firestore; updateProfile não grava role. Fixtures não comprovam autenticação nem persistência.
- Pedidos: OrdersProvider escolhe HttpOrderRepository ou MockOrderRepository por NEXT_PUBLIC_USE_BACKEND. Não inicializar a conta diretamente de INITIAL_ORDERS.
- Tipos de apresentação: lib/domain/account.ts, derivados de @contracts com compatibilidade legada explícita; conversões em order-adapters.ts. account-mock.ts contém somente fixtures.
- Linhas: getOrderItems em lib/order-items.ts preserva fallback para snapshots antigos sem items.

## Controllers e componentes

- PedidosTab: pedidos não encerrados; HistoricoTab: entregue/cancelado; PerfilTab: perfil/endereço; OrderCard: apresentação e ações permitidas.
- Checkout page.tsx coordena apresentação; use-checkout-session.ts restaura tentativa por UID e usa checkout-attempt.ts para grupos/chaves estáveis. Etapas visuais em components/checkout/. CheckoutConfirmationStep apresenta resultados por fornecedor, inclusive falhas e recuperação.
- Execute node scripts/context.mjs packet checkout para navegar por etapa. Não carregar as quatro etapas para uma correção localizada de apresentação.
- Endereço vem do perfil ou preenchimento explícito, validado por CheckoutAddressSchema. POST /orders decide aprovação/recusa simuladas e gera paymentMode/transactionId/status no servidor; pending não é opção de checkout. Sem dados reais de cartão.
- Checkout usa HTTP obrigatório, independente do modo legado de OrdersProvider. recordConfirmedOrders atualiza cache sem forçar renovação da sessão. MockPaymentGateway/MockFulfillmentService não participam do checkout ativo.
- CartProvider mantém API antiga useCart e API interna useCheckoutCart. cart-storage.ts grava envelope fl.cart.v2 com itens/recibos juntos; lê fl.cart.v1 para migração. Confirmação subtrai somente quantidades confirmadas, uma vez por recibo.
- Tentativa fl.checkout.v1:<UID> conserva payload e chave por fornecedor antes da rede. Web Locks coordena abas. Nunca regenerar chave ou descartar resultado desconhecido automaticamente; métodos/endereço/itens ficam congelados até resolução.
- Compra e cancelamento atravessam adapters/API; sucesso de mock não comprova operação publicada. Cotação/leilão permanecem fora da versão.

## Acoplamentos a conferir

OrderCard usa também useMarket para compatibilidade de snapshots do fornecedor. Ao alterar shape de pedido/provider, examinar esse consumidor e o adapter. Produtos usam a projeção do catálogo (priceInCents); persistência usa priceCents.

Escopo: components/minha-conta/, components/checkout/ e rotas do comprador. Providers, modelos compartilhados e outros domínios exigem risk-zone-protocol; UI exige ui-system. Não remover compatibilidade ou alterar regras de negócio incidentalmente.

## Acompanhamento MP-06

GET /orders/:id?scope=comprador|fornecedor|admin retorna OrderDetail: snapshot e eventos lidos no mesmo D1.batch, com historySource complete/partial/legacy. Não criar eventos retroativos. O vínculo explícito supplierId prevalece; somente legado sem vínculo mantém o fallback anterior por itens/produtos. OrderTracking é a apresentação compartilhada. use-live-order-query.ts atualiza ao montar, foco/visibilidade e a cada 30s visíveis, compartilha consulta em andamento e preserva dados em erro. Chaves incluem conta/escopo/pedido e descartam respostas após troca de conta. Pacote: node scripts/context.mjs packet order-tracking.

## Operações MP-07

order-actions.ts define disponibilidade visual por papel/vínculo/estado; backend mantém decisão definitiva. use-order-operation.ts serializa envio, reconcilia após erro/sucesso e conserva feedback acionável. Mutations HTTP vinculam UID esperado; fornecedor usa o snapshot retornado. OrderTracking recebe refreshVersion após operação e usa refresh(true) para esperar leitura anterior antes de consultar o estado atual. Motivo fornecedor/admin é obrigatório; após despacho só entrega pelo fornecedor e orientação para ocorrência. Abertura/resposta de ocorrência pertence à MP-08, sem envio fictício. Pacote: node scripts/context.mjs packet order-operations.

## Ocorrências MP-08

OrderOccurrences compartilha abertura/conversa/resolução persistidas nos detalhes de pedidos, em todos os estados. Usa occurrence.ts, UID esperado e leitura isolada por conta/pedido. Resolvida é somente leitura; ocorrência não cancela nem repõe estoque. OrderIssueGuidance agora abre o fluxo real; OrderReportDialog legado usa a mesma conversa, sem prometer aviso na caixa de notificações. Consulte pacote order-occurrences e api-contract para permissão, legado e versão/replay. Notificações internas continuam MP-09.

## Avisos MP-09

/avisos usa NotificationCenter e API real, sem fixtures de mensagens. NotificationLink aparece nos cabeçalhos; contagem de não lidos na central. UID/papel isolam dados e ações, paginação é por ID e leitura explícita é idempotente. Destinos revalidam acesso: OrderTracking ou OrderOccurrences(initialReportId) para conversa exata; cadastro somente na rota fixa do fornecedor. Habilitação comercial não bloqueia leitura de avisos/pedidos anteriores. Consultar pacote internal-notifications.
