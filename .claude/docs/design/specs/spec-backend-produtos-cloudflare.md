# Spec — Backend de Produtos (Cloudflare Workers + D1) — fatia 2 da feature 006

**Domínio:** backend · **Feature relacionada:** 006 (fatia 2 de N — a fatia 1 foi Pedidos, B1-B9,
em produção) · **Status:** proposta (brainstorming concluído, aguardando aprovação do plano de
implementação)

## Contexto

A fatia 1 (Pedidos) deixou uma dívida técnica registrada e aceita conscientemente: o Worker
(`POST /orders`) confia nos `items[].unitPrice` que o cliente envia — não há catálogo de produtos no
backend para revalidar. O `ADR-001`/`DEC-A` do plano da fatia 1 já previa isso: *"até a fatia de
Produtos existir, o servidor confia nos items[] (nomes/preços) enviados pelo cliente... endurecer na
fatia de Produtos"*.

Hoje o catálogo inteiro (24 fraldas) vive só em `front/src/lib/products.ts`, um array estático em
memória, sem nenhum backend. `/catalogo` (a página pública de navegação do comprador) lê direto desse
array via `filterProducts`/`getProductBySlug`.

Esta fatia fecha só a dívida de preço/existência — **não** é a feature 007 do backlog (catálogo do
fornecedor: cadastro/edição/remoção de produtos, perfil, histórico de vendas), que é um escopo bem
maior, com UI nova no painel do fornecedor, e permanece `todo` sem data definida.

### Decisões de escopo desta spec (brainstorming com o cliente, 2026-07-22)

- **Só o dado no backend.** Produtos passam a existir no D1, com `GET /products` no Worker. Nenhuma
  UI de cadastro/edição/remoção é criada — isso é a feature 007, fora de escopo aqui.
- **`/catalogo` (front) NÃO migra nesta fatia.** Continua lendo de `front/src/lib/products.ts`, sem
  nenhuma mudança de UI/UX. O Worker ganha sua própria cópia dos dados, usada só internamente para
  revalidar `POST /orders`. Migrar `/catalogo` para consumir o backend de verdade (`ProductRepository`
  porta+adapter, mesmo arco de B5-B8) fica para uma fatia futura, quando fizer sentido.
- **Preço divergente → rejeita o pedido (400), nunca corrige silenciosamente.** Se o preço no servidor
  não bate com o que o cliente enviou, o pedido inteiro é recusado — o comprador tenta de novo com o
  preço atual, em vez de um pedido ser persistido com um valor que ninguém pediu.
- **`Product` NÃO entra em `packages/contracts` nesta fatia.** Como `/catalogo` não consome o
  endpoint, um contrato Zod compartilhado não tem consumidor no front ainda — seria escopo antecipado
  (YAGNI). O schema fica interno a `back/` (Drizzle + validação ad-hoc no handler). Entra em
  `@contracts` quando a migração de `/catalogo` acontecer de verdade.

## Arquitetura

```
back/                                    front/ (INTOCADO nesta fatia)
  src/schema/products.ts (Drizzle)         src/lib/products.ts (continua sendo
    id, price_cents, supplier_id            a fonte do /catalogo, sem mudanca)
  migrations/0001_seed_products.sql
    (gerada por back/scripts/generate-products-seed.ts,
    commitado — le front/src/lib/products.ts e imprime
    os 24 INSERTs. Roda uma vez, na hora de escrever a
    migration; NAO e dependencia de runtime entre back/
    e front/ — o script fica versionado so para o D1
    poder ser recriado do zero de forma reprodutivel)
  src/routes/products.ts
    GET /products (sem auth, publico)
  src/routes/orders.ts (existente)
    POST /orders ganha checagem de preco/
    existencia ANTES do db.batch() (B4)
```

- **Monorepo (D-005) preservado**, mesmo padrão hexagonal (schema Drizzle isolado, rota isolada) já
  usado em `orders.ts`/`schema/orders.ts` desde B2-B4.
- **Sem impacto na atomicidade da B4:** a checagem de produto acontece antes de qualquer escrita —
  se falhar, nenhuma linha em `orders`/`order_items` é tocada. O teste de atomicidade
  (`d1-batch-atomicity.test.ts`) continua provando exatamente o que já provava.

## Regras de negócio

- **RN-P1** — `GET /products` é público (sem middleware de auth) — é dado de catálogo, não dado de
  usuário.
- **RN-P2** — `POST /orders`: para cada item de `body.items[]`, o servidor busca o produto por
  `productId` na tabela `products`. Se não existir, **400** (`produto nao encontrado: <productId>`).
  Se existir mas `item.unitPrice !== product.price_cents`, **400**
  (`preco divergente para produto: <productId>`).
- **RN-P3** — A checagem falha rápido no primeiro item inválido encontrado (não agrega todos os
  erros de uma vez) — consistente com o resto do Worker, que não tem esse padrão em nenhum lugar.
- **RN-P4** — A checagem roda **antes** do `db.batch()` de criação do pedido (RN-03 da fatia 1) —
  nenhuma escrita parcial em caso de rejeição.
- **RN-P5** — Preço em centavos (INTEGER no D1), mesmo padrão de `orders`/`order_items`.

## Modelo de dados (D1)

```sql
-- migrations/0001_seed_products.sql (schema + seed, gerados juntos)
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  price_cents   INTEGER NOT NULL,
  supplier_id   TEXT NOT NULL
);

-- 24 INSERTs gerados a partir de front/src/lib/products.ts (id, priceInCents, supplierId)
-- ex.: INSERT INTO products (id, price_cents, supplier_id) VALUES ('p1', 1800, 'sup-001');
```

Schema deliberadamente mínimo — só os 3 campos que a validação de `POST /orders` e o `GET /products`
precisam. Não inclui nome/marca/descrição/atributos (isso é dado de exibição, vive só no front
enquanto `/catalogo` não migra).

## Endpoints

| Método | Rota | Auth | Resp OK | Erros |
|---|---|---|---|---|
| GET | `/products` | Não | `200 Product[]` (`{id, priceCents, supplierId}`) | — |
| POST | `/orders` | Sim (já existia) | `201 Order` (inalterado) | **novo:** `400` produto inexistente ou preço divergente, além dos já existentes (`401`, `400` Zod) |

## Testes

- `back/test/products.get.test.ts` — `GET /products` sem token → 200 (não é 401, é rota pública);
  array não vazio; shape `{id, priceCents, supplierId}`.
- `back/test/orders.mutations.test.ts` (existente, **modificar fixtures**) — os testes atuais de
  `POST /orders` usam produtos fictícios (`prod-1`, preço `1000`) que não existem no catálogo real;
  com a validação nova eles passam a falhar por produto inexistente. Atualizar os fixtures para usar
  um id/preço real do seed (ex.: `p1`/1800) — deixa os testes mais fiéis à realidade, não é só
  "consertar pra passar".
- Casos novos em `orders.mutations.test.ts`:
  - `POST /orders` com preço correto de produto real → 201 (regressão, com fixture atualizado).
  - `POST /orders` com preço errado de produto real → 400.
  - `POST /orders` com `productId` inexistente → 400.

## Critérios de aceite

- [ ] `back/scripts/generate-products-seed.ts` commitado (lê `front/src/lib/products.ts`, gera o SQL).
- [ ] Migration `0001_seed_products.sql` gerada por esse script (schema + 24 INSERTs), aplicada local e
      no D1 remoto.
- [ ] `GET /products` responde 200 sem auth, com os 24 produtos.
- [ ] `POST /orders` rejeita (400) produto inexistente ou preço divergente, antes de qualquer escrita.
- [ ] Suíte do `back/` verde (testes existentes + novos), `tsc`/lint exit 0.
- [ ] `front/` **inalterado** — `/catalogo`, `products.ts`, e toda a suíte do front continuam exatamente
      como estavam (nenhum arquivo do front tocado nesta fatia).
- [ ] `packages/contracts/` **inalterado** — nenhum schema de `Product` adicionado nesta fatia.

## Fora de escopo (registrado, não é esquecimento)

- **Feature 007** (cadastro/edição/remoção de produto pelo fornecedor, perfil, histórico de vendas) —
  escopo maior, UI nova, sem data definida.
- **Migração de `/catalogo`** para consumir o backend (`ProductRepository` porta+adapter no front,
  mesmo arco de B5-B8) — fatia futura.
- **Estoque** (decremento transacional, disponibilidade) — fatia futura separada, só faz sentido
  depois que Produtos existir no D1 (esta fatia).
- **`Product` em `packages/contracts`** — entra quando `/catalogo` migrar de verdade.

## Riscos

| Risco | Mitigação |
|---|---|
| Seed do D1 diverge do array do front (alguém edita um sem editar o outro) | Aceito conscientemente — não há CRUD ainda (feature 007 resolve isso de vez). Documentar no código que o seed é gerado a partir do front na data X, não é sincronizado automaticamente. |
| Testes existentes de B4 quebram com a validação nova | Esperado e no escopo desta fatia — fixtures atualizados para produtos reais do seed. |
| Script gerador do seed vira dependência de runtime entre `back/` e `front/` | Não deixar isso acontecer — o script roda uma vez, gera SQL estático, `back/` nunca importa nada de `front/` em tempo de execução. |

## Referências

- Dívida original: `.claude/docs/design/adr/adr-001-estrategia-backend.md` (DEC-A do plano da fatia 1,
  `.claude/docs/design/plans/B-backend-pedidos-breakdown.md`).
- Estado do front: `front/src/lib/products.ts` (fonte do seed, não tocado).
- Padrão a seguir: `back/src/schema/orders.ts`, `back/src/routes/orders.ts` (mesma forma hexagonal).
- Decisões da fatia 1: `.claude/docs/decisoes.md` (D-026, D-027), `.claude/context/estado/progresso.md`.
