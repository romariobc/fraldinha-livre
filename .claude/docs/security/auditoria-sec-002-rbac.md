# Relatório de Auditoria Consolidada de Autorização e RBAC (SEC-002)

**Data:** 16 de Setembro de 2026  
**Status:** CONCLUÍDA — SEM VULNERABILIDADES OPERACIONAIS IDENTIFICADAS  
**Decisões Vinculadas:** [D-048](file:///.claude/docs/governance/decisoes.md#D-048), [D-049](file:///.claude/docs/governance/decisoes.md#D-049), [D-050](file:///.claude/docs/governance/decisoes.md#D-050), [D-051](file:///.claude/docs/governance/decisoes.md#D-051), [D-052](file:///.claude/docs/governance/decisoes.md#D-052)  
**Suíte de Validação:** `back/test/rbac-adversarial.test.ts` (45 testes adversariais aprovados)

---

## 1. Escopo e Metodologia

A auditoria SEC-002 inspecionou transversalmente toda a superfície HTTP do backend (Cloudflare Worker com Hono, Drizzle ORM e D1) e a integração de autorização no frontend e contracts para responder com rigor técnico:

> **"A implementação real corresponde integralmente à matriz de autorização declarada pelas decisões D-048, D-049 e D-050?"**

A metodologia incluiu:
1. **Inventário exaustivo de endpoints HTTP** (15 rotas inspecionadas linha a linha nos roteadores e handlers).
2. **Avaliação da autoridade de autorização** (Custom Claims assinado no JWT vs Firestore vs headers/body/query).
3. **Mapeamento de Defesa em Profundidade** (validação no router middleware vs no handler da rota).
4. **Validação de Ownership e Isolamento Horizontal** (comprador↔comprador, fornecedor↔fornecedor).
5. **Simulação de Vetores Adversariais** (spoofing de parâmetros, injeção de roles arbitrárias, claims contraditórios duplos e triplos, credenciais legadas).

---

## 2. Inventário de Endpoints Auditados

| # | Método | Rota | Auth Middleware | RBAC Middleware | Handler RBAC | Isolamento / Ownership |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/health` | ❌ Público | ❌ | ❌ | — |
| 2 | `GET` | `/products` (sem scope) | ❌ Público | ❌ | ❌ | Catálogo público ativo |
| 3 | `GET` | `/products?scope=fornecedor` | ✅ Condicional | ❌ | `hasAnyRole(['fornecedor'])` | `products.supplierId === uid` |
| 4 | `GET` | `/products?scope=admin` | ✅ Condicional | ❌ | `hasAnyRole(['admin'])` | Leitura global administrativa |
| 5 | `POST` | `/products` | ✅ Condicional | `requireAnyRole(['fornecedor'])` | `hasAnyRole(['fornecedor'])` | `supplierId = uid` atribuído pelo servidor |
| 6 | `PUT` | `/products/:id` | ✅ Obrigatório | `requireAnyRole(['fornecedor'])` | `hasAnyRole(['fornecedor'])` | `existing.supplierId === uid` estrito |
| 7 | `DELETE` | `/products/:id` | ✅ Obrigatório | `requireAnyRole(['fornecedor'])` | `hasAnyRole(['fornecedor'])` | `existing.supplierId === uid` estrito |
| 8 | `GET` | `/orders` (sem scope) | ✅ Obrigatório | ❌ (handler) | `hasAnyRole(['comprador'])` | `orders.uid === uid` estrito |
| 9 | `GET` | `/orders?scope=fornecedor` | ✅ Obrigatório | ❌ (handler) | `hasAnyRole(['fornecedor'])` | JOIN com `products.supplierId === uid` |
| 10 | `GET` | `/orders?scope=admin` | ✅ Obrigatório | ❌ (handler) | `hasAnyRole(['admin'])` | Leitura global administrativa |
| 11 | `POST` | `/orders` | ✅ Obrigatório | `requireAnyRole(['comprador'])` | `hasAnyRole(['comprador'])` | `uid` injetado pelo token verificado |
| 12 | `PATCH` | `/orders/:id/cancel` | ✅ Obrigatório | `requireAnyRole(['comprador'])` | `hasAnyRole(['comprador'])` | `orders.uid === uid` + status `aguardando` |
| 13 | `POST` | `/orders/:id/report` | ✅ Obrigatório | `requireAnyRole(['fornecedor'])` | `hasAnyRole(['fornecedor'])` | `order.supplierId === uid` estrito |
| 14 | `POST` | `/chat/message` | ✅ Obrigatório | ❌ | ❌ (autenticado) | Read-only catalogo; `uid` do token |
| 15 | `POST` | `/auth/claim` | ✅ Obrigatório | ❌ | `uid` do token + allowlist | Idempotente; imutável após set |

---

## 3. Matriz Consolidada de Autorização e Enforcement

| Endpoint | Sem Token | Sem Role | Comprador | Fornecedor | Admin (Claim) | Admin (ADMIN_UID) | Conflito de Claims | Non-Owner |
|---|---|---|---|---|---|---|---|---|
| `GET /health` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | — |
| `GET /products` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | — |
| `GET /products?scope=fornecedor` | 401 | 403 | 403 | 200 | 403 | 403 | 403 | 403 / Filtrado |
| `GET /products?scope=admin` | 401 | 403 | 403 | 403 | 200 | 200 | 403 | — |
| `POST /products` | 401 | 403 | 403 | 201 | 403 | 403 | 403 | — |
| `PUT /products/:id` | 401 | 403 | 403 | 200 | 403 | 403 | 403 | 403 |
| `DELETE /products/:id` | 401 | 403 | 403 | 204 | 403 | 403 | 403 | 403 |
| `GET /orders` | 401 | 403 | 200 | 403 | 403 | 403 | 403 | Filtrado |
| `GET /orders?scope=fornecedor` | 401 | 403 | 403 | 200 | 403 | 403 | 403 | Filtrado |
| `GET /orders?scope=admin` | 401 | 403 | 403 | 403 | 200 | 200 | 403 | — |
| `POST /orders` | 401 | 403 | 201 | 403 | 403 | 403 | 403 | — |
| `PATCH /orders/:id/cancel` | 401 | 403 | 200 | 403 | 403 | 403 | 403 | 403 |
| `POST /orders/:id/report` | 401 | 403 | 403 | 200 | 403 | 403 | 403 | 403 |
| `POST /chat/message` | 401 | 200 | 200 | 200 | 200 | 200 | 200 | — |
| `POST /auth/claim` | 401 | 200 | 200 / 409 | 200 / 409 | 400 | — | 409 | — |

---

## 4. Análise dos Vetores e Dívidas Documentadas

### 4.1 ADMIN_UID — Exceção Legada Transitória (D-051)
- **Diagnóstico:** O fallback `ADMIN_UID` em `getUserRole()` concede o papel `admin` se o UID for correspondente à variável de ambiente, mesmo que não haja Firebase Custom Claims.
- **Segurança Operacional:** O papel obtido via `ADMIN_UID` segue rigorosamente todas as restrições de D-050: recebe `403 Forbidden` em `POST /orders`, `GET /orders`, `PATCH /orders/:id/cancel`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `GET /products?scope=fornecedor` e `GET /orders?scope=fornecedor`.
- **Fail-Closed:** Se o token possuir claims concorrentes (`comprador` ou `fornecedor`), `getUserRole()` detecta o desacordo e retorna `conflict` (403 em tudo).
- **Classificação:** Exceção legada transitória com plano de remoção formalizado em D-051 (a ser executado em task dedicada `ADMIN-002`).

### 4.2 Endpoint `/chat/message` — Escopo Conversacional Futuro (D-052)
- **Diagnóstico:** `/chat/message` valida autenticação (`uid` via Firebase ID Token), mas não restringe papéis (`role`).
- **Segurança Operacional:** O endpoint não executa operações de escrita no banco de dados. As tools atuais (`searchProducts` e `getProduct`) são de leitura estrita (`active = true`). A tool `select_product_for_purchase` apenas retorna uma sugestão de payload JSON ao frontend, sendo o checkout real processado posteriormente via `POST /orders` com enforcement completo de comprador.
- **Classificação:** `AUTENTICADO / FASE FUTURA`. Ao adicionar tools mutáveis (ordens diretas, lances de leilão ou checkout conversacional), a autorização por tool no harness (`executeToolHarness`) será obrigatória.

### 4.3 Defesa em Profundidade em `GET /orders`
- **Diagnóstico:** O roteamento de `GET /orders` não aplica `requireAnyRole` no nível de middleware de rota (ao contrário de `POST /orders`), delegando o controle integralmente ao handler interno (`ordersGetHandler`).
- **Segurança Operacional:** O handler implementa branching estrito com `hasAnyRole` para cada escopo (sem scope = comprador, `scope=fornecedor` = fornecedor, `scope=admin` = admin). A superfície está totalmente protegida, constituindo apenas uma observação arquitetural de defesa em camadas.

---

## 5. Bateria de Testes Adversariais (45 Testes)

A suíte `back/test/rbac-adversarial.test.ts` consolida 45 testes automatizados cobrindo todos os cenários adversariais:

1. **Sem Token:** Rejeição imediata com 401.
2. **Sem Role:** Usuários com token válido sem role recebem 403 em todas as rotas operacionais e administrativas.
3. **Cruzamento Comprador → Fornecedor:** Comprador bloqueado com 403 em criação, edição, deleção e listagem de catálogo.
4. **Cruzamento Fornecedor → Comprador:** Fornecedor bloqueado com 403 em criação, listagem e cancelamento de pedidos.
5. **Cruzamento Admin → Fornecedor/Comprador:** Administrador bloqueado com 403 em endpoints operacionais de comprador e fornecedor.
6. **Tentativa de Acesso ao Scope Admin por Comprador/Fornecedor:** Ambos recebem 403 explícito.
7. **Role Arbitrária ("hacker"):** String não reconhecida resulta em 403 imediato em todos os escopos.
8. **Claims Conflitantes:**
   - `comprador + fornecedor` → `conflict` → 403.
   - `comprador + admin` → `conflict` → 403.
   - `fornecedor + admin` → `conflict` → 403.
   - `comprador + fornecedor + admin` (triplo conflito) → `conflict` → 403.
9. **Isolamento Horizontal (Ownership):** Fornecedor A não altera nem exclui produtos do Fornecedor B; Comprador A não cancela pedido do Comprador B.
10. **Spoofing de Identidade:** Tentativas de enviar `role` ou `supplierId` no body ou query string são completamente inócuas; apenas o JWT assinado é autoritativo.
11. **ADMIN_UID Legado:** Acesso restrito a escopos administrativos (`?scope=admin`), totalmente bloqueado em rotas operacionais.

---

## 6. Parecer Conclusivo

> **CLASSIFICAÇÃO: SEC-002 CONCLUÍDA COM ÊXITO — SEM VULNERABILIDADES OPERACIONAIS IDENTIFICADAS**

O marketplace Fraldinha Livre opera com RBAC sólido, consistente e alinhado aos princípios de menor privilégio e governança estrita.
