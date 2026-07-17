# Spec — Backend de Pedidos (Cloudflare Workers + D1) — Fatia 1

**Dominio:** backend / comprador · **Feature relacionada:** 006 (fatia 1 de N) · **Status:** APROVADA (2026-07-17)

## Contexto

O front do marketplace esta 100% em mock. A dor mais concreta: **os pedidos vivem so em
`useState`** (`OrdersProvider` nasce de `INITIAL_ORDERS` em `orders-context.tsx:18`) — um refresh
apaga tudo. Nao ha persistencia, nao ha associacao pedido→usuario, nao ha camada de API. O ADR-001
(D-026) deixou aberta a escolha de backend entre A2 (Cloud Run) e B (Firestore-direto).

Esta spec resolve a D-026 com uma **terceira alternativa (C): Cloudflare Workers + D1**, que herda o
hexagonal forte da A2 e o custo/simplicidade da B, sem o lock-in de modelo de dados da B (D1 e SQLite
= SQL portavel). A autenticacao **nao muda** — continua Firebase Auth (005a); o Worker apenas verifica
o ID Token.

Escopo desta fatia: **apenas Pedidos** (a menor fatia com valor visivel — prova a stack inteira
Worker+D1+token+porta num escopo pequeno). Produtos, sync com o painel do fornecedor, perfis e estoque
sao fatias seguintes.

### Decisoes de governanca desta spec

- **D-026 (resolvida):** backend = Cloudflare Workers + D1 (Alternativa C). Atualizar o ADR-001
  acrescentando essa alternativa e marcando-a como aprovada.
- **D-027 (nova):** emenda a D-001. De "100% Google Cloud" para: *identidade/auth no Google/Firebase
  (005a); dados e API na Cloudflare (Workers + D1)*. Divergencia consciente, motivada por custo, SQL
  portavel e perimetro de seguranca gratis.
- **`integration-guide.md` obsoleto:** reescrever para o fluxo Firebase ID Token → Worker Hono →
  Drizzle → D1. Remover toda mencao a NextAuth/REST localhost:3001/IS_LOGGED_IN.

## Arquitetura

```
Front (Next.js)                          Worker (Cloudflare)
  OrderRepository (porta)                  Hono + Drizzle
    ├ MockOrderRepository (testes)         verifica Firebase ID Token → uid
    └ HttpOrderRepository ── Bearer ──►     rotas /orders
         (api-client injeta getIdToken)         │
                                                ▼
Firebase Auth (005a) ── gera o token         D1 (SQLite)
```

- **Monorepo (D-005):** Worker em `back/` como package proprio; tipos compartilhados em
  `packages/contracts` (Zod), importados pelo front e pelo Worker.
- **Hexagonal:** mesma forma das portas de pagamento/logistica ja existentes
  (`front/src/lib/ports/`), com adapter mock (testes) e adapter real (producao).

## Regras de negocio

Cada regra e testavel. As de servidor (RN-S*) sao reforcadas no Worker, nao so na UI.

- **RN-01** — Todo pedido tem um dono (`uid`, comprador). O `uid` vem **sempre do ID Token
  verificado**, NUNCA do corpo da requisicao.
- **RN-02** — `GET /orders` retorna exclusivamente os pedidos do `uid` do token
  (`WHERE uid = token.uid`). Um comprador nunca recebe pedido de outro.
- **RN-03** — `POST /orders`: o corpo e validado contra o schema Zod de `packages/contracts`. O
  **servidor** define `id`, `uid` (do token), `createdAt` (ISO 8601) e `status='aguardando'`. O
  cliente nao escolhe nenhum desses. Order + items sao gravados numa unica transacao.
- **RN-04** — `PATCH /orders/:id/cancel`: o servidor revalida (a) que o pedido pertence ao `uid` do
  token e (b) que o status atual e `aguardando` (trava logistica, feature 017). Se nao for o dono →
  403; se o status nao permitir → 409. A UI continua mostrando o botao/estado, mas a decisao e do Worker.
- **RN-05** — Dinheiro sempre em centavos (INTEGER no D1), coerente com o front (`price`, `unitPrice`).
- **RN-06** — Toda query SQL e parametrizada via Drizzle (nunca concatenacao de string). Sem SQL injection.
- **RN-07** — Requisicao sem ID Token valido (ausente/expirado/forjado) e rejeitada com 401 antes de
  qualquer acesso a dados.
- **RN-08** — Os membros existentes da interface publica do `OrdersContext` (`orders`,
  `createOrdersFromCart`, `cancelOrder`) nao mudam de assinatura; os componentes consumidores atuais
  permanecem intactos. A troca mock↔HTTP e interna. `loading` e `error` sao acrescimos **aditivos**
  (novos campos) — nao quebram consumidores que nao os usam.

## Modelo de dados (D1)

```sql
-- migrations/0000_orders.sql
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  uid           TEXT NOT NULL,        -- dono; do token, nunca do body (RN-01)
  type          TEXT NOT NULL,        -- 'compra-direta'
  status        TEXT NOT NULL,        -- 'aguardando' | 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado'
  product       TEXT NOT NULL,        -- resumo: nome unico ou "N itens"
  quantity      INTEGER NOT NULL,
  unit          TEXT NOT NULL,        -- 'un' | 'cx' | 'kg'
  price         INTEGER,              -- centavos (RN-05)
  supplier_id   TEXT,
  supplier_name TEXT,
  delivery_address TEXT NOT NULL,     -- JSON do Address
  created_at    TEXT NOT NULL         -- ISO 8601
);
CREATE INDEX idx_orders_uid ON orders(uid);

CREATE TABLE order_items (            -- normaliza Order.items[] (D-018)
  order_id     TEXT NOT NULL REFERENCES orders(id),
  product_id   TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price   INTEGER NOT NULL,      -- centavos
  quantity     INTEGER NOT NULL,
  unit         TEXT NOT NULL
);
```

Mapeia o `Order`/`OrderItem` de `front/src/lib/account-mock.ts` e `front/src/lib/domain/order.ts`.
Campos exclusivos de cotacao (`offers`) ficam fora — esta fatia so grava `compra-direta`.

## Endpoints (Hono, todos atras do middleware de auth)

| Metodo | Rota | Regra |
|---|---|---|
| GET | `/orders` | RN-02 — lista os pedidos do `uid` |
| POST | `/orders` | RN-03 — cria pedido(s); body Zod; servidor define id/uid/createdAt/status |
| PATCH | `/orders/:id/cancel` | RN-04 — cancela com trava de dono + status |

## Fluxos e estados

**Criar pedido (checkout → persistencia):**
1. Comprador confirma o checkout no front.
2. `createOrdersFromCart` (interface inalterada) delega ao `OrderRepository`.
3. `HttpOrderRepository` chama `POST /orders` com `Authorization: Bearer <idToken>`.
4. Worker verifica o token (uid), valida o body (Zod), grava order+items em transacao, responde o pedido criado.
5. Front atualiza a lista. **Refresh → `GET /orders` traz o pedido do D1** (nao mais do `useState`).

**Cancelar pedido:**
1. Comprador clica "Cancelar" (so habilitado em `aguardando`, feature 017).
2. `cancelOrder` → `PATCH /orders/:id/cancel`.
3. Worker revalida dono + status; se ok, grava `cancelado`; senao 403/409.
4. Front reflete o novo status (ou mostra erro).

**Estados assincronos (novos no front):** `OrdersProvider` ganha `loading` e `error`. As telas de
Pedidos passam a ter **skeleton** (carregando) e **tela de erro** (falha de rede/servidor) — hoje
inexistentes porque tudo era instantaneo.

## Modelo de seguranca (quem garante o que)

| Camada | Responsavel | Protege |
|---|---|---|
| Perimetro (DDoS, WAF basico, TLS, rate-limit) | Cloudflare (free) | Volume, injecao comum, tráfego malicioso na entrada |
| Autenticacao (quem e voce) | Firebase (005a) + middleware do Worker | So requisicao com ID Token valido passa (RN-07) |
| Autorizacao (o que voce ve) | Codigo no Worker | Filtro por `uid` (RN-01, RN-02); dono no cancel (RN-04) |
| Regras de negocio | Codigo no Worker | Trava logistica de cancelamento (RN-04) |
| Segredos (pagamento futuro, service accounts) | Worker Secrets | Nunca no bundle do front |

Ganho concreto sobre a Alternativa B (Firestore-direto): a autorizacao fica **centralizada e testavel**
num so lugar (o Worker), em vez de espalhada em Security Rules.

## Testes

- **`runOrderRepositoryContract(repo)`** — suite de contrato reutilizavel (padrao das portas de
  pagamento/logistica). Tanto o `MockOrderRepository` quanto um D1 local (via Wrangler) precisam passar.
- **Suite existente (258) permanece verde:** os testes de UI injetam o `MockOrderRepository` (que
  herda a logica de hoje, com `INITIAL_ORDERS` como seed). Nada de rede nos testes.
- **Dev local:** Wrangler emula o D1 na maquina; migrations versionadas via drizzle-kit.

## Criterios de aceite

- [ ] `packages/contracts` exporta schemas Zod de `Order`/`OrderItem`/`Address`, usados por front e Worker.
- [ ] Worker deployado responde `GET/POST/PATCH /orders`; requisicao sem token valido → 401 (RN-07).
- [ ] `GET /orders` de um usuario nunca retorna pedido de outro `uid` (RN-02) — verificado com 2 usuarios.
- [ ] `POST /orders` ignora `uid`/`status`/`id` vindos do body; usa os do servidor (RN-03).
- [ ] `PATCH /orders/:id/cancel` recusa cancelar pedido de outro dono (403) e pedido fora de `aguardando` (409) (RN-04).
- [ ] Contract test verde para Mock e para D1 local.
- [ ] Suite do front permanece 258/258 (ou mais) verde; lint/tsc/build exit 0; sem `any`.
- [ ] Telas de Pedidos tem skeleton (loading) e tela de erro.
- [ ] **Validacao humana:** login Google → cria pedido no checkout → **refresh mantem o pedido** (vindo do D1) → cancela so em `aguardando`.
- [ ] ADR-001 atualizado (Alternativa C aprovada); D-027 registrada; `integration-guide.md` reescrito.

## Fora de escopo (registrado, nao e esquecimento)

- **Sincronizar o pedido no painel do fornecedor (sup-001).** Hoje e ponte em memoria (orders→market).
  Persistir exige auth de fornecedor + query por `supplier_id` → **fatia 2**.
- **Produtos, perfis, estoque** → fatias seguintes.
- **`createDirectOrder`** (legado, aposentado no flip S5b/D-023) — decidir remocao na implementacao.
- **Pagamento real** — segue mockado atras da porta (T2); Pub/Sub/Functions nao entram agora (ADR-001 §8).
- **Cotacoes/ofertas (leilao)** — Fase 2 (D-014), microservico separado.
- **Hospedagem do front** — decisao separada; esta fatia so trata do backend de dados.

## Rollout (fases da feature 006, fatia 1)

```
006.1  packages/contracts: schemas Zod Order/OrderItem/Address
006.2  back/: scaffold Worker (Hono + Wrangler + D1 binding) + migration 0000_orders
006.3  back/: middleware auth (verifica Firebase ID Token) + GET /orders
006.4  back/: POST /orders + PATCH /orders/:id/cancel (trava logistica no servidor)
006.5  front/: OrderRepository (porta) + MockOrderRepository (extrai a logica atual)
006.6  front/: contract test runOrderRepositoryContract (mock + D1 local)
006.7  front/: HttpOrderRepository + api-client (injeta getIdToken)
006.8  front/: OrdersProvider assincrono + skeleton + tela de erro; flag NEXT_PUBLIC_USE_BACKEND
006.9  deploy do Worker + validacao humana
```

Cada passo = tarefa pequena e testavel no fluxo Opus-planeja/Haiku-executa + review-checklist (D-012).

## Riscos e mitigacao

| Risco | Mitigacao |
|---|---|
| Terceiro fornecedor (Cloudflare) alem do Firebase | Aceito conscientemente (D-027); auth e dados sao dominios separados |
| `OrdersProvider` async pode regredir telas instantaneas | Contract test + suite verde contra o mock antes de plugar o HTTP |
| Dev local do D1 | Wrangler emula o D1; migrations versionadas |
| Conta/projeto Cloudflare inexistente | Passo 006.2; o cliente faz o login/conta (agente nao cria conta por ele) |

## Referencias

- Estado do front: `front/src/contexts/orders-context.tsx`, `front/src/lib/account-mock.ts`,
  `front/src/lib/domain/order.ts`, `front/src/lib/ports/` (portas de pagamento/logistica como padrao).
- Governanca: `.claude/docs/design/adr/adr-001-estrategia-backend.md` (D-026), `.claude/docs/decisoes.md`
  (D-001, D-005, D-010, D-014, D-018, D-023), `E:\Labdev\CLAUDE.md` (WORKFLOW §5-6, monorepo + contracts).
- Guia a reescrever: `.claude/docs/backend/integration-guide.md`.
- Specs relacionadas: `spec-compra-direta-carrinho-checkout.md`, `spec-pedido-detalhe-cancelamento.md`,
  `spec-auth-firebase.md`.
- Bibliotecas: `firebase-auth-cloudflare-workers` (ou `jose`), `drizzle-orm` + `drizzle-kit` (D1), `hono`.
