# Spec — Compra direta no catalogo (loja multi-vendedor, Modelo A)

**Dominio:** catalogo + comprador + fornecedor | **Feature relacionada:** 014 | **Status:** rascunho (aguardando aprovacao do cliente)

## Contexto

D-009 decidida: Modelo A — cada produto do catalogo pertence a um fornecedor especifico com
preco proprio. Esta spec define o primeiro caminho de compra ATIVO da Fase 1 (a loja), ainda
sobre dados mock (backend chega na 006; pagamento na 011). O CTA "Pedir oferta" (leilao)
permanece visivel porem inativo (feature 013).

## Regras de negocio

- **RN-01** Todo `Product` tem fornecedor obrigatorio: `supplierId: string` + `supplierName: string` (+ `supplierRating?: number` para exibicao). Mock de fornecedores da loja em `front/src/lib/suppliers.ts` (novo), com 3-5 fornecedores derivados dos ja existentes nos mocks.
- **RN-02** Precos padronizados em **CENTAVOS** em todo o sistema. `products.ts` migra de reais para `priceInCents`; `formatPrice(cents)` vira utilitario unico em `front/src/lib/utils.ts` e TODAS as duplicatas locais sao removidas (OfertasTab, OrderCard, supplier-mock reexporta ou consumidores migram o import).
- **RN-03** O ProductCard exibe o fornecedor (nome + rating) e ganha CTA primario **"Comprar"** (ativo). "Pedir oferta" permanece como CTA secundario inativo ("Em breve", conforme feature 013).
- **RN-04** Fluxo de compra (mock): clicar "Comprar" → exige login (mesma guarda atual: sem login, redirect `/login?redirect=/catalogo`) → modal de confirmacao com: produto + fornecedor, seletor de quantidade (min 1, inteiro), endereco de entrega (mesmo padrao do NovoPedidoModal: endereco do cadastro OU outro endereco com validacao completa — cidade/UF obrigatorios; NAO repetir o bug do cast `as Address`), total calculado (quantidade x priceInCents).
- **RN-05** Confirmar cria `Order` tipo `compra-direta`, status `confirmado`... nao: status inicial `aguardando` (fornecedor confirma no painel), com `price` = total em centavos e fornecedor vinculado. O pedido aparece: (a) em /minha-conta > Pedidos (comprador); (b) em /fornecedor/painel > Pedidos Diretos DO FORNECEDOR DONO do produto (mock: como o painel simula um unico fornecedor logado — MOCK_SUPPLIER — o pedido so aparece la se o produto for dele).
- **RN-06** O contrato `Order` ganha vinculo com o fornecedor (`supplierId`/`supplierName`) — corrige na Fase 1 a lacuna estrutural apontada no review (aceite sem fornecedor) para pedidos diretos; o fluxo de aceite de oferta em si continua na Fase 2.
- **RN-07** Sem pagamento nesta feature (011), sem estoque, sem frete calculado ("frete a combinar com o fornecedor" no modal).

## Fluxos e estados

1. Comprador (logado) ve card com fornecedor e preco → "Comprar" → modal → quantidade + endereco → confirma → toast de sucesso → pedido `aguardando` em minha-conta.
2. Fornecedor dono ve o pedido em Pedidos Diretos → confirma/recusa (fluxo existente) → status muda para o comprador (mock compartilhado via contexto ou estado local — definir na implementacao a forma mais simples SEM criar estado global novo se possivel).
3. Comprador sem login → "Comprar" redireciona para login preservando rota.

## Criterios de aceite

- [ ] Todos os produtos do catalogo exibem fornecedor (nome + rating)
- [ ] Precos exibidos corretamente em centavos formatados (R$ XX,XX) com `formatPrice` unico em `lib/utils.ts`; zero duplicatas locais de formatPrice
- [ ] "Comprar" logado abre modal; quantidade invalida (0, negativa, fracionada) bloqueia confirmacao
- [ ] "Outro endereco" so confirma com logradouro, numero, CEP, cidade e UF validos
- [ ] Pedido criado aparece em minha-conta (aguardando) e no painel do fornecedor dono
- [ ] "Pedir oferta" continua visivel e inativo (nao regride a 013)
- [ ] `npm run lint` e `npm run build` passam

## Fora de escopo

- Pagamento (011), estoque, frete real, carrinho multi-item (compra e 1 produto por vez no MVP), backend real (006).

## Referencias

- Decisoes: D-007, D-009 (`.claude/docs/decisoes.md`)
- Review 2026-07-02: bugs de endereco (NovoPedidoModal) e formatPrice triplicado — esta spec corrige o padrao para o fluxo novo
- Codigo: `front/src/lib/products.ts`, `front/src/lib/account-mock.ts`, `front/src/components/catalogo/ProductCard.tsx`, `front/src/components/minha-conta/NovoPedidoModal.tsx` (padrao de endereco)
