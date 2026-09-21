# S5 — Checkout + finalizar (quebrado em S5a → S5b)

**Thread:** S · **Depende de:** S1 ✅ (`useCart`), S3 ✅ (`/sacola`), T1 ✅ (`buildOrdersFromCart`), T2 ✅ (mocks Payment/Fulfillment).
**Decisões:** D-016 (carrinho canônico), D-017 (1 pedido por fornecedor), D-018 (`OrderItem`), D-019 (pix/card),
D-022 (comprador 100% compra-direta). Execução **uma de cada vez** (S5b depende do state machine do S5a — sem paralelo).

## Por que dividir
O S5 junta duas responsabilidades distintas e verificáveis em separado:
1. **Fluxo/telas** (endereço → revisão → pagamento STUB → confirmação) — só UI + estado local.
2. **Efeito de negócio** (criar 1 pedido por fornecedor, limpar sacola, flip do fluxo) — integra domínio + contexts.
Dividir mantém cada peça pequena, com prova executável própria, e evita um subagente gigante.

---

## S5a — Máquina de checkout (telas + estado)  [dep: S1, S3]
Rota nova `/checkout` sob `(main)`. Componente client com **máquina de 4 passos**:
`endereco` → `revisao` → `pagamento` → `confirmacao`, dirigida por estado local (nada de pedido ainda).

- **Guarda de carrinho vazio:** se `useCart().items` estiver vazio, mostrar estado vazio com link para `/catalogo`
  (não renderizar os passos).
- **Passo `endereco`:** reusar o padrão do BuyModal — rádio "endereço do cadastro" (`profile?.address || MOCK_USER.address`)
  vs "outro endereço" (form com os campos de `Address`). Validação igual à do BuyModal (logradouro/numero/cep/cidade/estado
  obrigatórios). "Continuar" só habilita com endereço válido.
- **Passo `revisao`:** itens **agrupados por fornecedor** (`bySupplier`), subtotal por fornecedor (`cartSubtotal`),
  total (`subtotal`), e o endereço escolhido. Botões "Voltar" / "Continuar".
- **Passo `pagamento` (STUB):** seleção de `PaymentMethod` (`'pix' | 'card'` de `@/lib/ports/payment`). **Nenhum**
  adapter/charge aqui (isso é S5b). Botão "Pagar" (STUB) → avança para `confirmacao`. "Voltar" volta à revisão.
- **Passo `confirmacao` (placeholder):** tela de sucesso **estática** ("Pedido recebido" + link "Ver meus pedidos"
  → `/minha-conta`). **NÃO** cria pedido, **NÃO** limpa a sacola ainda (isso é o S5b). Deixar comentário `// S5b:` nos
  dois pontos de gancho.
- **Ligar a `/sacola`:** a CTA "Finalizar compra" (hoje desabilitada com selo "Em breve") passa a **habilitada** e
  navega para `/checkout` (Link ou `router.push`). Remover o selo "Em breve" dessa CTA. Não tocar na CTA "Buscar
  ofertas personalizadas" (segue gateada por LEILAO_ATIVO).
- **Coerência entre S5a e S5b:** até o S5b, finalizar deixa a sacola intacta (a confirmação é placeholder). Aceitável
  e documentado (mesma lógica de "coerência entre etapas" das tarefas S).
- **Escopo de arquivos:** CRIAR `src/app/(main)/checkout/page.tsx` (+ componentes auxiliares se necessário sob
  `src/components/checkout/`); MODIFICAR só a CTA "Finalizar compra" em `src/app/(main)/sacola/page.tsx`.
  NÃO tocar em cart-context, orders-context, ProductCard, BuyModal, src/lib.
- **DoD:** teste RTL do fluxo (render dos 4 passos, guarda de carrinho vazio, validação de endereço bloqueia
  "Continuar", navegação entre passos); `npm test` verde; `lint` exit 0 (sem `any`/disable novo); `tsc` sem erro;
  `build` ok. Sacola: "Finalizar compra" habilitada leva a `/checkout`.

## S5b — Efeito de negócio (pedidos + flip)  [dep: S5a, T1, T2]
- **Bridge no OrdersContext:** novo método que recebe `CartItem[]` + `Address`, chama `buildOrdersFromCart`
  (idFactory/now injetados), mapeia cada `DomainOrder` → `Order` (account-mock) com `items[]` (D-018) e status
  inicial `aguardando`/`type: 'compra-direta'`, e faz append. Retorna os pedidos criados (para a tela mostrar os IDs).
- **Adapters STUB no confirmar:** ao confirmar pagamento, para cada pedido chamar `MockPaymentGateway.charge` e
  `MockFulfillmentService.schedule` (outcome default approved/scheduled) — respeitando os contract tests do T2.
- **Confirmação real:** cria os pedidos (1 por fornecedor, D-017), **limpa a sacola** (`clear()`), e a tela mostra os
  pedidos criados (por fornecedor). Toast/copy vira "Pedido confirmado" **só aqui**.
- **Flip do fluxo:** "Comprar agora" (ProductCard/BuyModal) deixa de criar pedido instantâneo. Redefinir para o caminho
  do carrinho/checkout (ex.: `addItem` + `router.push('/checkout')`) e aposentar a wiring do BuyModal `onConfirm →
  createDirectOrder` na página do catálogo. Pedido passa a nascer **só** na confirmação do checkout — corrige o toast
  enganoso reportado pelo usuário.
- **Dívida técnica a resolver aqui:** seed `items[].unitPrice` em account-mock/orders-context hoje = total; passar a
  gravar **preço unitário** ao criar pedidos pelo carrinho (o carrinho já tem `unitPrice` correto por linha).
- **DoD:** confirmar cria N pedidos (N = nº de fornecedores), sacola esvazia, pedidos aparecem em Pedidos; testes do
  bridge + do confirmar; contract tests seguem verdes; `test`/`lint`/`tsc`/`build` verdes.

---

## Revisão (coordenador, D-012) — para cada subtask
Ler os arquivos + rodar `test`/`lint`/`tsc`/`build` no `front/` do worktree, verificando **exit numérico no Bash**
(`; echo $?`, sem pipe; PowerShell `$?` é booleano e não prova). Zero `any`/`eslint-disable` novo (mocks com
`vi.mocked`). Loop de no máx. 3 tentativas por subtask, depois PARAR (D-008). Commit em pt-BR só após verde.
