---
name: domain-fornecedor
description: Painel fornecedor: catálogo próprio, pedidos, habilitação e projeções de dados.
---

# Fornecedor

- Rotas: front/src/app/(fornecedor)/painel-fornecedor/. Layout externo exige papel fornecedor via RoleProtectedRoute e herda providers da raiz.
- Catálogo próprio: catalogo/page.tsx mantém estado local e usa HttpProductRepository; a API exige ownership e habilitação aprovada para publicar/editar. Não declarar homologação remota a partir do código local.
- Pedidos diretos: MarketProvider usa HttpOrderRepository quando NEXT_PUBLIC_USE_BACKEND=true. Fixtures de mercado/ofertas são demonstração separada, com leilão desabilitado.
- Habilitação: SupplierApprovalStatus consulta/cria a solicitação no D1; admin decide via API. Claim de fornecedor não significa aprovação comercial.
- Tipos do painel: front/src/lib/domain/supplier.ts. Contrato persistido: @contracts. Conversões: order-adapters.ts; fixtures em supplier-mock.ts; helpers de exibição em formatters.ts.

## Tabela de pedidos

OrdersDataTable.tsx controla estado/ações. Submódulos em components/fornecedor/orders-table/: model.ts (normalização), columns.tsx (colunas), OrdersTableView.tsx (filtros/tabela/paginação), OrderDetailsDialog.tsx (detalhe controlado). Use node scripts/context.mjs packet supplier-orders e leia só o bloco afetado.

- Contrato público e export de SupplierOrderRow preservados pelo controller.
- Cancelamento solicita motivo; regras de permissão/transição são confirmadas pela API, não concedidas pela tela. Alterações dessas regras pertencem ao MP autorizado.
- Alterar o adapter/modelo exige verificar conta, fornecedor e testes do contrato.

## Catálogo e UI

- HTTP usa priceCents; apresentação do catálogo usa priceInCents. product-adapters.ts é a fronteira explícita.
- oldPriceCents é controlado pela regra de preço no backend; confirmar consumidor antes de alterar.
- active controla publicação; suspensão bloqueia novas vendas sem impedir atendimento de pedidos anteriores.
- Navegação: SupplierSidebar e SupplierHeader. Consultar layout da raiz e do route group ao mudar providers.
- Imports de tabela/gráficos em lib/compat/ são implementações locais, não pacotes completos. Ler o módulo antes de assumir APIs da biblioteca homônima.

Escopo: components/fornecedor/ e rotas do fornecedor. Código compartilhado exige risk-zone-protocol; UI exige ui-system; contratos/API exigem api-contract. Não alterar primitivos, globals ou regras de outro domínio incidentalmente.
