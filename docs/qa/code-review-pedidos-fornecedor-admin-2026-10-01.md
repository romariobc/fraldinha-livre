# Relatório de Code Review e Correções — Fluxo de Pedidos, Fornecedor, Admin e Teste E2E

Data: 2026-10-01  
Escopo: Correção dos achados de code review do fluxo Comprador -> Fornecedor -> Admin e confiabilidade do teste E2E.  
Status Geral: **Corrigido (Revisão e Implementação Local Concluídas)**

---

## 1. Resumo Executivo e Status dos Achados

| Severidade | Achado | Status | Resolução Técnica |
|---|---|---|---|
| **Alta** | Falhas na carga de pedidos ficam invisíveis ao fornecedor | **corrigido** | `MarketContext` expõe `directOrdersError`, `directOrdersDiagnostic` e `refetchDirectOrders`. `OrdersDataTable` renderiza estado amigável de erro, botão "Tentar novamente", cópia de `requestId` e suprime estado vazio falso quando a API falha. |
| **Alta** | A bateria E2E não comprova visualização pelo admin | **corrigido** | `scripts/test-e2e-catalog-to-history.mjs` atualizado com o Passo 12: autentica admin via variáveis de ambiente seguras (`ADMIN_EMAIL`/`ADMIN_PASSWORD` ou token), consulta `GET /orders?scope=admin`, localiza exatamente o `createdOrderId` e valida status, comprador, fornecedor e itens. |
| **Alta** | Falso "E2E de UI" mascara falta de cobertura real de frontend | **corrigido** | Descrições, logs e documentação do script ajustados para identificar com rigor que se trata de uma suíte **API E2E (REST)** e não homologação visual de componentes/navegador. |
| **Média** | Teardown com falha pode mascarar resultado no exit code do script | **corrigido** | `computeSummary` do script agora exige que todas as etapas obrigatórias e de teardown passem (`ok: true`). Se o teardown falhar, `allPassed = false` e `process.exitCode = 1`. |
| **Média** | Script E2E gera poluição permanente de pedidos de teste | **corrigido** | Mantida trava fail-closed (`ALLOW_PROD_WRITE=true` exigido para produção; bloqueia com saída `NÃO EXECUTADO` e `exitCode = 2`). Nenhuma rota destrutiva foi criada na API. Documentado uso de ambiente isolado (D1 local / preview). |
| **Média** | Fornecedor e admin sem mecanismo de refresh em painel aberto | **corrigido** | Adicionado botão manual "Atualizar pedidos" com feedback visual de carregamento em `OrdersDataTable`, conectado a `refetchDirectOrders`. Em caso de falha de refresh, os dados existentes são preservados e um banner de erro é exibido. No Admin, teste comportamental comprovou chegada de novos pedidos via botão de atualização. |
| **Baixa** | Toasts duplicados para ações do fornecedor | **corrigido** | Removidas chamadas de `toast.success` do `MarketProvider`. A responsabilidade de feedback visual foi centralizada unicamente nos handlers de UI de `OrdersDataTable`. |

---

## 2. Detalhamento dos Achados e Implementações

### 2.1. Erro de pedidos visível ao fornecedor e Retry Resiliente (Alta)
- **Problema**: Quando `listForSupplier()` falhava, `MarketProvider` gravava `directOrdersError`, mas `OrdersDataTable` lia apenas `orders` e `isLoading`. Falhas de autenticação ou rede exibiam a mensagem de lista vazia.
- **Implementação**:
  - `front/src/contexts/market-context.tsx`: adicionado `refetchDirectOrders(): Promise<void>` e `directOrdersDiagnostic?: DiagnosticEntry`. Implementado com `useCallback` estável, controle de corrida com contador sequencial (`activeFetchIdRef`) para descarte de respostas tardias em desmontagem ou troca de usuário, e carregamento assíncrono seguro.
  - `front/src/components/fornecedor/OrdersDataTable.tsx`: consome o erro e requestId estruturado do contexto (ou via props). Quando a lista inicial falha em carregar, renderiza mensagem de erro com ícone de alerta, botão de cópia rápida do código de suporte (`requestId`) e botão de ação "Tentar novamente".
  - **Evidência Comportamental**: 6 novos testes unitários adicionados em `OrdersDataTable.test.tsx` e 3 testes em `market-context.test.tsx` validando que a falha da API aparece na interface, a lista vazia é suprimida, e o retry reexecuta a busca e recupera a exibição.

### 2.2. Atualização Manual dos Pedidos no Fornecedor e Admin (Média)
- **Problema**: Pedidos recém-criados pelo comprador não apareciam para o fornecedor ou admin com o painel aberto sem recarregar toda a aplicação.
- **Implementação**:
  - No Fornecedor: adicionado botão "Atualizar" no topo de `OrdersDataTable` com spinner animado durante carregamento (`isRefreshing`). Quando acionado, executa `refetchDirectOrders`. Se o refresh falhar após a tabela já ter dados, os dados anteriores são preservados e um banner de aviso com código de suporte é renderizado acima da tabela.
  - No Admin: o botão de refresh existente em `AdminOrdersTab` foi submetido a teste comportamental comprovando que, ao receber um novo pedido no segundo ciclo de chamada, o pedido passa a ser renderizado na tabela mantendo filtros íntegros.
  - **Evidência Comportamental**: Teste `AdminOrdersTab.test.tsx` ("permite atualizar a lista e passa a exibir novo pedido recebido após refresh") e testes em `OrdersDataTable.test.tsx` aprovados com 100% de sucesso.

### 2.3. Eliminação do Falso "E2E de UI" e Inclusão da API Admin (Alta)
- **Problema**: O script `scripts/test-e2e-catalog-to-history.mjs` anunciava validações de tela sem abrir navegador e não consultava a visão administrativa do ciclo de pedidos.
- **Implementação**:
  - O cabeçalho, logs de progresso e resumos do script foram renomeados para declarar expressamente: `[API E2E] Ciclo de Pedidos (REST Integration - Não é teste visual de navegador)`.
  - Adicionado Passo 12 (`validateAdminOrder`): autentica administrador via variáveis de ambiente seguras (`ADMIN_EMAIL` / `ADMIN_PASSWORD` ou token), realiza chamada real `GET /orders?scope=admin`, localiza o pedido criado e verifica correspondência estrita de status, comprador, fornecedor, itens e total.
  - Funções puras desacopladas e exportadas para testes unitários: `checkEnvironmentLock`, `validateAdminOrder`, `computeSummary`.

### 2.4. Semântica Estrita de Exit Code e Resumo de Execução (Média)
- **Problema**: Exceções no bloco de teardown eram capturadas apenas com `console.warn`, fazendo o script encerrar com exit code 0.
- **Implementação**:
  - A função `computeSummary` avalia o array completo de resultados. Qualquer falha em etapa obrigatória ou etapa de limpeza (`teardown`) define `allPassed = false` e atribui explicitamente `process.exitCode = 1`.
  - Saída estruturada categoriza o resultado em: `APROVADO`, `FALHA FUNCIONAL`, `FALHA DE TEARDOWN` ou `BLOQUEADO_POR_SEGURANCA` (com exit code 2).
  - Criado arquivo de testes unitários `scripts/test-e2e-logic.test.mjs` com 12 asserções cobrindo cenários de sucesso, falha funcional, reprodução da falha de teardown e bloqueio por segurança.

### 2.5. Prevenção de Poluição de Pedidos e Trava Fail-Closed (Média)
- **Problema**: Pedidos criados em produção poluem o banco permanentemente na ausência de limpeza por rota de teste.
- **Implementação e Decisão Arquitetural**:
  - Nenhuma rota perigosa (`DELETE /orders/:id`) foi criada em produção ou exposta publicamente.
  - A trava de segurança contra produção (`checkEnvironmentLock`) foi reforçada: exige explicitamente `ALLOW_PROD_WRITE=true` para disparar chamadas contra domínios `.workers.dev` ou `.fraldinhalivre.com.br`. Se bloqueada, encerra com código 2 e aviso de "NÃO EXECUTADO".
  - Se autorizada em produção, o resumo final emite alerta explícito indicando que o pedido permanece persistido no banco para integridade contábil e de estoque.
  - Para testes automatizados contínuos com cleanup, deve-se utilizar ambiente local (Cloudflare Worker + Miniflare/D1 local) ou preview isolado.

### 2.6. Centralização de Feedback Visual (Baixa)
- **Problema**: Disparos simultâneos de `toast.success` originados tanto em `market-context.tsx` quanto nos callbacks de clique de `OrdersDataTable.tsx`.
- **Implementação**:
  - `market-context.tsx` teve todas as invocações de `toast.success` removidas de `handleConfirmarDireto`, `handleRecusarDireto` e `handleAtualizarStatusDireto`, mantendo apenas o tratamento de persistência e relançamento de erro.
  - `OrdersDataTable.tsx` assume a responsabilidade exclusiva pelo feedback visual de notificação.
  - **Evidência Comportamental**: Teste dedicado em `OrdersDataTable.test.tsx` monitorando os spies de `toast.success` e comprovando exatamente 1 notificação por clique.

---

## 3. Matriz de Evidências por Categoria de Teste

| Categoria | Escopo | Execução Real | Resultado |
|---|---|---|---|
| **Testes Unitários (Frontend)** | `OrdersDataTable`, `MarketContext`, `AdminOrdersTab`, `OrderCard` | `npx vitest run ...` (6 arquivos, 86 testes) | **100% Aprovados (0 falhas)** |
| **Testes Unitários (E2E Logic)** | `scripts/test-e2e-logic.test.mjs` (trava, admin validation, exit code) | `node --test scripts/test-e2e-logic.test.mjs` (12 testes) | **100% Aprovados (0 falhas)** |
| **Integração Local (Backend)** | `orders.get`, `orders.mutations`, `orders.scope-admin`, `orders.scope-fornecedor`, `orders.status` | `npx vitest run ...` (5 arquivos, 45 testes) | **100% Aprovados (0 falhas)** |
| **Contratos Compartilhados** | `@fraldinha-livre/contracts` | `npm test` em `packages/contracts` (7 arquivos, 56 testes) | **100% Aprovados (0 falhas)** |
| **Tipagem Estática (TS)** | `front/` e `back/` | `npx tsc --noEmit` em ambos os workspaces | **0 erros** |
| **Linters (ESLint)** | Componentes e contextos alterados em `front/` | `npx eslint ...` | **0 erros (4 avisos triados)** |
| **Sintaxe de Scripts** | `scripts/test-e2e-catalog-to-history.mjs` | `node --check scripts/test-e2e-catalog-to-history.mjs` | **0 erros** |
| **API E2E com Escrita Remota** | Execução real contra produção | **Não executado** (trava fail-closed mantida para não poluir banco remoto) | Deliberadamente preservado |
| **Navegador E2E (Visual)** | Teste de cliques e renderização em browser real | **Não executado** (fora do escopo da tarefa / declarado expressamente) | Coberto por JSDOM |

---

## 4. Comandos e Evidências Brutas

1. **Frontend Vitest**:
   ```bash
   npx vitest run src/components/fornecedor/__tests__/OrdersDataTable.test.tsx \
                  src/components/fornecedor/__tests__/milestone3-adversarial.test.tsx \
                  src/contexts/__tests__/market-context.test.tsx \
                  src/lib/adapters/__tests__/http-order-repository.test.ts \
                  src/components/admin/__tests__/AdminOrdersTab.test.tsx \
                  src/contexts/__tests__/orders-context.backend.test.tsx
   # Resultado: 6 passed (6), 86 tests passed, duração 9.43s, exit code 0
   ```

2. **Frontend Typecheck & ESLint**:
   ```bash
   npx tsc --noEmit
   # Resultado: exit code 0, sem erros
   npx eslint "src/app/(fornecedor)/painel-fornecedor/pedidos" "src/components/fornecedor" "src/contexts/market-context.tsx" "src/components/admin/AdminOrdersTab.tsx"
   # Resultado: 0 erros, 4 avisos conhecidos (useReactTable unmemoized / unused vars)
   ```

3. **Backend Vitest & Typecheck**:
   ```bash
   npx vitest run test/orders.get.test.ts test/orders.mutations.test.ts test/orders.scope-admin.test.ts test/orders.scope-fornecedor.test.ts test/orders.status.test.ts
   # Resultado: 5 passed (5), 45 tests passed, duração 14.26s, exit code 0
   npx tsc --noEmit
   # Resultado: exit code 0, sem erros
   ```

4. **Lógica de Teste E2E (Node Test Runner)**:
   ```bash
   node --test scripts/test-e2e-logic.test.mjs
   # Resultado: 12 tests passed, 0 fail, exit code 0
   ```

5. **Verificação de Sintaxe e Git Diff**:
   ```bash
   node --check scripts/test-e2e-catalog-to-history.mjs # Exit code 0
   git diff --check # Exit code 0
   ```

---

## 5. Limitações e Próximos Passos
- **Limitações Declaradas**:
  - Nenhuma escrita contra a base de produção foi realizada nesta sessão.
  - A execução visual no navegador de ponta a ponta (com Cypress, Playwright ou Chrome DevTools em ambiente real) não faz parte deste escopo e deve ser conduzida em sessão dedicada de homologação de UI.
  - Comentários inline da PR não estavam disponíveis no GitHub CLI (nenhuma PR aberta encontrada para a branch `main`).
- **Próximos Passos Recomendados**:
  - Submeter as alterações para code review independente na branch do feature.
  - Para rodar a bateria E2E completa de ponta a ponta, instanciar o ambiente local isolado do backend (`npm run dev` com Miniflare/D1 local) antes de disparar o script.
