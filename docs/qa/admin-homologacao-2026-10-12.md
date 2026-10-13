# Homologação Visual e Funcional Autenticada do Painel Administrativo (`/admin`) e E2E Passo 12 — 2026-10-12

## Contexto e Base Examinada

- **Data da execução**: 2026-10-12 / 2026-10-13 (UTC-3).
- **Base de código local**: branch `main`, commit `bbfb68fa42686e7ec248e094649beec45c00b9f2` (igual a `origin/main`, sem alterações funcionais locais).
- **Ambiente validado**: Produção Cloudflare (`https://fraldinha-livre-frontend.romariobc.workers.dev` e `https://fraldinha-livre-backend.romariobc.workers.dev`) integrado ao Firebase Authentication / Firestore (`fraldinha-livre`) e Cloudflare D1 (`fraldinha-livre-db`), mediante autorização explícita do usuário.
- **Credencial de QA Administrativo provisionada**: Conta de teste dedicada `admin.teste@fraldinhalivre.com.br` (UID `SJu48kK1JiQDAT4mIDZjjwb6XZr1`) provisionada via Identity Toolkit Admin API com Custom Claims verificadas no JWT (`{"role": "admin", "admin": true}`) e documento correspondente em `users/SJu48kK1JiQDAT4mIDZjjwb6XZr1`, registrada localmente em `.env.qa.local` (ignorado pelo Git).

---

## Veredito

**Escopo homologado com sucesso em navegador real (Chromium / Chrome DevTools MCP) e via suíte E2E de API (13/13 etapas aprovadas, exit code 0).**
As 4 abas do Painel Administrativo (**Usuários**, **Pedidos**, **Produtos** e **Auditoria**), o modal de detalhes de pedidos, o ciclo real de moderação de produtos (desativação seguida de reativação imediata com restauração integral do estado em produção), o registro e leitura da trilha de auditoria (`audit_logs` no D1), a proteção RBAC e o Passo 12 da suíte `scripts/test-e2e-catalog-to-history.mjs` foram comprovados ponta a ponta.

Durante a homologação em navegador real foram registradas 2 observações técnicas não-bloqueantes (listadas na seção **Achados e Limitações** abaixo) para eventual refinamento futuro.

---

## Matriz por Critério

| Critério | Evidência verificável | Resultado | Limitação |
|---|---|---|---|
| **Provisionamento de claim administrativo e login real (`/login?redirect=/admin`)** | JWT assinado pelo Firebase contendo `role: "admin"` e `admin: true` para `SJu48kK1JiQDAT4mIDZjjwb6XZr1`; login em `/login?redirect=/admin` redirecionou para `/admin` e habilitou o item `Painel Admin` no menu do `Header` (`docs/qa/screenshots/admin_header_menu_1280.png`) | **Passou** | Validado com provedor de e-mail/senha; login OAuth Google interativo permanece validado pela sessão humana anterior de 2026-09-26 |
| **Proteção RBAC de `/admin` (cenário negativo)** | Navegação para `/admin` autenticado como `Comprador Teste` redirecionou imediatamente para `/`; dropdown do Header para comprador exibiu apenas `Minha conta` e `Sair` (sem `Painel Admin`) | **Passou** | Nenhuma |
| **Aba 1 — Usuários (`AdminUsersTab`)** | Leitura real da coleção `users` do Firestore autorizada pela regra `request.auth.token.admin == true`: 10 usuários carregados (`Todos (10)`, `Compradores (7)`, `Fornecedores (2)`, `Administradores (1)`), busca textual (`admin.teste` -> 1 resultado), cópia de UID e botão `Atualizar` (`docs/qa/screenshots/admin_usuarios_1280.png`) | **Passou** | Paginação de usuários não acionada pois o total atual no Firestore é de 10 registros (`PAGE_SIZE = 10`, 1 página) |
| **Aba 2 — Pedidos (`AdminOrdersTab`) e paginação** | `GET /orders?scope=admin` retornou HTTP 200 com 94 pedidos (`Página 1 de 10`); navegação para a página 2 (`Próxima`) validada; filtro textual pelo ID `406377c6-b759-4852-b7cb-a7702fc47a35` isolou o pedido criado no E2E (`docs/qa/screenshots/admin_pedidos_1280.png`) | **Passou** | Aba é somente leitura por decisão de escopo (D-039) |
| **Modal de Detalhes do Pedido (`AdminOrdersTab`)** | Abertura do modal no pedido `#406377c6-b759-4852-b7cb-a7702fc47a35` exibiu status `entregue`, data `13/10/2026, 01:03:36`, comprador `Tr6LnUJDONcTIYAemTE6YrOWPSj1`, fornecedor `Distribuidora Sul Teste` (`cSK4LXIakuajmCSiJFaHOccck2s1`), pagamento `PIX` `approved` (`Tx: sim-e2e-1791864211849`), tabela de itens (`2 un` x `R$ 24.90` = `R$ 49.80`), endereço completo e botões de cópia (`docs/qa/screenshots/admin_pedido_detalhes_modal_1280.png`) | **Passou** | Nenhuma |
| **Aba 3 — Produtos (`AdminProductsTab`) e validação negativa do modal** | `GET /products?scope=admin` retornou HTTP 200 com 314 produtos (`Página 1 de 32`); abertura do modal `Desativar produto` manteve o botão `Confirmar` desabilitado (`disabled`) com justificativa vazia e com `"abc"` (3 caracteres, `< 5`) (`docs/qa/screenshots/admin_produtos_1280.png`) | **Passou** | Nenhuma |
| **Moderação real de produto e restauração de estado (`PATCH /admin/products/:id/status`)** | Produto `364f0966-a648-42f3-8c98-3812effb527b` (`Basic Jumbinho idades`) desativado com justificativa `"Homologação QA Admin AUDIT-001: desativação temporária"` (linha mudou para `Ativo: Não` / botão `Ativar`) e imediatamente reativado com `"Homologação QA Admin AUDIT-001: reativação imediata"` (estado `Salvando...` observado e linha restaurada para `Ativo: Sim`) (`docs/qa/screenshots/admin_produto_moderacao_modal_1280.png`) | **Passou** | Estado do catálogo de produção integralmente restaurado ao final do teste |
| **Aba 4 — Auditoria (`AdminAuditTab` / `GET /admin/audit-logs`)** | Carregou os 2 eventos reais persistidos na tabela `audit_logs` do D1: `product.deactivated` (`requestId: 4f2d4716-7a87-4c50-8a71-ce63db653c2d`) e `product.activated` (`requestId: 3bae251f-bede-4338-af45-c4ec3913a6d4`), com `actorId: SJu48kK1Ji...`, `target: product/364f0966-a648-42f3-8c98-3812effb527b`, justificativas íntegras e cópia de `requestId` (`docs/qa/screenshots/admin_auditoria_1280.png`) | **Passou** | Atualmente apenas ações de moderação de produto gravam em `audit_logs`; transições de pedidos em `orders.ts` emitem apenas logs estruturados de aplicação |
| **Responsividade Mobile (`390×844` e `360×800`)** | Emulação de dispositivo móvel via DevTools confirmou `innerWidth === docScrollWidth` (`390 === 390` e `360 === 360`, `hasHorizontalOverflow: false`), com scroll horizontal contido internamente na barra de abas e nas tabelas (`docs/qa/screenshots/admin_mobile_390x844.png` e `docs/qa/screenshots/admin_mobile_360x800.png`) | **Passou** | Emulação Chromium DevTools (não executada em aparelho iOS físico) |
| **Suíte E2E de API incluindo Passo 12 Administrativo (`scripts/test-e2e-catalog-to-history.mjs`)** | Execução completa das 13 etapas (autenticação, criação de produto `deef103b-bd63-446b-ad2a-a56afad8204e`, compra direta `406377c6-b759-4852-b7cb-a7702fc47a35`, fila fornecedor, `confirmado` -> `a-caminho` -> `entregue`, histórico comprador, Passo 12 `validateAdminOrder` em `GET /orders?scope=admin` e teardown `DELETE /products/:id` HTTP 204) | **Passou** | O pedido `#406377c6-b759-4852-b7cb-a7702fc47a35` permanece no D1 por regra de imutabilidade contábil; o produto temporário foi excluído no teardown |

---

## Comandos Executados e Resultados

| Comando | Exit Code | Resultado Final |
|---|---|---|
| `node scripts/test-e2e-catalog-to-history.mjs --require-admin --allow-production-write` | `0` | Veredito `[APROVADO]` — `13/13` etapas aprovadas (incluindo Etapa 12 `GET /orders?scope=admin` HTTP 200 com `errors: []` e Etapa 13 Teardown HTTP 204) |

---

## Achados e Observações Técnicas (Não-Bloqueantes)

1. **Chamada `GET /orders` (escopo comprador) disparada pelo `OrdersProvider` global ao autenticar como Admin**:
   - **Causa**: Em `front/src/contexts/orders-context.tsx` (linhas 89–104 e 141–148), o `OrdersProvider` suprime a busca automática de pedidos de comprador quando a rota inicia com `/painel-fornecedor` ou quando o token possui claim `fornecedor`, mas não verifica `pathname.startsWith('/admin')` nem `claims?.role === 'admin' || claims?.admin === true`.
   - **Efeito observado**: Quando o administrador faz login, o `OrdersProvider` global disparava `GET /orders` (que exige papel `comprador`), gerando no console do navegador um aviso `403 FORBIDDEN` (`operation: "orders.load_list"`).
   - **Status**: **Resolvido em 13/10/2026**. `OrdersProvider` em `front/src/contexts/orders-context.tsx` agora verifica claims `admin` / `role === 'admin'` e rotas iniciadas em `/admin`, suprimindo a requisição desnecessária e mantendo o console 100% limpo. Testes unitários adicionados em `front/src/contexts/__tests__/orders-context.backend.test.tsx`.
2. **Item `"Minha conta"` exibido junto com `"Painel Admin"` no dropdown do `Header.tsx` para o papel `admin`**:
   - **Causa**: Em `front/src/components/Header.tsx`, o link `"Minha conta"` era renderizado sem checar se o usuário era administrador.
   - **Status**: **Resolvido em 13/10/2026**. `Header.tsx` agora consome `isAdmin` de `useAuth()` e oculta `"Minha conta"` para administradores (mantendo apenas `"Painel Admin"` e `"Sair"`). Testes unitários atualizados em `front/src/components/__tests__/Header.test.tsx`.

---

## Homologação Interativa da Jornada E2E em Produção (13/10/2026)

Em complemento à homologação administrativa e às correções acima, foi validada em navegador real a jornada transacional completa ponta a ponta:

1. **Seleção de Produto do Fornecedor por Usuário Comprador Logado**:
   - Comprador (`comprador.teste@fraldinhalivre.com.br`) autenticado em produção.
   - Acessada a vitrine do fornecedor (`Distribuidora Sul Teste` — `cSK4LXIakuajmCSiJFaHOccck2s1`) em `/catalogo/fornecedor/cSK4LXIakuajmCSiJFaHOccck2s1`.
   - Produto `Pampers Premium Care RN` (R$ 24,00, estoque 100 un) adicionado à Sacola (`/sacola`).
   - Prosseguido para o checkout (`/checkout`) com endereço preenchido: `Avenida Paulista, 1578 — Conj 42, Bela Vista, São Paulo/SP, CEP 01310-200`.

2. **Pagamento Simulado Aprovado e Criação de Pedido**:
   - Na etapa `Forma de pagamento`, selecionado `Pix (Aprovação instantânea na simulação)` e cenário `Aprovar simulação`.
   - Clicado em `Pagar`: simulação aprovada instantaneamente gerando transação `txn-sim-1791869342548-1`.
   - Tela de confirmação exibida (`Pedido confirmado! 1 pedido criado com sucesso. Comprovante: Pix, Status: Simulado e Aprovado`).
   - Pedido `#754772ca-93ad-44d0-bd09-1ff30732095a` registrado em `/minha-conta` com status `Aguardando confirmação`.
   - Estoque do produto deduzido atômica e imediatamente no banco D1 de `100 un` para `99 un` (e estoque consolidado da distribuidora de `490` para `489 un`).

3. **Recebimento e Gestão Logística pelo Fornecedor (`/painel-fornecedor`)**:
   - Fornecedor (`fornecedor.teste1@fraldinhalivre.com.br`) autenticado no painel B2B.
   - Visão Geral: métrica de `RECEITA TOTAL` incrementada de `R$ 1287,71` para `R$ 1311,71` (+ R$ 24,00).
   - Aba Pedidos (`/painel-fornecedor/pedidos`): pedido `#754772ca-93ad-44d0-bd09-1ff30732095a` listado em `Aguardando` com comprador B2B, destino São Paulo/SP, valor R$ 24,00.
   - Ciclo logístico executado via menu `Ações do pedido`:
     - `Confirmar Pedido`: transitou para `Confirmado` (contador `Confirmados` subiu para 12).
     - `Despachar (A Caminho)`: transitou para `A Caminho`.
     - `Marcar como Entregue`: transitou para `Entregue` (contador `Entregues` subiu de 6 para 7).
   - Todas as transições refletidas em tempo real e validadas visualmente em produção.

---

## Capturas de Evidência Arquivadas Localmente

As capturas de tela desta homologação foram salvas em `docs/qa/screenshots/` (diretório ignorado pelo Git):
- `docs/qa/screenshots/admin_usuarios_1280.png` — Aba Usuários (desktop 1280×900)
- `docs/qa/screenshots/admin_pedidos_1280.png` — Aba Pedidos (desktop 1280×900)
- `docs/qa/screenshots/admin_pedido_detalhes_modal_1280.png` — Modal de Detalhes do Pedido `#406377c6...`
- `docs/qa/screenshots/admin_produtos_1280.png` — Aba Produtos (desktop 1280×900)
- `docs/qa/screenshots/admin_produto_moderacao_modal_1280.png` — Modal de Moderação de Produto com justificativa
- `docs/qa/screenshots/admin_auditoria_1280.png` — Aba Auditoria exibindo `product.deactivated` e `product.activated`
- `docs/qa/screenshots/admin_header_menu_1280.png` — Dropdown do Header exibindo `Painel Admin`
- `docs/qa/screenshots/admin_mobile_390x844.png` — Painel Administrativo em viewport mobile 390×844
- `docs/qa/screenshots/admin_mobile_360x800.png` — Painel Administrativo em viewport mobile 360×800
- `docs/qa/screenshots/e2e_checkout_pagamento_simulado.png` — Checkout na etapa de Pagamento Simulado PIX
- `docs/qa/screenshots/e2e_checkout_pedido_confirmado.png` — Tela de Pedido Confirmado com comprovante PIX
- `docs/qa/screenshots/e2e_fornecedor_pedido_entregue.png` — Painel do Fornecedor com o pedido entregue (status `Entregue`)

