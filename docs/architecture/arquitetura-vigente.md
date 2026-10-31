# Arquitetura vigente no código local — 2026-10-31

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
| Checkout | front/src/app/(comprador)/checkout/page.tsx | Orquestra providers e adapters de pagamento/fulfillment simulados; etapas visuais em components/checkout/ |
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

## Backend e invariantes

- Rotas → validação Zod → autorização → persistência D1. O backend acessa dados por Drizzle/SQL; operações críticas podem ser extraídas em back/src/lib/.
- order-atomicity.ts grava pedido, itens, estoque e evento em D1.batch; controla concorrência/idempotência.
- suppliers.ts registra habilitação comercial versionada e decisão/auditoria na mesma transação; ofertas/novas compras exigem aprovação.
- Moderação administrativa usa moderation_blocked (migração 0014), separada de active; fornecedor não remove esse bloqueio. DELETE de produto desativa e preserva referências. Guards da compra revalidam ambos no D1.batch.
- Layout usa fontes locais com licenças em front/src/app/fonts/, sem fetch de fontes durante build.
- Pedidos anteriores continuam atendíveis por fornecedor suspenso, respeitadas regras de ownership/transição.
- Erros/requestId: packages/contracts/src/error.ts, back/src/lib/errors.ts, front/src/lib/api-client.ts e frontend-diagnostics.ts.

## Limites da versão

Compra/pagamento continuam simulados. Assistente/IA, leilão, push, gateway real e integrações externas são posteriores. Respostas de ocorrências e notificações internas completas seguem os MPs correspondentes. Nada nesta refatoração autoriza MP-04, merge, deploy ou alteração remota.

## Navegação e evidência

Use node scripts/context.mjs packet e imports para escopo atual. CI em .github/workflows/validation.yml; testes front (Vitest/RTL), back (Vitest/D1 local), contratos e scripts. Homologação em navegador é evidência separada; mocks não comprovam integração real.
