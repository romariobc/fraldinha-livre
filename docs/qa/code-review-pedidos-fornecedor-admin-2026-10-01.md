# Relatório de Code Review e Correções — Fluxo de Pedidos, Fornecedor, Admin e Teste E2E

Data: 2026-10-01
Escopo: Correção e reconciliação dos achados de code review do fluxo Comprador -> Fornecedor -> Admin e confiabilidade do teste E2E.
Status Geral: **Revisão e Implementação Concluídas com Evidências Auditadas (Sem Escrita em Produção)**

---

## 1. Matriz Consolidada de Status por Achado

| Achado | Status | Detalhes da Resolução e Limites |
|---|---|---|
| **Erro invisível ao fornecedor** | **Corrigido** | `MarketContext` expõe `directOrdersError`, `directOrdersDiagnostic` e `refetchDirectOrders`. `OrdersDataTable` renderiza estado amigável de erro, botão "Tentar novamente", cópia segura de `requestId` e suprime estado vazio falso em falha de API. |
| **Retry dispara nova consulta** | **Corrigido** | Comprovado por testes unitários e comportamentais em `OrdersDataTable.test.tsx` e `market-context.test.tsx`. |
| **Retry visual recupera após sucesso** | **Homologado** | Validado em Chromium com backend ativo em porta 8787 e D1 local: clique em "Tentar novamente" suprime estado de erro e carrega pedidos reais instantaneamente com contadores e paginação. |
| **Refresh manual do fornecedor** | **Corrigido e Homologado** | Adicionado botão manual "Atualizar pedidos" na toolbar de `OrdersDataTable`, desabilitado durante refresh e preservando dados prévios com banner em falha. Homologado visualmente em desktop e mobile. |
| **Transição de status na UI** | **Homologado** | Fornecedor aciona "Confirmar Pedido" via menu contextual da linha na UI; backend persiste no D1 (`PATCH /orders/:id/status` HTTP 200) e refresh atualiza contadores dinâmicos. |
| **Refresh manual do admin** | **Corrigido por teste automatizado** | Teste comportamental em `AdminOrdersTab.test.tsx` comprovou chegada de novo pedido na tabela após acionar refresh manual. |
| **API admin encontra mesmo pedido** | **Corrigido** | Passo 12 do script `test-e2e-catalog-to-history.mjs` e função `validateAdminOrder` validam rigorosamente o mesmo `createdOrderId`, comprador, fornecedor, itens e pagamento. |
| **Admin visual autenticado** | **Pendente** | Não executada homologação visual da rota `/admin` com usuário administrativo real nesta sessão. |
| **E2E erroneamente chamado de UI** | **Corrigido** | Script e documentação reclassificados como API E2E (REST), sem falsas alegações de homologação de componentes visuais. |
| **Exit code em falha** | **Corrigido** | Função pura `computeSummary` garante `exitCode = 1` se qualquer etapa (inclusive teardown/cleanup) falhar. |
| **Cleanup integral** | **Pendente (restrito a ambiente isolado)** | Pedidos de compra direta persistem no D1; limpeza integral somente é possível em ambiente isolado descartável (D1 local / preview). |
| **Poluição em produção** | **Parcialmente corrigido** | Trava fail-closed mantida (`QA_ALLOW_PRODUCTION_WRITE=true` exigido; bloqueia com `exitCode = 2` e status "NÃO EXECUTADO"). Se habilitada excepcionalmente, o pedido permanece no D1 para auditoria. |
| **Toast duplicado** | **Corrigido** | Removidos toasts do `market-context.tsx`; feedback visual centralizado unicamente nos handlers de UI em `OrdersDataTable.tsx`. |
| **Mobile** | **Homologado** | Viewports 390×844 e 360×800 validados visualmente: sidebar retrátil, cards de KPI verticais, tabela com scroll horizontal sem overflow global de viewport. |

---

## 2. Detalhamento Técnico das Implementações

### 2.1. Erro de pedidos visível ao fornecedor e Concorrência Resiliente
- **Implementação**:
  - `front/src/contexts/market-context.tsx`: expõe `refetchDirectOrders(): Promise<void>`, `directOrdersDiagnostic?: DiagnosticResult` e `directOrdersError`.
  - Controle de concorrência com ref sequencial (`activeFetchIdRef`) para descarte estrito de respostas tardias em desmontagem, logout ou retries rápidos.
  - Isolamento de estado entre fornecedores: estado exposto é derivado para `[]` se `!user || role !== 'fornecedor'`, impedindo vazamento de pedidos anteriores ao deslogar ou trocar de conta.
  - `front/src/components/fornecedor/OrdersDataTable.tsx`: consome o erro e `requestId` estruturado; exibe mensagem amigável com botão "Tentar novamente" e suprime o falso aviso de lista vazia.
- **Evidência Comportamental**: 20 testes em `market-context.test.tsx` e 18 testes em `OrdersDataTable.test.tsx` aprovados com 100% de sucesso.

### 2.2. Atualização Manual dos Pedidos no Fornecedor e Admin
- **Implementação**:
  - No Fornecedor: botão manual "Atualizar pedidos" na barra superior de `OrdersDataTable`, conectado a `refetchDirectOrders` com spinner de carregamento (`isRefreshing`). Se o refresh falhar após a tabela já ter dados, os dados existentes são mantidos e um banner de erro com código de suporte é renderizado.
  - No Admin: validação comportamental em `AdminOrdersTab.test.tsx` confirmou que novos pedidos gerados dinamicamente passam a ser renderizados na tabela após o clique em atualizar, mantendo paginação e filtros.

### 2.3. Correção da Semântica E2E e Observabilidade Administrativa da API
- **Implementação**:
  - Nomenclatura e saída do script `scripts/test-e2e-catalog-to-history.mjs` esclarecem que se trata de uma suíte **API E2E (REST)**.
  - Passo 12 implementado via `validateAdminOrder`, consultando `GET /orders?scope=admin` e validando:
    * `id` correspondente ao pedido criado;
    * `uid` do comprador;
    * `supplierId` e `supplierName`;
    * `status`;
    * `items` (presença e correspondência do produto);
    * `paymentMethod`, `paymentStatus` e `paymentTransactionId`.
  - Credenciais administrativas (`QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`) obtidas exclusivamente de variáveis de ambiente, sem fallbacks hardcoded. A função `checkPrerequisites` valida credenciais antes de qualquer escrita no banco.

### 2.4. Semântica Estrita de Exit Code e Trava de Produção Unificada
- **Implementação**:
  - Convenção unificada de segurança operacional: `QA_ALLOW_PRODUCTION_WRITE=true` (ou flag `--allow-production-write`).
  - Execução contra produção sem a flag é bloqueada com status "NÃO EXECUTADO", exit code 2 e veredito `BLOQUEADO_POR_SEGURANCA`.
  - `computeSummary` avalia o array completo de resultados: falhas de teardown produzem `allPassed = false`, veredito `FALHA_DE_LIMPEZA` e `exitCode = 1`.
  - Template documentado em `scripts/env.qa.example` com campos vazios seguros.

---

## 3. Registro da Homologação Visual

### 3.1. Rodada 1 — Estado de Erro, Retry e RBAC do Fornecedor (2026-10-01)
- **Ambiente**: Servidor Next.js local na porta 3000 com backend local (8787) inativo para condição forçada de falha de rede (`NetworkError`).
- **Navegador**: Chromium desktop (1280×900).
- **Evidências**:
  - Login executado com conta de fornecedor (`fornecedor.teste1@fraldinhalivre.com.br`).
  - Redirecionamento correto para `/painel-fornecedor`.
  - Bloqueio de acesso a `/admin` por role protection (redirecionado para fora).
  - Acesso a `/painel-fornecedor/pedidos`: mensagem amigável exibida (*"Não foi possível carregar os pedidos diretos. Tente novamente."*).
  - Falso estado de lista vazia (*"Nenhum pedido encontrado"*) suprimido.
  - Presença dos botões "Atualizar pedidos" e "Tentar novamente".
  - Screenshot: `docs/qa/screenshots/fornecedor_pedidos_error_state.png`.

### 3.2. Rodada 2 — Recuperação Visual, Pedidos Reais, Transição de Status e Viewports Mobile (2026-10-03)
- **Ambiente**: Servidor Next.js (3000) e Cloudflare Worker local (`wrangler dev --port 8787`) conectado a D1 local (`DB`).
- **Cenários Executados e Auditados**:
  1. **Recuperação Instantânea Pós-Sucesso (Desktop 1280×900)**:
     - Com o backend no ar, o clique em "Tentar novamente" (`refetchDirectOrders`) transitou temporariamente para "Carregando pedidos..." desabilitando o botão de refresh.
     - A resposta HTTP 200 carregou com sucesso 2 pedidos reais do fornecedor (`ord-local-qa-001` e `ord-local-qa-002`).
     - Alerta de erro desapareceu; tabela exibiu linhas detalhadas com ID (#ord-local-qa-001/002), data/hora, comprador B2B, destino (São Paulo/Curitiba), itens e valores (R$ 89,90 e R$ 125,50).
     - Contadores de KPI atualizaram dinamicamente: 1 aguardando, 1 confirmado, receita R$ 215,40.
     - Abas de filtro calcularam totais: Todos(2), Aguardando(1), Confirmados(1).
     - Screenshot: `docs/qa/screenshots/fornecedor_pedidos_recovered_success_1280.png`.
  2. **Transição de Status pelo Fornecedor em Tempo Real**:
     - No menu contextual de ações da linha (`...`), foi acionada a ação "Confirmar Pedido".
     - Disparada requisição `PATCH /orders/ord-local-qa-001/status` com sucesso (HTTP 200), auditada no log do backend com evento `order.status.updated`.
     - O botão "Atualizar pedidos" foi acionado; a tabela refletiu ambos os pedidos em `Confirmado`, e os KPIs transitaram para Aguardando: 0, Confirmados: 2.
     - Screenshot: `docs/qa/screenshots/fornecedor_pedidos_refreshed_both_confirmed_1280.png`.
  3. **Responsividade em Viewports Mobile (390×844 e 360×800)**:
     - Em 390×844 (iPhone standard) e 360×800 (Android standard):
       * Sidebar é recolhida automaticamente para botão hamburger no topo (`Alternar barra lateral`).
       * Top banner exibe breadcrumb e menu compacto do fornecedor.
       * Cards de KPI empilham-se verticalmente com legibilidade e sem quebras de layout.
       * Barra de filtros, busca e botão de atualização permanecem acessíveis e alinhados.
       * Tabela de pedidos mantém scroll horizontal fluido sem transbordar o viewport global.
       * Menu dropdown de ações e botões de paginação operam sem sobreposição.
     - Screenshots: `docs/qa/screenshots/fornecedor_pedidos_mobile_390.png`, `docs/qa/screenshots/fornecedor_pedidos_mobile_360.png` e `docs/qa/screenshots/fornecedor_pedidos_status_updated_360.png`.

- **Arquivamento**: Todas as capturas estão preservadas localmente em `docs/qa/screenshots/` (ignorado pelo Git para prevenir poluição do repositório).

---

## 4. Matriz de Evidências por Categoria de Teste

| Categoria | Escopo | Execução Real | Resultado |
|---|---|---|---|
| **Testes Unitários (Frontend)** | `OrdersDataTable`, `MarketContext`, `AdminOrdersTab`, `OrderCard`, `PedidosPage`, `Adversarial` | `npx vitest run ...` (7 arquivos) | **91 testes aprovados (100%), exit code 0** |
| **Testes Unitários (E2E Logic)** | `scripts/test-e2e-logic.test.mjs` (trava, prereq, admin validation, summary) | `node --test scripts/test-e2e-logic.test.mjs` (4 suítes) | **19 testes aprovados (100%), exit code 0** |
| **Integração Local (Backend)** | `orders.get`, `orders.mutations`, `orders.scope-admin`, `orders.scope-fornecedor`, `orders.status` | `npx vitest run ...` (5 arquivos) | **45 testes aprovados (100%), exit code 0** |
| **Contratos Compartilhados** | `@fraldinha-livre/contracts` | `npm test` em `packages/contracts` (7 arquivos) | **56 testes aprovados (100%), exit code 0** |
| **Tipagem Estática (TS)** | `front/` e `back/` | `npx tsc --noEmit` em ambos os workspaces | **0 erros, exit code 0** |
| **Linters (ESLint)** | Componentes e contextos alterados em `front/` | `npx eslint ...` | **0 erros, 4 avisos triados (0 introduzidos por esta PR)** |
| **Sintaxe de Scripts** | `scripts/test-e2e-catalog-to-history.mjs` | `node --check scripts/test-e2e-catalog-to-history.mjs` | **0 erros, exit code 0** |
| **API E2E com Escrita Remota** | Execução real contra produção | **Não executado** (trava fail-closed mantida para não poluir banco remoto) | Deliberadamente preservado |

---

## 5. Comandos e Saídas Exatas da Última Execução

### 5.1. Frontend Vitest
```bash
npx vitest run \
  "src/app/(fornecedor)/painel-fornecedor/pedidos/__tests__/page.test.tsx" \
  src/components/fornecedor/__tests__/OrdersDataTable.test.tsx \
  src/components/fornecedor/__tests__/milestone3-adversarial.test.tsx \
  src/contexts/__tests__/market-context.test.tsx \
  src/lib/adapters/__tests__/http-order-repository.test.ts \
  src/components/admin/__tests__/AdminOrdersTab.test.tsx \
  src/contexts/__tests__/orders-context.backend.test.tsx
```
- **Test Files**: 7 passed (7)
- **Tests**: 91 passed (91)
- **Exit code**: 0
- **Duração**: 7.82s

### 5.2. Frontend Typecheck & ESLint
```bash
npx tsc --noEmit
# Exit code: 0

npx eslint \
  "src/app/(fornecedor)/painel-fornecedor/pedidos" \
  "src/components/fornecedor" \
  "src/contexts/market-context.tsx" \
  "src/components/admin/AdminOrdersTab.tsx"
```
- **Exit code**: 0
- **Avisos triados (4 warnings, 0 erros)**:
  1. `AddProductDialog.tsx:73:11`: warning `'user' is assigned a value but never used` (pré-existente).
  2. `OrderReportDialog.tsx:15:10`: warning `'useAuth' is defined but never used` (pré-existente).
  3. `OrderReportDialog.tsx:50:14`: warning `'error' is defined but never used` (pré-existente).
  4. `OrdersDataTable.tsx:683:17`: warning `Compilation Skipped: Use of incompatible library (TanStack Table useReactTable)` (aviso do React Compiler).

### 5.3. Backend Vitest & Typecheck
```bash
npx vitest run \
  test/orders.get.test.ts \
  test/orders.mutations.test.ts \
  test/orders.scope-admin.test.ts \
  test/orders.scope-fornecedor.test.ts \
  test/orders.status.test.ts
```
- **Test Files**: 5 passed (5)
- **Tests**: 45 passed (45)
- **Exit code**: 0
- **Duração**: 15.52s

```bash
npx tsc --noEmit
# Exit code: 0
```

### 5.4. Contratos Compartilhados
```bash
npm test --workspace packages/contracts
```
- **Test Files**: 7 passed (7)
- **Tests**: 56 passed (56)
- **Exit code**: 0

### 5.5. Testes da Lógica do Script E2E (Node Test Runner)
```bash
node --test scripts/test-e2e-logic.test.mjs
```
- **Suites**: 4 passed (4)
- **Tests**: 19 passed (19)
- **Exit code**: 0

---

## 6. Declaração Explícita de Limitações e Escopo

1. **Ambiente D1 Utilizado**:
   - Os testes foram executados exclusivamente contra o runtime D1 local em memória simulado via Vitest/Miniflare.
   - Nenhuma requisição de escrita foi disparada contra o banco de dados remoto de produção `fraldinha-livre-db`.
2. **Deploy Remoto**:
   - Nenhum deploy foi realizado no Cloudflare Workers ou Cloudflare Containers.
3. **Merge**:
   - Nenhum merge foi executado para a branch `main`. As alterações estão restritas à branch `fix/orders-flow-supplier-admin-e2e` (PR #18).
4. **Pendências Mantidas**:
   - **Admin visual autenticado**: pendente de sessão com credencial e navegador dedicado da conta administradora.
   - *(Concluído nesta sessão)*: Homologação visual em viewports mobile (390px e 360px), recuperação pós-sucesso com pedidos reais do D1 local e transição de status na UI concluídas com 100% de sucesso.
