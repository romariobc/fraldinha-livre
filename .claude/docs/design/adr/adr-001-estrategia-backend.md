# ADR-001 — Estratégia de backend: como o front sai do mock

- **Status:** PROPOSTA — aguardando aprovação (não implementar até decidir)
- **Data:** 2026-07-11
- **Decisão-mãe relacionada:** D-026 (ponteiro no log `.claude/docs/decisoes.md`)
- **Contexto de infra:** D-001 (100% Google Cloud) · D-005 (monorepo `front/`+`back/`) · 005a (Firebase Auth Google)
- **Origem:** análise pedida pelo cliente antes de escolher onde o código do backend vai morar.
  Insumo veio de uma sessão de Chat (arquiteto GCP) + auditoria do estado real do front nesta sessão.

---

## 1. Contexto — o que existe e o que falta no front

Antes de escolher backend, auditamos a camada de dados/portas do front (`front/src`). Resultado:

**Pronto (seam maduro):**
- **Portas hexagonais de pagamento e logística** — `lib/ports/payment.ts` (`PaymentGateway.charge`) e
  `lib/ports/fulfillment.ts` (`FulfillmentService.schedule`), assíncronas, com **contract tests**
  (`lib/ports/__tests__/*.contract.ts`) e adapters mock (`lib/adapters/mock-*`). Os comentários já preveem
  literalmente *"The backend adapter (backend 006) implements this for production"*.
- Domínio puro (`lib/domain/money.ts`, `cart.ts`, `order.ts`), **dinheiro em centavos**, `formatPrice` único.
- Auth real: **Firebase Auth (Google)** via `contexts/auth-context.tsx` (005a) — `{ user, profile, role, ... }`.

**Falta (o buraco real):**
- **Não há porta de repositório de dados.** `PRODUCTS` e `INITIAL_ORDERS` são `const` em memória, lidos
  **direto** pelos contexts. Não existe `ProductRepository` / `OrderRepository` / `UserRepository`.
- **Pedidos vivem só em `useState`** (`OrdersProvider` nasce de `INITIAL_ORDERS`) — refresh perde tudo.
  Nenhuma persistência nem busca por usuário.
- **Nenhuma camada de fetch / API client** em uso. Nada envia o **ID Token** do Firebase para backend algum.
- **Firestore hoje é acessado direto pelo client** (só pelo auth). Qualquer plano de "backend media o Firestore
  via Admin SDK" **inverte o fluxo de dados atual** — não é "plugar um adapter".
- `Product` **não tem campo de estoque** (o plano de backend pressupõe consulta de estoque).

> **Conclusão de maturidade:** o seam de *pagamento/logística* está pronto para receber backend. O seam de
> *dados* (produtos/pedidos/estoque/usuários) **precisa ser construído do zero no front**, independentemente
> de qual alternativa de backend for escolhida.

---

## 2. Decisão a tomar

**Como o front sai dos mocks para dados reais e persistentes, ao menor custo de implementação e manutenção
para um dev solo em fase de validação, sem quebrar a governança hexagonal (WORKFLOW.md)?**

Duas famílias de solução estão na mesa.

---

## 3. Alternativa A — Backend HTTP dedicado media tudo (Admin SDK)

Um serviço backend (Node + framework HTTP) roda no **Cloud Run**, valida o ID Token do Firebase via
**Firebase Admin SDK** e é o **único** a falar com o Firestore (Admin SDK / Service Account). O front passa a
consumir uma API REST. É a proposta da sessão de Chat.

Tem duas sub-variantes que mudam **só onde o código mora / como deploya** (a arquitetura lógica é a mesma):

- **A1 — repositório separado** (Node/Express puro, repo git próprio). Foi o que o Chat concluiu como
  "melhor prática". **Custo:** joga fora `packages/contracts` (o seam de tipos compartilhados do WORKFLOW.md),
  duplica tooling/CI/tipos e adiciona um segundo repo para um dev solo manter. O isolamento hexagonal que ele
  promete **já é obtido** por um package do monorepo — repo separado não é requisito de hexagonal.
- **A2 — route handlers no monorepo (recomendada dentro de A).** Backend como `app/api/*` do próprio Next.js
  **ou** um `apps/backend` no mesmo repo, com o domínio em `packages/core` e `packages/contracts` como seam.
  **Um repo, e possivelmente um único deploy Cloud Run.** Backend de verdade, hexagonal preservado, sem o
  overhead cross-repo. O token vira middleware de route handler.

**Prós (A):** arquitetura limpa e centralizada; segurança num ponto só; migração de banco trivial (troca de
adapter); casa 100% com o WORKFLOW hexagonal e com as portas de pagamento/logística já existentes.
**Contras (A):** é a que **mais mexe no front** (toda a Seção 5 abaixo); adiciona superfície de infra a operar.
**Custo GCP:** ~R$ 0 no always-free (Cloud Run 2M req/mês).

---

## 4. Alternativa B — Backend mínimo: Firestore-direto + Security Rules + Functions no sensível

O front continua **lendo/escrevendo Firestore direto** (exatamente como já faz com o auth), protegido por
**Security Rules**. Só o que exige **segredo** ou **atomicidade** — pagamento, decremento transacional de
estoque — vira uma **Cloud Function callable**. Não há servidor HTTP dedicado.

**Prós (B):** **muito menos mudança no front** (o SDK Firestore já está no projeto; catálogo/pedidos viram
queries client em vez de fetch a uma API); quase nenhuma infra própria; escala a zero sem container; **caminho
mais curto até sair do mock**. **Custo GCP:** ~R$ 0.
**Contras (B):** lógica de negócio **espalhada** entre Security Rules + Functions (mais fácil errar segurança);
hexagonal fraco (regra sai do domínio); **lock-in Firestore** forte — migrar para SQL depois é caro; testar
Rules é menos ergonômico que testar um adapter.

---

## 5. Matriz comparativa

| Critério | A) Backend dedicado | B) Firestore-direto + Functions |
|---|---|---|
| Mudança no front | **Grande** (portas repo, API client, async, loading/erro) | **Pequena** (SDK já está lá; queries client) |
| Custo mensal (GCP) | ~R$ 0 (Cloud Run free tier) | ~R$ 0 (sem container sempre-pronto) |
| Manutenção (solo) | 1 serviço a vigiar; 1–2 deploys | Quase nenhuma infra própria |
| Segurança | Centralizada no backend | Espalhada em Rules + Functions |
| Aderência hexagonal / WORKFLOW | **Forte** | Fraca (lógica em Rules) |
| Migrar para SQL depois | Fácil (troca adapter) | Difícil (lock-in Firestore) |
| Tempo até validar | Mais longo | **Mais curto** |
| `packages/contracts` (seam de tipos) | Preservado em A2; perdido em A1 | Não se aplica (sem API) |

---

## 6. Custo de implementação (esforço — o que realmente pesa)

O custo em **R$** é ~zero nas duas (free tier). O custo real é **esforço**, e ele está mais no front que no back:

| Frente | Tamanho | Observação |
|---|---|---|
| Backend em si (scaffold + Admin SDK + adapter Firestore + Dockerfile + deploy) | Médio | Só na Alt. A |
| **Integração no front** (portas de repo, API client / SDK, token, mock→async, loading/erro, persistência) | **Grande** (A) / **Média-pequena** (B) | O custo escondido; o plano do Chat o subestima |
| Contrato/tipos compartilhados (`packages/contracts`) | Médio | Depende da sub-variante (A2 preserva; A1 refaz à mão) |

---

## 7. Mudanças necessárias no front (valem sobretudo para a Alternativa A)

1. **Criar portas de repositório** (`ProductRepository`, `OrderRepository`, `UserRepository`) — mesmo padrão das
   portas de pagamento já existentes.
2. **Adapter HTTP** (`HttpProductRepository`) com `fetch(BACKEND_URL/...)`; o mock atual vira `MockProductRepository`.
3. **Auth interceptor**: injetar `user.getIdToken()` do Firebase em `Authorization: Bearer` de toda chamada.
   *(Nota: o `api-client.ts` do integration-guide usa `getSession()` do NextAuth — ver §9, guia desatualizado.)*
4. **Contexts assíncronos**: `orders-context` e o catálogo deixam de ler `const` e passam a carregar async →
   exigem **estados de loading/erro** → **skeletons e telas de erro** (hoje inexistentes, porque é tudo instantâneo).
5. **Persistência de pedidos**: `OrdersProvider` deixa de nascer com `INITIAL_ORDERS` e busca os pedidos do usuário.
6. **Config por ambiente**: `NEXT_PUBLIC_BACKEND_URL` (dev/prod).
7. **Campo de estoque** no `Product` (não existe hoje).

Na Alternativa B, os itens 1–3 encolhem (queries Firestore client em vez de API client), mas 4–7 permanecem.

---

## 8. Decisões pré-requisito (resolver ANTES de implementar)

- **Repo/estrutura:** A1 (separado) vs A2 (monorepo) vs B. D-005 já define monorepo `front/`+`back/` — A1 o
  contradiz.
- **Fonte de verdade dos dados:** Firestore acessado **só pelo backend** (A) ou **direto pelo client** (B)?
  Hoje há **dois caminhos** (auth via client, catálogo via mock) — precisa unificar, senão vira brecha de segurança.
- **Security Rules do Firestore:** lockdown total (A, backend media tudo) vs rules caprichadas por coleção (B).
  É decisão de **segurança**, não detalhe.
- **Autorização por papel** (comprador/fornecedor): **custom claims** no Firebase vs `role` do profile (atual).
- **Estoque e concorrência:** decremento exige **transação Firestore** — regra de negócio nova a desenhar.
- **Ambientes/segredos:** projetos GCP dev vs prod; **Secret Manager** para chaves de pagamento.
- **Sequência:** Pub/Sub + Functions para pagamento é padrão correto, mas **não construir nas primeiras fases**
  (pagamento está mockado e é o último a entrar; chamada síncrona basta no volume de validação).

---

## 9. Consequências e itens a atualizar

- **`integration-guide.md` está DESATUALIZADO.** Ele (maio/2026) assume **NextAuth 5 + Credentials + backend
  REST em `localhost:3001`** (`/auth/login`, `JWT_SECRET` compartilhado, `IS_LOGGED_IN`, `auth-mock.ts`).
  Isso **conflita com o estado atual** (Firebase Auth Google, 005a — não há NextAuth nem `auth-mock.ts`).
  Ao aprovar esta ADR, o guia precisa ser **reescrito** para o fluxo Firebase ID Token, ou marcado como legado.
- **D-005** cita `back/` como pasta do monorepo — coerente com A2/B; A1 (repo separado) exigiria emendar D-005.
- As **portas de pagamento/logística** e os contract tests **não mudam** em nenhuma alternativa — só ganham
  adapter real no lugar do mock (como já previsto nos comentários das portas).

---

## 10. Recomendação (não decidida — para o cliente aprovar)

Dadas as restrições declaradas (solo, custo mínimo, validação, evolução paulatina):

- Se **sair do mock rápido** é a prioridade máxima → **Alternativa B**: menos retrabalho no front, menos infra,
  dados reais e persistentes já. Custo = arquitetural (menos hexagonal, lock-in Firestore).
- Se a **governança hexagonal do WORKFLOW.md é inegociável** → **Alternativa A2** (route handlers no monorepo),
  **não A1**: backend de verdade, um repo, `packages/contracts` preservado, sem overhead cross-repo.
- **A1 (repo separado) não é recomendada** — contradiz D-005 e o WORKFLOW, e compra overhead sem benefício que
  A2 não entregue.

Uma rota faseada de baixo risco que serve aos dois caminhos: **criar primeiro as portas de repositório + a
persistência de pedidos** (item 7.1 e 7.5), que valem para A e B, e só então plugar o backend escolhido.

---

## 11. Referências

- Estado do front: `front/src/lib/ports/`, `front/src/lib/adapters/`, `front/src/contexts/orders-context.tsx`,
  `front/src/lib/products.ts`, `front/src/lib/account-mock.ts`.
- Governança: `E:\Labdev\CLAUDE.md` (WORKFLOW.md §5–6, monorepo + `packages/contracts`).
- Log de decisões: `.claude/docs/decisoes.md` (D-001, D-005, D-010, 005a).
- Guia (a revisar): `.claude/docs/backend/integration-guide.md`.
