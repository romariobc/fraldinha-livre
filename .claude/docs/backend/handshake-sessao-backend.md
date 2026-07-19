# Handshake — Sessão de Backend (thread B) × Sessão de Frontend/Revisão

> **Propósito:** passagem de bastão para a **sessão exclusiva de backend**. Mostra como o front está
> estruturado para receber o backend, onde estão as decisões já tomadas, e o contrato de trabalho entre
> as duas sessões. Leia isto primeiro; depois o ADR, a spec e o plano (links na §2).

---

## 1. Divisão de papéis (a partir de 2026-07-18)

| Sessão | Responsabilidade |
|---|---|
| **Sessão de BACKEND** (exclusiva, nova) | **Implementa** a thread B (Worker Cloudflare + D1 + integração no front). Segue o loop D-006: recebe prompt Haiku por tarefa, executa, auto-testa (D-008), relata. |
| **Sessão de FRONTEND/REVISÃO** (esta) | **Revisa e relata** cada entrega do backend pelo `review-checklist.md` (D-012): `git show --stat` + `build` + `lint` + **testes** próprios, nunca só o relatório. Também cuida de mudanças de front puras (ex.: a marca/D-028). |

O loop continua **Opus planeja/revisa · Haiku executa** ([[workflow-opus-haiku]]). A sessão de backend
NÃO decide arquitetura sozinha — as decisões já estão tomadas (§2). Se surgir dúvida de arquitetura,
para e sobe para revisão.

---

## 2. Contexto já pronto (LER antes de codar — não re-decidir)

1. **ADR-001** `../design/adr/adr-001-estrategia-backend.md` — status **DECIDIDA**, §12 = Alternativa C
   (Cloudflare Workers + D1). Matriz A2/B/C, stack, rollout.
2. **Decisões** `../decisoes.md`:
   - **D-026** resolvida → Cloudflare Workers + D1.
   - **D-027** → emenda D-001: auth no Google/Firebase; dados/API na Cloudflare (duas nuvens por domínio).
   - **D-005** → monorepo (`front/` + `back/` + `packages/`).
   - **D-017/D-018** → 1 pedido por fornecedor; `Order.items[]`. **D-025** → trava logística de cancelamento.
3. **Spec da fatia 1** `../design/specs/spec-backend-pedidos-cloudflare.md` (APROVADA) — escopo **só Pedidos**.
4. **Plano-mestre** `../design/plans/B-backend-pedidos-breakdown.md` — tarefas **B1..B9**, dependências,
   **interfaces canônicas** (Zod, `OrderRepository`, contrato HTTP) fixadas uma vez, e 2 decisões que a
   spec deixou implícitas (**DEC-A**: split por fornecedor fica no front; **DEC-B**: `OrdersContext` vira
   assíncrono — muda a assinatura). **Comece por B1.**
5. ⚠️ `integration-guide.md` (nesta pasta) está **DESATUALIZADO** (assume NextAuth) — será reescrito na
   thread B; **não seguir** como está.

---

## 3. Como o FRONT está estruturado para receber o backend

### 3.1 Seam MADURO — pagamento/logística (o PADRÃO a copiar) ✅
Já existe o padrão hexagonal completo; a fatia de dados deve espelhá-lo:
```
front/src/lib/ports/         payment.ts · fulfillment.ts        (interfaces)
front/src/lib/ports/__tests__/  *.contract.ts                   (contract tests reutilizáveis)
front/src/lib/adapters/      mock-payment-gateway.ts · mock-fulfillment-service.ts
front/src/lib/adapters/__tests__/
```
> O backend real só pluga um adapter novo aqui — a UI não muda. **B5/B6 replicam esse padrão para `OrderRepository`.**

### 3.2 Seam de DADOS — o BURACO a construir (B5–B8) 🔨
```
front/src/contexts/orders-context.tsx   ← nasce de useState(INITIAL_ORDERS) — SOME no refresh (o alvo)
front/src/lib/account-mock.ts           ← tipos Order/OrderItem/Address + INITIAL_ORDERS (seed)
front/src/lib/domain/order.ts           ← buildOrdersFromCart() já divide o carrinho por fornecedor (DEC-A)
```
Hoje **NÃO existe** `OrderRepository`/`ProductRepository`. A thread B cria `OrderRepository` (porta) +
`MockOrderRepository` (extrai a lógica atual) + `HttpOrderRepository` (produção), e torna o
`OrdersProvider` assíncrono (DEC-B) com `loading`/`error`.

### 3.3 Auth — de onde vem o ID Token 🔑
```
front/src/contexts/auth-context.tsx     ← expõe { user, profile, role, ... } (Firebase, 005a)
```
O `user` é o usuário do Firebase Auth. O token para o backend vem de **`user.getIdToken()`** (Firebase),
anexado como `Authorization: Bearer <token>` no `api-client` (B7). O Worker verifica esse JWT
(`firebase-auth-cloudflare-workers`/`jose`, **sem** Admin SDK — não roda no runtime do Workers).

### 3.4 Onde o backend vai morar
```
back/                 ← Worker Hono + Drizzle + D1 (a criar em B2). Monorepo, preserva D-005.
packages/contracts/   ← schemas Zod compartilhados front↔Worker (a criar em B1). Seam de tipos do WORKFLOW.
```

### 3.5 Regras invioláveis (do spec — a revisão vai cobrar)
- `uid` **sempre** do token verificado, nunca do body (RN-01). Toda query de pedido: `WHERE uid = token.uid` (RN-02).
- Servidor define `id`/`uid`/`createdAt`/`status`; cliente não (RN-03). Cancelar só em `aguardando`, revalidado no Worker (RN-04).
- Centavos (INTEGER). Queries parametrizadas via Drizzle (RN-06). Sem `any`. Commits pt-BR.

---

## 4. O loop de trabalho (por tarefa B-N)

```
Sessão BACKEND: escreve/recebe prompt Haiku da tarefa → implementa → auto-testa (D-008, ≤3 tentativas)
   → commit pt-BR → relata (arquivos, resultado de cada verificação, pendências)
        │
        ▼
Sessão FRONTEND/REVISÃO (esta): pega o commit e VERIFICA por conta própria (D-012):
   1. git show --stat <hash>  (Added/Modified/DELETED reais)
   2. back/: npm test   ·   front/: npm run lint && npm run build   ·   testes da tarefa
   3. Confere cada critério de aceite com evidência própria (não só o relatório)
   4. Lê o diff dos arquivos-núcleo; checa regressão
   5. RELATA: aprovado / ajustes necessários (com evidência)
```
**Guardas da fatia:** até B8, o front roda com `NEXT_PUBLIC_USE_BACKEND` **off** (mock) — suíte
permanece ≥258 verde; nenhuma etapa quebra o app. B9 (deploy + validação humana) é coordenador+cliente.

---

## 5. Gotchas operacionais

- **Worktrees:** decisão/plano/spec desta thread foram feitos no worktree `eloquent-montalcini-2dff41`
  (branch `Romir/master-session-restart-535624`). Antes de assumir que algo não existe, rode
  `git worktree list` + `git log --all` ([[feedback-check-worktrees]]). Se a sessão de backend nascer em
  outro worktree, **mesclar esta branch primeiro** (ou trabalhar nela).
- **Arquivos gitignored** (`.env.local`, `NEXT_PUBLIC_BACKEND_URL`) vão no `front/` do worktree ativo
  ([[worktree-env-local-gotcha]]).
- **Pré-requisito humano do cliente (só na B9):** criar conta/projeto Cloudflare + D1 + `wrangler login`.
  O agente não cria conta.

---

## 6. Primeiro passo concreto

**B1 — `packages/contracts`: schemas Zod de `Order`/`OrderItem`/`Address`** (interfaces canônicas na §
"Interfaces canônicas" do breakdown). Sem dependências; destrava todo o resto. A sessão de backend
escreve o prompt Haiku de B1 a partir do breakdown e dispara; esta sessão revisa a entrega.
