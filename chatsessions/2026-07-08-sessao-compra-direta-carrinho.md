# Chatsession 2026-07-08 — Feature 016: compra direta (catálogo → carrinho → checkout)

**Sessão-mãe (coordenador).** Método: plano → tarefas pequenas com teste → subagentes por unidade →
loop de 3 tentativas → coordenador integra e revisa pelo D-012. Nada é "pronto" sem teste verde.

## Onde estamos (snapshot para retomar após compact)

**Fase 1 do marketplace:** JÁ NA MAIN (merge anterior). Branch de trabalho: `Romir/eloquent-montalcini-2dff41`
(worktree `.claude/worktrees/eloquent-montalcini-2dff41`). Rodar sempre no `front/` do worktree.

**Feature 016 — planejada e aprovada:**
- Graphify rodado em `front/src` (309 nós, 16 comunidades, 0 tokens LLM). God nodes: `useAuth`, `Order`,
  `formatPrice`, `useMarket`. Grafo em `graphify-out/` (gitignored).
- Decisões **D-016..D-020** aprovadas (decisoes.md): carrinho canônico (BuyModal→"Comprar agora"),
  split por fornecedor no checkout, `Order.items[]` (breaking), carrinho em localStorage, nicho
  ampliado (mães/bebês/cuidados/wellness) + ponto de extensão UCP (não implementar).
- Spec: `.claude/docs/design/specs/spec-compra-direta-carrinho-checkout.md` (RN-01..RN-15, portas
  Payment/Fulfillment com contract tests). Fora de escopo: motor de leilão (D-014), pagamento/fulfillment reais.

**Plano — tarefas (caminho crítico T0→T1→T6→T9→T12→T13→T15):**
T0 infra testes · T1 contratos+portas · T2 adaptadores mockados+contract tests · T3 nicho/schema ·
T4 página produto · T5 cards linkam · T6 cart-context · T7 UI carrinho · T8 bifurcação cesta ·
T9 máquina checkout · T10 endereço · T11 revisão · T12 pagamento STUB · T13 confirmação/pedidos ·
T14 histórico · T15 integração. (+ T1.5 migração `Order.items[]` como tarefa isolada com regressão.)

**T0 — DONE (commit `7b8388a`).** Grande caçada de infra resolvida:
- Node atualizado 20.15.0 → **20.20.2** (LTS Iron) — resolveu `ERR_REQUIRE_ESM` (pacotes ESM-only
  exigem `require(esm)`, Node ≥20.19). **D-021** grava isso: `engines.node >=20.19` + `.nvmrc 20.20.2`.
- Vitest fixado na **v3** (vitest 4 puxa std-env@4 ESM-only). RTL + jsdom. Alias `@` ABSOLUTO
  (`fileURLToPath` — o subagente tinha posto relativo, que o Vite não resolve).
- `npm test` 3/3 verde; lint EXIT 0; build EXIT 0.
- Higiene: cache do npm movido para `E:\npm-cache` (C: estava com 4% livre). Órfãos em node_modules
  (next-auth/openid-client/msw/sharp) — limpar com `npm ci` quando conveniente.
- **Lição:** o subagente errou 2 causas-raiz (Node "abaixo do exigido"; alias). Coordenador
  diagnosticou com evidência própria. Reforça o D-012.

**T1 — PROMPT APRESENTADO, aguardando aval do cliente.** Define camada de contratos, zero UI, testado:
- `src/lib/domain/{money,cart,order}.ts` (Money=centavos; CartItem; OrderItem; DomainOrder; helpers puros).
- `src/lib/ports/{payment,fulfillment}.ts` (PaymentGateway/FulfillmentService — só interfaces + tipos).
- Testes unit em `src/lib/domain/__tests__/`. `formatPrice` NÃO duplicado (vem de @/lib/utils).
- NÃO tocar em arquivo existente (só importar `Address` de account-mock). Migração do `Order` real = T1.5.
- 3 perguntas abertas ao cliente: (1) subpastas domain/ports vs flat [recomendo subpastas];
  (2) `method: pix|card` — incluir boleto?; (3) migração do Order como T1.5 isolada [recomendo sim].

## Pendência imediata (pós-compact)

Cliente responde às 3 perguntas e aprova o T1 → sessão-mãe escreve `plans/T1-contratos-dominio.md`,
dispara `SA-Domain` (pode reusar o agente a37c… que tem contexto do T0), revisa pelo D-012.

**Risco operacional:** houve encerramentos de subagente por limite de gasto/sessão hoje; se um morrer
com erro de API, pausar — o trabalho commitado está seguro.
