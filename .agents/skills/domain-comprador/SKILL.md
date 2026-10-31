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
- Checkout page.tsx mantém orquestração, pagamento/fulfillment simulados e idempotência. Etapas visuais em components/checkout/: CheckoutAddressStep, CheckoutReviewStep, CheckoutPaymentStep e CheckoutConfirmationStep.
- Execute node scripts/context.mjs packet checkout para navegar por etapa. Não carregar as quatro etapas para uma correção localizada de apresentação.
- Endereço vem do perfil ou preenchimento explícito; pagamento é simulado, sem dados reais de cartão. Não alterar fluxo comercial nesta refatoração.
- Compra e cancelamento atravessam adapters/API; sucesso de mock não comprova operação publicada. Cotação/leilão permanecem fora da versão.

## Acoplamentos a conferir

OrderCard usa também useMarket para compatibilidade de snapshots do fornecedor. Ao alterar shape de pedido/provider, examinar esse consumidor e o adapter. Produtos usam a projeção do catálogo (priceInCents); persistência usa priceCents.

Escopo: components/minha-conta/, components/checkout/ e rotas do comprador. Providers, modelos compartilhados e outros domínios exigem risk-zone-protocol; UI exige ui-system. Não remover compatibilidade ou alterar regras de negócio incidentalmente.
