# Spec — Catálogo do Fornecedor: Cadastro de Produtos + Sync do Painel (feature 007)

**Domínio:** fornecedor (com impacto em catalogo) · **Feature relacionada:** 007 (depende de 006,
fatias 1-Pedidos e 2-Produtos já em produção) · **Status:** APROVADA (2026-07-25) — aguardando plano
de implementação

## Contexto

O backend de Produtos (fatia 2, thread P) criou uma tabela `products` no D1, mas **deliberadamente
mínima**: só `id`, `price_cents`, `supplier_id` — o suficiente para `POST /orders` revalidar preço e
existência (RN-P2/P2b/P2c). A spec daquela fatia registrou explicitamente que "cadastro/edição/remoção
de produtos, perfil, histórico de vendas... é a feature 007, fora de escopo aqui".

O Perfil do Fornecedor (CNPJ, razão social, endereço) já foi implementado e documentado separadamente
(commits `cd5a67f`+`dc2f696`+`8804685`, `PerfilTab.tsx`) — **mas sem consumidor**: não filtra
`directOrders`/`offers` no painel, não aparece no catálogo do comprador. A nota crítica de escopo
daquela entrega é explícita: *"amarração uid↔supplierId fica reservada para feature 007 por decisão
consciente"*.

Hoje, verificado no código real:

- **`products` (D1)** só tem `id`/`price_cents`/`supplier_id` — sem nome, marca, tamanho, descrição,
  atributos, quantidade ou slug. Não há `POST`/`PUT`/`DELETE` em `back/src/routes/products.ts` — só
  `GET /products`, público.
- **`front/src/lib/products.ts`** é um array estático (`PRODUCTS: Product[]`, 24 itens) — `/catalogo`
  lê direto dele via `filterProducts`/`getProductBySlug`. Não existe `ProductRepository` (porta/adapter)
  como existe para `Order` — é a única entidade "de dados" do app ainda sem essa camada.
- **`UserProfile` (Firestore, `users/{uid}`)** não tem campo `supplierId`. O `role: 'fornecedor'`
  existe e é imutável (D-013), mas nada liga esse `uid` a um `supplierId` usado em `products`/`orders`.
  `supplierId` hoje é só uma string fixa (`sup-001`..`sup-004`) dentro de dados mock/seed — sem
  nenhuma conta Firebase real por trás.
- **`MarketProvider` (`front/src/contexts/market-context.tsx`)** usa arrays mock globais
  (`MOCK_DIRECT_ORDERS`, `MOCK_MARKET_ORDERS`, `MOCK_OFFERS`) sem nenhum filtro por fornecedor — **todo
  fornecedor logado vê a mesma lista**, independente de quem é.
- O painel do fornecedor (`fornecedor/painel/page.tsx`) já tem a aba Perfil funcionando; as abas
  Pedidos Diretos/Ofertas de Mercado/Logística consomem esses arrays globais sem filtro.

**Conclusão de maturidade:** o "buraco" real não é só "cadastrar produto" — é que **nenhuma
identidade de fornecedor real existe no sistema ainda**. Sem resolver `uid↔supplierId` primeiro,
qualquer CRUD de produto ficaria "de quem?" sem resposta, e o sync do painel (pedidos reais filtrados)
continuaria impossível.

## Decisões de escopo (APROVADAS pelo cliente, 2026-07-25)

Diferente das specs anteriores (fatia 1/2), esta não passou por um brainstorming dedicado — as
decisões abaixo foram propostas nesta sessão e confirmadas pelo cliente em bloco. Todas as 6 valem
para o plano de implementação:

1. **`supplierId` = `uid` do Firebase, sem gerar um ID novo.** O jeito mais simples de resolver a
   amarração: quando um usuário com `role: 'fornecedor'` cria seu primeiro produto (ou faz onboarding),
   `supplierId` **é** o próprio `uid` do token verificado pelo Worker — não um ID separado a manter em
   sincronia. Elimina uma tabela/mapa extra. Os `sup-001`..`sup-004` do seed atual **não são
   migrados** — continuam existindo como produtos "órfãos" de demonstração (sem conta Firebase real
   por trás), até serem removidos manualmente ou aposentados numa limpeza futura (fora de escopo aqui).
2. **`/catalogo` (front) PASSA a migrar para o backend real nesta fatia** — ao contrário da fatia 2,
   que resolveu conscientemente NÃO migrar. Motivo: sem isso, um fornecedor cadastrando um produto novo
   nunca apareceria pra nenhum comprador — o CRUD ficaria sem efeito visível, o que não atende o
   critério de aceite da 007 ("fornecedor consegue adicionar... produtos do próprio catálogo").
   `ProductRepository` (porta + `HttpProductRepository` + `MockProductRepository`) segue o mesmo padrão
   já provado em `OrderRepository` (B5-B8).
3. **`Product` entra em `packages/contracts`** (deixado de fora na fatia 2 por YAGNI — agora tem
   consumidor de verdade nos dois lados, front e back).
4. **Produto tem DOIS estados de remoção: despublicar (reversível) e deletar (definitivo).**
   Despublicar é o caminho padrão — barato de implementar (só um campo `active`) e evita perda de dado
   por engano (preço/descrição/histórico de edição preservados, fornecedor pode reativar). Deletar
   (físico) continua existindo para quando o fornecedor realmente quer remover de vez. Seguro nos dois
   casos porque `order_items` já denormaliza `productName`/`unitPrice` no momento da compra (confirmado
   no schema) — pedidos antigos não dependem da linha em `products` continuar existindo ou ativa.
5. **Estoque (`quantity`) é um campo editável pelo fornecedor, não um contador transacional.** Decremento
   automático no checkout, concorrência, "esgotado" — fica para a fatia de Estoque, já registrada
   separadamente no backlog (D-026/progresso.md). Aqui, `quantity` é só um dado que o fornecedor digita
   e edita, do jeito que já existe hoje no mock.
6. **Histórico de vendas reusa `GET /orders` já existente, com escopo por fornecedor** — não é uma
   tabela/endpoint novo. Uma nova rota `GET /orders?scope=fornecedor` (ou `GET /supplier/orders`)
   filtra por `order_items.productId IN (SELECT id FROM products WHERE supplier_id = :uid)` — o
   "histórico" no painel é a mesma lista com filtro de status (`entregue`/`confirmado` vs. em
   andamento), não uma feature de dados separada.

## Arquitetura

```
back/                                         front/
  src/schema/products.ts (Drizzle, ESTENDIDO)   src/lib/ports/product-repository.ts (NOVO,
    id, price_cents, supplier_id (existentes)     mesmo molde de order-repository.ts)
    + name, brand, size, quantity, slug,        src/lib/adapters/http-product-repository.ts (NOVO)
      categoria, descricao, atributos (JSON),   src/lib/adapters/mock-product-repository.ts (NOVO)
      badge (nullable), active (NOVO, bool)     src/app/(main)/catalogo/* migra de
  migrations/0003_products_full.sql               PRODUCTS (array estatico) para o repository
    (gerada por drizzle-kit generate,           src/components/fornecedor/CatalogoTab.tsx (NOVO)
     ALTER TABLE adiciona as colunas novas)        formulario de criar/editar/remover produto;
  src/routes/products.ts (ESTENDIDO)               toggle "Despublicar/Republicar" + acao "Excluir"
    GET /products (existente, publico,          src/components/fornecedor/PedidosDiretosTab.tsx
      so active=true)                             OfertasMercadoTab.tsx (MODIFICADOS: consomem
    GET /products?scope=fornecedor (NOVO,          lista filtrada por supplierId, nao mais o
      auth, retorna TODOS os proprios,             array global MOCK_*)
      ativos e despublicados)                   src/contexts/market-context.tsx (MODIFICADO:
    POST /products (NOVO, auth obrigatoria,        busca via API real, nao MOCK_DIRECT_ORDERS/
      supplierId = uid do token, nunca do body,    MOCK_MARKET_ORDERS/MOCK_OFFERS)
      active=true por padrao)
    PUT /products/:id (NOVO, auth + dono,
      inclui alternar `active`)
    DELETE /products/:id (NOVO, auth + dono,
      remocao FISICA e definitiva)
  src/routes/orders.ts (MODIFICADO)
    GET /orders?scope=fornecedor (NOVO,
      filtra por supplier_id = uid do token,
      usado pro "sync do painel" + historico)

packages/contracts/src/product.ts (NOVO)
  ProductSchema, CreateProductRequestSchema, UpdateProductRequestSchema
  (mesmo padrao de order.ts: server define id/supplierId, nunca confia no client)
```

- **Autorização por dono, não por papel genérico** — mesmo padrão de `OrderForbiddenError` em
  `orders.ts`: `PUT`/`DELETE /products/:id` primeiro busca o produto, compara `product.supplier_id`
  com o `uid` do token; diverge → **403** (nunca 404, para não vazar "existe mas não é seu" via
  enumeração de erro — mesma disciplina já usada em `orders.ts`).
- **`supplierId` nunca vem do body em `POST /products`** — o servidor usa `c.get('uid')` do middleware
  de auth, igual já acontece (implicitamente) hoje em `orders.ts` via RN-03. Cliente que mandar
  `supplierId` no body tem o campo ignorado (mesmo padrão Zod não-strict já documentado em
  `CreateOrderRequestSchema`).
- **Migração de `/catalogo` é o item de maior risco desta fatia** — hoje é só leitura síncrona de um
  array; vira `await` num repository. Precisa de loading/skeleton (mesmo padrão já resolvido em
  `OrdersProvider`/B8), e o `getProductBySlug` (usado por `/produto/[slug]`) também migra.

## Regras de negócio

- **RN-007-01** — `POST /products`: exige auth (`role: 'fornecedor'` verificado — igual já acontece em
  toda a área do painel via guarda client-side; o servidor **também** valida, não confia só no front).
  `supplierId` = `uid` do token, sempre, nunca do body.
- **RN-007-02** — `PUT /products/:id` e `DELETE /products/:id`: exige que `product.supplier_id === uid`
  do token. Divergência → **403** `produto nao pertence a este fornecedor`. Produto inexistente →
  **404**.
- **RN-007-03** — Preço em centavos (`priceCents`), mesmo padrão de `orders`/`order_items` (D-009).
- **RN-007-04** — `GET /products` (público, catálogo do comprador) retorna só `active = true` —
  produtos despublicados não aparecem, mas continuam existindo. `GET /products?scope=fornecedor`
  (autenticado) retorna **todos** os produtos do próprio fornecedor, ativos e despublicados, pra ele
  poder gerenciar/reativar.
- **RN-007-05** — `GET /orders?scope=fornecedor`: exige auth; retorna só pedidos cujos `order_items`
  referenciam produtos com `supplier_id === uid` do token. Sem esse parâmetro, `GET /orders` continua
  se comportando como hoje (pedidos do **comprador** autenticado — RN-02 da fatia 1, inalterada).
- **RN-007-06** — Despublicar (`active: false` via `PUT`) e deletar (`DELETE`) NÃO afetam pedidos já
  existentes — `order_items` já denormaliza `productName`/`unitPrice` no momento da compra (confirmado:
  `back/src/schema/orders.ts`), então o histórico de vendas continua íntegro nos dois casos.
- **RN-007-07** — Migração de `/catalogo`: se o `ProductRepository` (HTTP) falhar (erro de rede, 5xx),
  a página mostra estado de erro explícito — **nunca** cai silenciosamente de volta pro array estático
  antigo (mesmo veto de "catch-all silencioso" já registrado na memória do projeto).
- **RN-007-08** — Produto novo nasce com `active: true` por padrão (`POST /products` não aceita
  `active` no body — mesma disciplina de `supplierId`: campo definido pelo servidor na criação, só
  editável depois via `PUT`).

## Modelo de dados (D1)

```sql
-- migrations/0003_products_full.sql (gerada por `drizzle-kit generate`)
ALTER TABLE products ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN size TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN slug TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN categoria TEXT NOT NULL DEFAULT 'fraldas-descartaveis';
ALTER TABLE products ADD COLUMN descricao TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN atributos TEXT NOT NULL DEFAULT '{}'; -- JSON serializado
ALTER TABLE products ADD COLUMN badge TEXT; -- nullable
ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1; -- boolean (0/1), despublicar
```
```sql
-- migrations/0004_backfill_products_seed.sql
-- UPDATE dos 24 produtos existentes com os campos reais de front/src/lib/products.ts
-- (mesma fonte da fatia 2, agora preenchendo as colunas novas em vez de só id/price/supplier)
```

`atributos` fica como JSON serializado em `TEXT` (D1/SQLite não tem tipo JSON nativo) — Drizzle
serializa/desserializa via `mode: 'json'` no schema, mesmo padrão comum em projetos Drizzle+SQLite.

## Endpoints

| Método | Rota | Auth | Resp OK | Erros |
|---|---|---|---|---|
| GET | `/products` | Não | `200 Product[]` (só `active=true`) | — |
| GET | `/products?scope=fornecedor` | Sim | `200 Product[]` (todos do próprio fornecedor, ativos e não) | `401` |
| POST | `/products` | Sim | `201 Product` (`active: true`) | `401`, `400` (Zod) |
| PUT | `/products/:id` | Sim (dono) | `200 Product` (inclui alternar `active`) | `401`, `403` (não é dono), `404`, `400` (Zod) |
| DELETE | `/products/:id` | Sim (dono) | `204` (remoção física e definitiva) | `401`, `403` (não é dono), `404` |
| GET | `/orders?scope=fornecedor` | Sim | `200 Order[]` (filtrado por supplierId) | `401` |

## Fluxos e estados

- **Fornecedor cadastra produto novo:** painel → aba "Catálogo" (nova) → formulário → `POST /products`
  → produto aparece imediatamente em `/catalogo` (comprador) e na lista do próprio painel.
- **Fornecedor edita produto:** mesma aba, form pré-preenchido → `PUT /products/:id` → catálogo
  reflete a mudança (preço, descrição, etc.) na próxima carga (sem necessidade de invalidação
  em tempo real nesta fatia).
- **Fornecedor despublica produto:** toggle "Despublicar" na lista/form → `PUT /products/:id`
  (`active: false`) → some do `/catalogo` público, mas continua listado (marcado como "despublicado")
  na própria aba Catálogo do fornecedor, com opção de "Republicar" (`active: true` de volta).
- **Fornecedor remove produto definitivamente:** confirmação (Dialog, mesmo padrão de cancelamento de
  pedido em D-025, texto deixando claro que é irreversível) → `DELETE /products/:id` → some de vez;
  pedidos antigos que o referenciam continuam íntegros (RN-007-06).
- **Painel carrega pedidos reais:** `MarketProvider` passa a buscar via `GET /orders?scope=fornecedor`
  em vez dos arrays mock — loading/erro explícitos (RN-007-07), mesmo padrão do `OrdersProvider`.

## Testes

- `back/test/products.crud.test.ts` (novo): `POST` cria com `supplierId` = uid do token (ignora
  `supplierId` do body se enviado) e `active: true` por padrão (ignora `active` do body na criação —
  RN-007-08); `PUT`/`DELETE` por não-dono → 403; por dono → 200/204; recurso inexistente → 404; sem
  token → 401 nos três. `PUT` com `active: false` → produto some de `GET /products` mas aparece em
  `GET /products?scope=fornecedor`; `PUT` com `active: true` de volta → reaparece no público.
- `back/test/orders.scope-fornecedor.test.ts` (novo): `GET /orders?scope=fornecedor` retorna só
  pedidos cujo produto pertence ao uid autenticado; sem o parâmetro, comportamento de comprador
  inalterado (regressão).
- `front/src/lib/adapters/__tests__/{http,mock}-product-repository.test.ts` (novo, espelha os
  equivalentes de `order-repository`).
- `front/src/lib/ports/__tests__/product-repository.contract.ts` (novo, mesmo padrão de contract test
  de `order-repository.contract.ts`).
- `front/src/app/(main)/catalogo/__tests__/*` (existentes, adaptar): migrar de mock direto do array
  para `MockProductRepository` injetado — cobertura de loading/erro nova.
- Suíte completa de `back/`/`front/`/`packages/contracts` verde, `tsc`/lint limpos nos três.

## Critérios de aceite

- [ ] Fornecedor autenticado consegue **adicionar, editar e remover** produtos do próprio catálogo
      (painel → aba Catálogo nova) — critério literal da feature 007.
- [ ] Fornecedor consegue **despublicar e republicar** um produto sem perdê-lo (fica invisível no
      catálogo público, mas continua editável/reativável no próprio painel).
- [ ] Produto criado/editado/removido/despublicado por um fornecedor reflete em `/catalogo` (comprador)
      sem intervenção manual.
- [ ] `supplierId` nunca é aceito do body em `POST /products` — sempre o uid do token.
- [ ] `PUT`/`DELETE` de produto de outro fornecedor → 403, nunca 200.
- [ ] Painel do fornecedor mostra **só** os próprios pedidos diretos/ofertas (`GET
      /orders?scope=fornecedor`), não mais o array global mock.
- [ ] Histórico de vendas (pedidos `entregue`/`confirmado` do próprio fornecedor) visível no painel.
- [ ] `back/` e `front/` e `packages/contracts`: suíte 100% verde, `tsc`/lint exit 0.
- [ ] `sup-001`..`sup-004` (seed antigo) permanecem no catálogo como produtos de demonstração — não
      quebram nem exigem login para aparecer no `/catalogo` público.
- [ ] Validação humana: criar conta fornecedor real (login Google), cadastrar produto, ver aparecer
      no catálogo (outra sessão/aba, como comprador), editar, remover, confirmar sumiço.

## Fora de escopo (registrado, não é esquecimento)

- **Estoque transacional** (decremento no checkout, controle de concorrência, "esgotado") — fatia
  futura separada, já registrada no backlog. `quantity` aqui é só campo editável, não contador
  automático.
- **Migração/aposentadoria dos produtos órfãos `sup-001`..`sup-004`** — ficam como estão, sem conta
  Firebase real por trás; decisão de limpeza fica para outra sessão.
- **Notificação ao fornecedor de novo pedido, ao comprador de mudança de preço/remoção** — feature 010
  (Notificações), não esta.
- **Upload de imagem de produto** — catálogo hoje não tem campo de imagem em lugar nenhum (front nem
  mock); fora de escopo até existir esse requisito.
- **Edição de perfil do fornecedor** — já feito, feature separada (Perfil do Fornecedor, `PerfilTab.tsx`).

## Riscos

| Risco | Mitigação |
|---|---|
| Migração de `/catalogo` (leitura síncrona → async) introduzir regressão de UX (flash de loading, SEO de página estática perdido) | Mesmo padrão já resolvido em B8 (`OrdersProvider`) — skeleton explícito; revisão humana no navegador antes de aprovar. |
| Fornecedor cadastra produto com dados incompletos/inválidos (preço negativo, nome vazio) | Validação Zod no `CreateProductRequestSchema` (compartilhado), servidor rejeita 400 — mesma disciplina de `CreateOrderRequestSchema`. |
| `atributos` como JSON solto no D1 permitir dado malformado sem detectar | Zod valida o objeto completo antes de serializar — nunca grava JSON arbitrário não validado. |
| Fornecedor confundir "despublicar" com "excluir" (ou vice-versa) e perder produto sem querer | UI distingue claramente as duas ações (toggle reversível vs. botão de exclusão com confirmação explicitando "definitivo, não pode desfazer"). |
| Produtos órfãos (`sup-001`..`sup-004`) confundirem QA/cliente achando que são fornecedores reais | Documentado aqui e no critério de aceite — mesma disciplina da nota de escopo do Perfil do Fornecedor. |

## Referências

- Dívida original: `spec-backend-produtos-cloudflare.md` (fatia 2), seção "Fora de escopo" (linhas
  19-21, 194-197) — aponta explicitamente pra esta spec.
- Nota crítica de escopo: `.claude/context/estado/progresso.md` (entrada da feature 006, 2026-07-23) e
  `spec-perfil-fornecedor.md` (seção "Fora de escopo") — ambas reservam uid↔supplierId pra cá.
- Padrão de porta/adapter a replicar: `front/src/lib/ports/order-repository.ts`,
  `front/src/lib/adapters/{http,mock}-order-repository.ts`.
- Padrão de contrato Zod a replicar: `packages/contracts/src/order.ts`.
- Decisão de modelo multi-vendedor: `.claude/docs/decisoes.md` D-009 (Modelo A).
- `feature_list.json`, entrada `007`: critério de aceite literal citado no topo desta spec.
