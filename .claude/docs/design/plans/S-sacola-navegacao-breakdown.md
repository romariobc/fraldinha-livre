# Thread S — Sacola + navegação (fluxo resgatado)

**Origem:** feedback de usabilidade 2026-07-09. Objetivo: resgatar o fluxo da sacola (carrinho) e
corrigir a navegação (sacola↔conta), quebrado em tarefas pequenas para o Haiku.

**Fundação já pronta (reusar, NÃO reimplementar):**
- T1 — `src/lib/domain/cart.ts`: `CartItem`, `lineTotal`, `cartSubtotal`, `groupBySupplier`.
- T1.5 — `Order.items[]` + `getOrderItems`.
- T2 — `PaymentGateway`/`FulfillmentService` (portas) + mocks + contract tests.

**Decisões aplicáveis:** D-016 (carrinho canônico; ProductCard→"Adicionar à sacola"; BuyModal→"Comprar
agora"), D-017 (1 pedido por fornecedor), D-019 (carrinho em localStorage), D-006/RN-06 ("Buscar ofertas
personalizadas" presente-mas-inativo atrás de LEILAO_ATIVO), D-022 (comprador 100% compra-direta).

**Diagnóstico da navegação (Header atual):** o ícone de sacola aciona `handleCartClick → /minha-conta`
(badge = pedidos ativos) e o email é `<span>` não-clicável. Semântica trocada. Alvo: sacola→/sacola
(badge = itens do carrinho); email→menu da conta (Perfil/Config/Sair).

---

## Tarefas (ordem: S1 → {S2, S3, S4} → S5)

### S1 — Cart context (estado da sacola)  [dep: T1]
- `src/contexts/cart-context.tsx`: `CartProvider` + `useCart`. Estado `CartItem[]` persistido em
  **localStorage** (D-019, chave ex. `fl.cart.v1`; hidratar no mount, SSR-safe).
- API: `addItem(item)` (merge por productId+supplierId, soma quantity), `removeItem(id)`,
  `updateQty(id, qty)` (guard inteiro ≥1), `clear()`. Derivados: `items`, `itemCount`,
  `subtotal` (usa `cartSubtotal` T1), `bySupplier` (usa `groupBySupplier` T1).
- Provider no `app/(main)/layout.tsx`. **Zero mudança visual.**
- **DoD:** testes unit do reducer/derivados (add novo, merge mesmo produto, remove, updateQty guard,
  persist/hydrate com localStorage mockado); tsc/lint/build verdes.

### S2 — Adicionar à sacola (catálogo)  [dep: S1]
- `ProductCard`: CTA primária **"Adicionar à sacola"** → `useCart.addItem`; toast **"Adicionado à
  sacola"** com ação "Ver sacola"; **permanece no catálogo**.
- `BuyModal` "Comprar agora" segue como express por ora (mantém `createDirectOrder` até o S5 fazer o flip).
- **DoD:** clicar adiciona ao contexto (badge sobe) + toast correto; teste RTL de interação; verdes.

### S3 — Página da Sacola  [dep: S1]
- Rota `/sacola`: itens **agrupados por fornecedor** (D-017), controles qty +/- e remover, subtotal por
  fornecedor + total, empty-state (link catálogo).
- CTA **"Finalizar compra"** — por ora **desabilitada** (ativa no S5). CTA **"Buscar ofertas
  personalizadas"** presente e **desabilitada** atrás de `LEILAO_ATIVO` (RN-06).
- **DoD:** render dos itens do contexto; qty/remove refletem no subtotal; testes; verdes.

### S4 — Reestruturar navegação (Header)  [dep: S1]
- Ícone sacola → `/sacola`, **badge = `itemCount` do `useCart`** (não mais `activeOrdersCount`).
- Email do auth vira **menu clicável** → conta: Perfil / Configurações / Sair (→ `/minha-conta?tab=perfil`).
  Equivalente no menu mobile. Logout preservado.
- **DoD:** bag leva à sacola com badge de itens; email abre acesso ao perfil; teste de nav; verdes.

### S5 — Checkout + finalizar  [dep: S1, S3, T1, T2]  (pode subdividir)
- S5a: máquina endereço → revisão → pagamento **STUB** → confirmação (guards por etapa).
- S5b: confirmar cria **1 pedido por fornecedor** (`buildOrdersFromCart` T1 + mocks Payment/Fulfillment
  T2), **limpa a sacola**, pedidos aparecem em Pedidos. Ativa "Finalizar compra" e **aposenta o
  create-order instantâneo** do BuyModal (flip do fluxo — toast passa a "pedido confirmado" só aqui).
- **DoD:** fluxo mock completo, pedidos por fornecedor, contract tests satisfeitos; verdes.

---

## Coerência do app entre etapas
Até o S5 existir, "Finalizar compra" fica desabilitada e o BuyModal "Comprar agora" continua criando o
pedido direto (caminho atual funcional) — evita beco sem saída. O S5 faz o flip.

## Fora deste thread (separado)
Nicho/schema de produto (T3) e página de produto (T4) são a trilha de enriquecimento do catálogo — não
bloqueiam a sacola. Ficam para depois.
