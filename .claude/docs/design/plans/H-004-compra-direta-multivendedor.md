# H-004 — Compra direta no catalogo, loja multi-vendedor (feature 014)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** redigido — executar SOMENTE apos H-005 aprovado (ordem D-011: H-002 → H-005 → H-004)
**Spec:** `.claude/docs/design/specs/spec-catalogo-compra-direta.md` (APROVADA 2026-07-02, com nota de implementacao) — LEIA A SPEC INTEIRA ANTES DE COMECAR. Em conflito entre prompt e spec, a spec vence; pare e relate.

## Objetivo

Implementar o primeiro caminho de compra ATIVO da loja (Fase 1, D-007/D-009 Modelo A): todo
produto pertence a um fornecedor, precos padronizados em centavos, CTA "Comprar" com modal de
confirmacao que cria pedido compra-direta visivel para comprador e fornecedor (mock).

## Contexto minimo

- App Next.js 16 App Router + React 19 + TypeScript + Tailwind em `front/` (comandos dentro de `front/`).
- AGENTS.md exige: leia `node_modules/next/dist/docs/` antes de codar e invoque os skills de dominio (`domain-catalogo`, `domain-comprador`, `domain-fornecedor`, `ui-system`; `risk-zone-protocol` para `src/lib/`).
- Pre-requisitos: H-002 (flag `LEILAO_ATIVO`; "Pedir oferta" inativo) e H-005 (sessao real via `useAuth()` do Firebase; `auth-mock.ts` JA foi deletado) aplicados.
- O gating do leilao NAO pode regredir.

## Tarefas (nesta ordem)

1. **Fornecedores da loja** — criar `front/src/lib/suppliers.ts`: tipo `StoreSupplier { id, name, rating }` e mock com 4 fornecedores coerentes com os ja citados no projeto (ex.: Distribuidora Sul, Baby Stock SP, Nacional Higiene, Nordeste Baby). O primeiro (`sup-001`, Distribuidora Sul) deve corresponder ao `MOCK_SUPPLIER` de supplier-mock.ts (mesmo nome) — e o "fornecedor logado" do painel.
2. **Produtos** — em `front/src/lib/products.ts`: `Product` ganha `supplierId: string`; preco migra de `price` (reais) para `priceInCents: number` (multiplicar os valores atuais por 100). Distribua os 24 produtos entre os 4 fornecedores, garantindo que `sup-001` tenha 6+ produtos.
3. **formatPrice unico** — mover `formatPrice(cents)` para `front/src/lib/utils.ts`; atualizar TODOS os consumidores para importar de `@/lib/utils`; deletar as duplicatas locais em `OfertasTab.tsx` e `OrderCard.tsx` e a definicao em `supplier-mock.ts` (mantendo `formatDate`, `timeAgo`, `maskCnpj` onde estao).
4. **ProductCard** — exibir nome + rating (estrelas) do fornecedor; preco via `formatPrice(priceInCents)`; CTA primario "Comprar" (ativo); "Pedir oferta" vira CTA secundario e permanece inativo ("Em breve", como o H-002 deixou).
5. **Contexto de pedidos** — criar `front/src/contexts/orders-context.tsx` (`OrdersProvider` + `useOrders`), padrao identico ao `market-context.tsx`: seed `INITIAL_ORDERS`, expoe `orders`, `createDirectOrder(...)`, `handleAceitarOferta`, `handleNovoPedido`. Registrar o provider no layout `front/src/app/(main)/layout.tsx` (junto ao MarketProvider existente). Migrar `front/src/app/(main)/minha-conta/page.tsx` do `useState` local para `useOrders()` sem mudanca visual.
6. **Tipos de pedido** — em `front/src/lib/account-mock.ts`: `Order` ganha `supplierId?: string` e `supplierName?: string` (preenchidos em compra-direta e em oferta aceita futura).
7. **Modal de compra** — criar `front/src/components/catalogo/BuyModal.tsx` (usar `Dialog` de ui/): produto + fornecedor, quantidade (inteiro, min 1 — bloquear 0/negativo/fracionado/NaN), endereco no MESMO padrao do NovoPedidoModal (endereco do cadastro OU outro endereco) POREM com validacao completa: com "outro endereco", so habilitar confirmacao com logradouro, numero, CEP, cidade e UF preenchidos (NAO usar cast `as Address` sem validacao — bug conhecido). Exibir total = quantidade x priceInCents via formatPrice e a frase "Frete a combinar com o fornecedor". Confirmar → `createDirectOrder` (tipo compra-direta, status 'aguardando', price = total, supplierId/Name do produto) → toast de sucesso.
8. **Guarda de login** — "Comprar" sem login redireciona `/login?redirect=/catalogo` usando `useAuth()` do Firebase (a H-005 ja removeu o `auth-mock`; NUNCA recriar flag local nem reimportar auth-mock).
9. **Painel do fornecedor** — pedidos compra-direta criados para produtos de `sup-001` devem aparecer em Pedidos Diretos. Como `PedidosDiretosTab` le do `market-context` (`directOrders`), faca o `createDirectOrder` do orders-context tambem inserir o pedido correspondente no market-context OU exponha um callback de integracao simples — escolha a menor ponte possivel SEM duplicar fonte de verdade visual; se as duas estruturas `DirectOrder` vs `Order` divergirem demais, implemente um adaptador puro em `front/src/lib/order-adapters.ts` e documente no relatorio.
10. **Commit unico** (pt-BR): `feat(catalogo): compra direta multi-vendedor com fornecedor por produto e precos em centavos (feature 014)`

**Arquivos autorizados a mudar:** os listados acima + imports diretamente afetados pela mudanca de `Product.price`→`priceInCents` e pela centralizacao do formatPrice (liste todos no relatorio). Nada alem disso.

## Testes e verificacao (OBRIGATORIO — D-008)

Dentro de `front/`:

1. `npm run lint` — zero erros.
2. `npm run build` — sem erros (a migracao priceInCents quebra consumidores esquecidos — o build e o detector).
3. Grep: nenhuma ocorrencia restante de `product.price` (fora `priceInCents`), nenhuma definicao local de `formatPrice` fora de `lib/utils.ts`.
4. Teste manual (`npm run dev`): catalogo mostra fornecedor + preco correto (ex.: p1 = R$ 18,00); "Comprar" deslogado → redirect login; com IS_LOGGED_IN=true temporario: modal abre, quantidade invalida bloqueia, outro endereco incompleto bloqueia, confirmar cria pedido; /minha-conta lista o novo pedido 'aguardando'; /fornecedor/painel > Pedidos Diretos mostra o pedido se o produto for do sup-001; "Pedir oferta" segue inativo. Reverter IS_LOGGED_IN=false antes do commit.
5. Regressao do gating: /mercado segue "Em breve"; nenhum CTA de leilao ativo.

**Loop de encerramento:** falhou → corrigir e re-verificar, MAXIMO 3 TENTATIVAS. Apos a 3a falha:
PARE, nao improvise, relate o que falhou, o que tentou em cada tentativa e o estado dos arquivos.

## Criterios de aceite

Checklist "Criterios de aceite" da spec — todos devem passar.

## Restricoes

- Sem decisoes de arquitetura alem das ja tomadas na spec/nota de implementacao; duvida = parar e relatar.
- Nao tocar em: fluxos de leilao (alem do CTA secundario), `legacy/`, `back/`, `app/`, docs de governanca.
- Commits em pt-BR, Conventional Commits, sem --no-verify.

## Relatorio esperado

Arquivos alterados (lista completa), decisao tomada no item 9 (ponte orders↔market) com justificativa,
resultado de cada verificacao com evidencia, hash do commit, pendencias.
