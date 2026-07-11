# Spec — Detalhe e cancelamento de pedido (comprador)

**Domínio:** comprador (minha-conta) | **Feature:** 017 | **Status:** APROVADA (brainstorming 2026-07-10)

## Contexto
Hoje o `OrderCard` (aba Pedidos/Histórico de `/minha-conta`) mostra só um resumo (produto, qtd, endereço
resumido, status). Não há como **ver os dados completos** do pedido (itens/linhas/total) nem **cancelar**. O
comprador pediu: (1) uma forma de checar os dados do pedido e (2) lógica de cancelamento com **restrição
logística**. Sem backend (006), tudo é estado mock client-side: editar/cancelar = mutar `orders-context`;
sinalizar o fornecedor = refletir no `market-context` (o `DirectOrder` do `sup-001`).

Decisões do brainstorming (2026-07-10):
- **Escopo:** ver detalhes + **cancelar apenas** (NÃO editar itens/endereço).
- **Detalhe:** **acordeão inline** no próprio card (não modal, não página).
- **Cancelar:** permitido **só em `aguardando`**; depois de confirmado, **bloqueia** ("fale com o fornecedor").

## Regras de negócio

- **RN-01 (Detalhe em acordeão)** O `OrderCard` fica expansível. Colapsado = o resumo atual. Um chevron/clique no
  header alterna. Expandido mostra: **linhas de item** via `getOrderItems(order)` (T1.5) — `productName`,
  `quantity`, `unitPrice` (formatado), e **subtotal da linha** (`unitPrice × quantity`) —, **total do pedido**,
  **endereço completo** (todos os campos) e **data de criação**. `aria-expanded` no controle. Funciona em Pedidos
  **e** Histórico.

- **RN-02 (Cancelamento — quando)** O botão **"Cancelar pedido"** aparece **somente** quando
  `status === 'aguardando'` e `type === 'compra-direta'` (aguardando confirmação do fornecedor). Nos demais status,
  o botão **não** é renderizado.

- **RN-03 (Restrição logística — mensagem)** Quando não é cancelável, exibir a razão contextual no lugar do botão:
  - `confirmado` → "Pedido confirmado. Para alterar, fale com o fornecedor."
  - `a-caminho` → "Pedido a caminho — não pode ser cancelado por aqui."
  - `entregue` / `cancelado` → estado terminal (sem ação nem mensagem de bloqueio).

- **RN-04 (Confirmação de cancelamento)** Cancelar exige confirmação explícita antes de efetivar (dialog:
  "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita." + Voltar / Confirmar cancelamento).
  Reusar o componente `Dialog` de `components/ui`.

- **RN-05 (Efeito do cancelamento)** Ao confirmar: `orders-context.cancelOrder(orderId)` muda o status do pedido
  para `cancelado`. O pedido sai da aba **Pedidos** e passa a aparecer no **Histórico**. Toast de sucesso
  "Pedido cancelado".

- **RN-06 (Sinalização ao fornecedor)** Se `order.supplierId === 'sup-001'`, o `DirectOrder` correspondente
  (`id === order.id`) no `market-context` passa a `cancelado` — a baixa/sinalização real no painel do fornecedor.
  **No-op** se não encontrado (os pedidos-seed não estão no `market-context`). A coordenação entre os dois contextos
  acontece **no componente** (mesmo padrão do checkout, S5b).

- **RN-07 (Correção de dados — dívida D-022)** Renderizar os `items[]` expõe a dívida D-022: no seed
  (`account-mock.ts`), `items[].unitPrice` foi gravado = **total** do pedido, não por-unidade. Corrigir: cada
  `items[].unitPrice` do seed passa a ser o **preço unitário**, com `unitPrice × quantity === price` (total do
  pedido). Ajustar o `price`/`quantity` de qualquer pedido cujo total não divida inteiro (ex.: ord-004: 10500/40).
  Pedidos criados pelo checkout (D-023) já têm unitPrice unitário correto — não mexer.

- **RN-08 (Não regredir)** O acordeão funciona em Pedidos e Histórico; cancelar só em Pedidos/`aguardando`.
  `getOrderItems` (T1.5) é reusado (fallback de itens legados intacto). Auth (005a), checkout/flip (S5/S7) e o
  painel do fornecedor continuam funcionando. Nenhum `float` para dinheiro; `formatPrice` é o único formatador.

## Fora de escopo
Editar itens/quantidade/endereço do pedido; aprovação de cancelamento pelo fornecedor (estado pendente);
página/modal de detalhe; backend real. Ficam para depois (006+).

## Critérios de aceite
- [ ] `npm test` verde; `npm run lint` EXIT 0; `npx tsc --noEmit` sem erro; `npm run build` passa.
- [ ] Card expande/colapsa mostrando itens (nome × qtd, preço unit, subtotal linha), total, endereço, data.
- [ ] "Cancelar pedido" só aparece em `aguardando`; nos demais, mensagem de restrição correta (ou nada em terminais).
- [ ] Cancelar pede confirmação; ao confirmar, pedido vira `cancelado` e migra para Histórico; toast exibido.
- [ ] Pedido `sup-001` cancelado reflete `cancelado` no painel do fornecedor (market-context); no-op p/ os demais.
- [ ] Seed: `items[].unitPrice` unitário coerente (unit × qtd === total); pedidos do checkout inalterados.
- [ ] Nenhum `any` (código nem teste); mocks com `vi.mocked`.
