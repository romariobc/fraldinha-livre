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

Compra/pagamento continuam simulados. Assistente/IA, leilão, push, gateway real e integrações externas são posteriores. Respostas de ocorrências e notificações internas completas seguem os MPs correspondentes. Nada nesta refatoração autoriza MP-04, merge, deploy ou alteração remota.

## Navegação e evidência

Use node scripts/context.mjs packet e imports para escopo atual. CI em .github/workflows/validation.yml; testes front (Vitest/RTL), back (Vitest/D1 local), contratos e scripts. Homologação em navegador é evidência separada; mocks não comprovam integração real.

## Acompanhamento persistido — MP-06

A consulta GET /orders/:id?scope=... lê pedido, itens e order_events em um D1.batch. O contrato OrderDetail diferencia histórico completo, parcial e legado; IDs de ator e horários vêm dos eventos, sem inferir papéis ou fabricar eventos anteriores. Registros sem supplierId conservam o fallback legado por itens; quando existe snapshot do fornecedor, ele prevalece sobre o catálogo atual.

A apresentação OrderTracking é compartilhada por comprador, fornecedor e admin. Listas e detalhes usam use-live-order-query.ts: abertura/foco, 30 segundos com documento visível, atualização manual, uma consulta em andamento por recurso e descarte de respostas de outra conta. Falha de atualização preserva dados e apresenta erro. A leitura é HTTP; os adaptadores simulados não comprovam persistência. Consulta seletiva: node scripts/context.mjs packet order-tracking. Não há nova migração nesta etapa.

## Operações por papel — MP-07

As telas consultam a política visual order-actions.ts e usam use-order-operation.ts para serializar envios e reconciliar após sucesso/falha. O backend existente continua a impor ownership, transições e efeitos de estoque/eventos no D1.batch. Projeções preservam o vínculo do DTO; mutações HTTP conferem UID esperado. A resposta real atualiza o painel fornecedor. OrderTracking recebe uma revisão após operação; refresh(true) aguarda leitura em andamento antes da leitura atual, preservando ausência de sobreposição.

Fornecedor confirma/despacha/entrega; comprador cancela aguardando; fornecedor/admin cancelam antes do despacho com motivo. Estados terminais não reabrem. Orientação de ocorrência após despacho é explícita sobre indisponibilidade de submissão/resposta até MP-08. Não há nova migração ou alteração de autorização backend nesta etapa.
