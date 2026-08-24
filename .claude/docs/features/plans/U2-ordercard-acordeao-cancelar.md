# U2 — OrderCard: acordeão de detalhe + cancelar (trava logística)

**Spec:** spec-pedido-detalhe-cancelamento.md — RN-01..RN-06, RN-08. **Feature:** 017. **D-025.**
**Papel:** subagente SA-OrderCardUI (Haiku). Coordenador revisa pelo D-012. **Depende de:** U1 ✅ (cancelOrder/cancelDirectOrder).

## Objetivo
Transformar o `OrderCard` (resumo estático) num card **expansível** (acordeão) que mostra os itens/total/endereço/data,
e adicionar o **cancelamento** com **trava logística** (só em `aguardando`) + confirmação + sinalização ao fornecedor.

## Estado atual (ler antes)
- `src/components/minha-conta/OrderCard.tsx`: componente **presentacional** (sem 'use client', sem hooks). Props
  `{ order, mode: 'pedidos' | 'historico' }`. Já tem `STATUS_CONFIG`, `formatAddress`, `formatDate`, o label
  type-aware de `aguardando`.
- Usado por `PedidosTab` (mode="pedidos", só status ativos) e `HistoricoTab` (mode="historico", entregue/cancelado).
  Ambos passam só `order` e `mode` — **não mudar as assinaturas** desses dois (o OrderCard usa os hooks direto).
- `src/lib/order-items.ts`: `getOrderItems(order): OrderItem[]` (itens reais ou fallback legado).
- `src/contexts/orders-context.tsx`: `useOrders().cancelOrder(id)` (U1). `src/contexts/market-context.tsx`:
  `useMarket().cancelDirectOrder(id)` (U1).
- `src/components/ui/dialog.tsx`: `Dialog, DialogContent, DialogHeader, DialogTitle` (`open`/`onOpenChange`) —
  ver uso em `BuyModal.tsx`.
- `formatPrice` de `@/lib/utils`. `lineTotal` de `@/lib/domain/cart` **não** serve aqui (é para CartItem); calcule o
  subtotal da linha como `item.unitPrice * item.quantity`.

## Escopo — MODIFICAR `src/components/catalogo`... NÃO: é `src/components/minha-conta/OrderCard.tsx`
1. Adicionar `'use client'` no topo. Importar `useState`, `useOrders`, `useMarket`, `toast` (sonner),
   `getOrderItems`, `Dialog...`, e ícones `ChevronDown`/`ChevronUp` (lucide-react).

2. **Acordeão (RN-01):**
   - Estado `const [expanded, setExpanded] = useState(false)`.
   - Um **botão chevron** no header (à direita) alterna `expanded`. `aria-expanded={expanded}`,
     `aria-controls` apontando para o id do painel; `aria-label` "Ver detalhes do pedido" / "Ocultar detalhes".
     (NÃO tornar o card inteiro clicável — evita conflito com o botão de cancelar.)
   - Quando `expanded`, renderizar um painel (com o id referenciado) mostrando:
     - **Linhas de item** via `getOrderItems(order)`: para cada item, `productName`, `× {quantity}`,
       `{formatPrice(unitPrice)}` (unit) e subtotal `{formatPrice(item.unitPrice * item.quantity)}`.
     - **Total:** `formatPrice(order.price ?? somaDosSubtotais)`.
     - **Endereço completo:** todos os campos de `order.deliveryAddress` (logradouro, número, complemento?,
       bairro, cidade/UF, CEP).
     - **Data:** `formatDate(order.createdAt)`.
   - Funciona igual em `mode="pedidos"` e `mode="historico"`.

3. **Cancelar + trava logística (RN-02/03/04/05/06)** — só em `mode === 'pedidos'`:
   - Se `order.status === 'aguardando' && order.type === 'compra-direta'`: renderizar botão **"Cancelar pedido"**
     (estilo destrutivo discreto, ex.: texto/borda `text-red-600`). Clique abre um **Dialog de confirmação**
     (RN-04): título "Cancelar pedido", texto "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser
     desfeita.", botões "Voltar" e "Confirmar cancelamento".
   - Ao confirmar: `useOrders().cancelOrder(order.id)`; se `order.supplierId === 'sup-001'` →
     `useMarket().cancelDirectOrder(order.id)`; `toast.success('Pedido cancelado')`; fechar o Dialog. (O pedido, agora
     `cancelado`, sai de Pedidos e aparece no Histórico automaticamente — os Tabs já filtram por status.)
   - Se `order.status === 'confirmado'`: **sem botão**; mostrar texto de restrição "Pedido confirmado. Para alterar,
     fale com o fornecedor."
   - Se `order.status === 'a-caminho'`: texto "Pedido a caminho — não pode ser cancelado por aqui."
   - Terminais (`entregue`/`cancelado`) não aparecem em Pedidos; não precisa de mensagem.
   - Em `mode === 'historico'`: **nenhum** botão/mensagem de cancelamento (mantém o rodapé atual de data/valor).

4. Preservar o que já existe: badge de tipo, status label type-aware, endereço resumido, rodapé de data/valor no
   histórico. NÃO duplicar dinheiro (`formatPrice`).

## Testes — CRIAR/ATUALIZAR `src/components/minha-conta/__tests__/OrderCard.test.tsx`
Mockar `@/contexts/orders-context` e `@/contexts/market-context` (ou envolver nos providers reais) e `sonner`, com
**`vi.mocked`** (sem `any`). Cobrir:
- Expande ao clicar no chevron: mostra linhas de item (nome, qtd, subtotal), total, endereço completo, data;
  colapsa de volta.
- `mode="pedidos"` + status `aguardando` (compra-direta): botão "Cancelar pedido" presente; abrir confirmação e
  confirmar chama `cancelOrder(order.id)` **uma vez**; toast disparado.
- Pedido `sup-001` + cancelar → `cancelDirectOrder(order.id)` chamado; pedido de outro fornecedor → `cancelDirectOrder`
  **não** chamado.
- `mode="pedidos"` + status `confirmado`: **sem** botão de cancelar; mostra a mensagem de restrição.
- `mode="pedidos"` + status `a-caminho`: sem botão; mensagem "a caminho".
- `mode="historico"`: sem botão/mensagem de cancelamento (só o conteúdo do histórico).
Use `Order` de teste com `items` (2 linhas) para exercitar o acordeão.

## Restrições (governança)
- "NOT the Next.js you know" — não deve ser relevante (componente), mas cheque docs se precisar.
- UI: invoque `Skill(ui-system)` se existir. Reuse o visual do projeto (tokens `brand-*`, `rounded-card`, ícones
  lucide) e o `Dialog` de `components/ui`.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked`.
- NÃO alterar `PedidosTab`/`HistoricoTab` (as assinaturas), contexts, `src/lib`, checkout, catálogo. **Só
  `OrderCard.tsx` + o teste.**
- NÃO commitar.

## Critério de pronto (DoD) — provar com execução (front/ do worktree)
1. `npm test` → todos verdes (235 anteriores + os novos). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda; confirmação: "sem any", "acordeao com itens/total/endereco/data", "cancelar so em aguardando
(pedidos) com confirmacao + sinalizacao sup-001", "historico e demais status intactos".
