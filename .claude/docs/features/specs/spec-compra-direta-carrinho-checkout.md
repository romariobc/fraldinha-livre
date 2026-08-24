# Spec — Compra direta ponta a ponta: catálogo → produto → carrinho → checkout

**Dominio:** catalogo + comprador + plataforma | **Feature relacionada:** 016 | **Status:** APROVADA (plano + D-016..D-020, 2026-07-03)

## Contexto

A feature 014 entregou uma compra direta **mono-item, 1-clique** (`BuyModal` no card). O objetivo
agora e um **fluxo de marketplace completo e navegavel**: catálogo → página de produto → carrinho →
cesta (com bifurcação) → checkout (endereço → revisão → pagamento STUB → confirmação) → histórico.

Base existente a **reusar** (grafo Graphify, 2026-07-03): `filterProducts`/`CatalogFilters`,
`products.ts`/`suppliers.ts` (preços já em centavos), `formatPrice` (lib/utils), `auth-context`
(`useAuth`, `profile`, `isProfileComplete`), validação de endereço, `orders-context`,
`order-adapters.ts` + `market-context.addDirectOrder` (ponte para o painel), `feature-flags.ts`
(`LEILAO_ATIVO`), `minha-conta` (histórico).

## Regras de negócio

- **RN-01 (Money)** Todo valor monetário é **inteiro em centavos**. Formatação só via
  `formatPrice(cents)` de `lib/utils.ts`. Proibido `float` para dinheiro.

- **RN-02 (Produto — D-020)** `Product` ganha `slug`, `categoria`, `descricao` e `atributos`
  (registro tipado, ex.: faixa etária, tamanho, marca). Catálogo expande para **mães/bebês/cuidados/
  wellness**. `slug` é único e é a chave da rota `/produto/[slug]`.
  **Ponto de extensão UCP:** deixar um comentário/tipo marcando onde um descritor estruturado para
  descoberta por agentes se encaixaria. **NÃO implementar** descoberta/UCP agora.

- **RN-03 (Carrinho — D-019)** `CartProvider` + `useCart()` expõe `items`, `addItem(product, qty)`,
  `removeItem(productId)`, `updateQty(productId, qty)`, `clear()`, `subtotalCents`, `count`.
  Regras: quantidade **inteira ≥ 1**; adicionar produto já presente **soma** a quantidade (dedupe por
  `productId`); `updateQty(_, 0)` remove. Estado **persiste em `localStorage`** (chave versionada) e
  é reidratado no mount sem quebrar SSR (hidratação client-side).

- **RN-04 (Página de produto)** Rota `/produto/[slug]`: nome, descrição, atributos, **fornecedor +
  rating**, preço via `formatPrice`, seletor de quantidade, **"Adicionar ao carrinho"** e
  **"Comprar agora"** (D-016: adiciona e navega para `/checkout`). Slug inexistente → 404.

- **RN-05 (Catálogo)** Cards passam a **linkar para `/produto/[slug]`**; o CTA primário do card vira
  **"Adicionar ao carrinho"** (D-016). Busca/filtros/paginação **reusam** o que existe.

- **RN-06 (Cesta e bifurcação)** Rota `/carrinho`: lista de itens (qty, remover), subtotal, e **dois
  CTAs**:
  1. **"Finalizar compra"** — ativo, navega para `/checkout`.
  2. **"Buscar ofertas personalizadas"** — **PRESENTE porém INATIVO** enquanto `LEILAO_ATIVO === false`:
     renderizado, `disabled` + `aria-disabled`, badge **"Em breve"**, **não navega e não dispara nada**.
     Com a flag `true`, habilita (o motor de leilão **não** é implementado aqui — D-014).
  Header ganha **badge com `count` do carrinho** (padrão do badge de pedidos ativos já existente).

- **RN-07 (Checkout — máquina de passos)** Rota `/checkout` com 4 passos: **endereço → revisão →
  pagamento → confirmação**. Guards: carrinho vazio → redirect `/carrinho`; deslogado → `/login?redirect=/checkout`;
  **perfil incompleto** (`isProfileComplete`) → `/minha-conta?tab=perfil&returnTo=/checkout` (reusa a
  trava da 007a). Voltar/avançar não perde dados. Refresh no meio não corrompe (estado derivado do carrinho + perfil).

- **RN-08 (Passo endereço)** Default = `profile.address` (perfil real). Opção "outro endereço" com a
  **mesma validação já existente** (logradouro, número, CEP, cidade, UF obrigatórios). Sem endereço
  válido não avança. Frete: **"a combinar com o fornecedor"** (sem cálculo).

- **RN-09 (Passo revisão)** Itens agrupados **por fornecedor** (D-017), subtotal por grupo, total
  geral, endereço escolhido. Total = soma de `priceInCents × qty`. Nenhuma taxa/frete somado.

- **RN-10 (Passo pagamento — STUB)** Usa a **porta** `PaymentGateway` (adaptador mockado). Métodos
  fake (ex.: PIX / cartão). Estados: `idle → processing → success | error`. Erro exibe mensagem e
  permite **retry**. **Nenhuma** integração real; nenhum dado sensível de cartão persistido.

- **RN-11 (Confirmação e criação dos pedidos — D-017/D-018)** Pagamento aprovado → usa a porta
  `FulfillmentService` (mockado) e cria, via `orders-context`, **um pedido por fornecedor**, cada um
  com `items: OrderItem[]`. Pedidos de `sup-001` continuam aparecendo no painel do fornecedor pela
  ponte existente (`orderToDirectOrder` + `addDirectOrder`), adaptada para `items[]`. **Carrinho é
  limpo** só após sucesso. Tela de confirmação mostra o(s) número(s) do pedido.

- **RN-12 (Portas e adaptadores — fora de escopo do backend)** Interfaces tipadas em
  `lib/ports/`:
  ```ts
  interface PaymentGateway {
    authorize(input: PaymentRequest): Promise<PaymentResult>  // success | error
  }
  interface FulfillmentService {
    createShipment(input: ShipmentRequest): Promise<ShipmentResult>
  }
  ```
  Implementações mockadas em `lib/adapters/` (latência simulada + **cenário de falha** determinístico
  para teste). **Contract tests** validam a porta, não a implementação — o backend real deve passar
  nos mesmos testes sem tocar na UI.

- **RN-13 (Order — D-018)** `Order` ganha `items: OrderItem[]` (`{ productId, nome, priceInCents,
  quantity }`) + `supplierId`/`supplierName` + `totalCents`. Migrar consumidores: `minha-conta`
  (PedidosTab/HistoricoTab/OrderCard), painel do fornecedor, `order-adapters.ts`. Pedidos legados do
  mock são migrados para o novo formato.

- **RN-14 (Histórico mínimo)** Os pedidos criados no checkout aparecem em `/minha-conta` (Pedidos e
  Histórico) com seus itens e total.

- **RN-15 (Não regredir)** Gating do leilão (013), auth/onboarding (005a), perfil+segurança (007a) e
  o painel do fornecedor continuam funcionando.

## Critérios de aceite (globais)

- [ ] `npm test` verde (unit + component + contract + gating); `npm run lint` EXIT 0; `npm run build` passa
- [ ] Fluxo navegável: catálogo → `/produto/[slug]` → carrinho → `/checkout` (4 passos) → confirmação → histórico
- [ ] Carrinho persiste em `localStorage`; badge no Header bate com `count`
- [ ] "Buscar ofertas personalizadas" visível, **inativo** com `LEILAO_ATIVO=false`; habilita com `true` (sem leilão implementado)
- [ ] Checkout multi-fornecedor cria **1 pedido por fornecedor**; pedido de `sup-001` aparece no painel
- [ ] Pagamento: sucesso cria pedido; **falha** exibe erro e permite retry; contract tests cobrem ambos
- [ ] Guards: carrinho vazio, deslogado, perfil incompleto
- [ ] Nenhum `float` para dinheiro; `formatPrice` é o único formatador

## Fora de escopo

- Motor de leilão (D-014) · gateway de pagamento real e fulfillment real (backend) · frete calculado ·
  cupons/descontos · descoberta por agentes (UCP — só ponto de extensão) · persistência de pedidos em
  Firestore (fica no 006).

## Referências

- Decisões: D-009 (Modelo A), D-013 (segurança), D-014 (leilão microserviço), **D-016..D-020**
- Grafo: `graphify-out/GRAPH_REPORT.md` (god nodes: `useAuth`, `Order`, `formatPrice`)
- Código a reusar: ver seção "Contexto"
