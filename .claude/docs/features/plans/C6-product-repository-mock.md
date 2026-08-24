# C6 — front/: `ProductRepository` (porta) + `MockProductRepository` + contract test

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C6 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C1, commit `32a4ae7`,
APROVADO 2026-07-26 via D-012).

## Objetivo

Criar a camada de porta+adapter mock para produtos no front, seguindo **exatamente** o mesmo padrão
já usado para pedidos (`OrderRepository`/`MockOrderRepository`, tarefas B5/B6). Esta tarefa é uma
camada nova e isolada — **sem consumidor ainda** (nenhuma página/componente de produção é tocada;
isso é C8/C9). `PRODUCTS` (`front/src/lib/products.ts`) continua existindo como está, intocado — só
serve de fixture/seed default do mock.

## Contexto mínimo

- `front/src/lib/ports/order-repository.ts` + `front/src/lib/adapters/mock-order-repository.ts` +
  `front/src/lib/ports/__tests__/order-repository.contract.ts` são o **molde exato** a seguir (mesma
  estrutura de arquivo, mesmo estilo de erro, mesmo padrão de contract test reutilizável).
- Contrato já existe (C1): `packages/contracts/src/product.ts` — `Product`, `CreateProductRequest`,
  `UpdateProductRequest`, `ProductSchema` — importar via `@contracts` (mesmo alias já usado por
  `@contracts` em `order-repository.ts`, resolvido desde a migração pra npm workspaces).
- **Divergência de nome já resolvida (não redecidir):** `front/src/lib/products.ts` usa
  `priceInCents`; o contrato usa `priceCents` (nome canônico, já em produção no backend desde a
  thread P). Esta tarefa faz a conversão na função de mapeamento do seed — ver código abaixo.
- **Decisão de "fornecedor atual" no mock (a spec deixava aberta — resolvida agora):** o mock recebe
  `supplierId` via **parâmetro no construtor** (nunca singleton global, mesmo espírito de
  `now`/`idFactory` já injetados em `MockOrderRepository`). `list()` (catálogo público) filtra só por
  `active`, ignora `supplierId` — é o catálogo de TODOS os fornecedores. `listForSupplier()` filtra só
  pelo `supplierId` do construtor, ignora `active` (ativos+inativos do próprio fornecedor).
- **Autorização por dono também no mock (decisão nova, documentar no relatório):** `update()`/
  `remove()` fazem a MESMA checagem de dono que o backend já faz (C4): se o produto não existe →
  `ProductNotFoundError`; se existe mas `product.supplierId !== this.supplierId` (o fornecedor
  "logado" nesta instância do mock) → `ProductForbiddenError` (nunca o contrário). Isso deixa o mock
  fiel ao comportamento real desde já, em vez de só simular o caminho feliz.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar que é este worktree, nunca o repo principal. Depois `git log --oneline -3` confirmando que
o commit `32a4ae7` (C1) está no histórico.

## Tarefas (nesta ordem)

### 1. Criar `front/src/lib/ports/product-repository.ts`
```ts
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'

export interface ProductRepository {
  list(): Promise<Product[]>                                    // publico, so active=true
  listForSupplier(): Promise<Product[]>                          // autenticado, todos do fornecedor atual
  create(req: CreateProductRequest): Promise<Product>
  update(id: string, req: UpdateProductRequest): Promise<Product>
  remove(id: string): Promise<void>
}

/** Lançado por update()/remove() quando o produto não existe. */
export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

/** Lançado por update()/remove() quando o produto existe mas não pertence ao fornecedor atual (403). */
export class ProductForbiddenError extends Error {
  constructor(productId: string) {
    super(`Not allowed to modify product: ${productId}`)
    this.name = 'ProductForbiddenError'
  }
}
```

### 2. Criar `front/src/lib/adapters/mock-product-repository.ts`
```ts
import type { ProductRepository } from '@/lib/ports/product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import { ProductSchema } from '@contracts'
import { PRODUCTS as STATIC_PRODUCTS } from '@/lib/products'

function toContractProduct(p: (typeof STATIC_PRODUCTS)[number]): Product {
  const mapped = {
    id: p.id,
    name: p.name,
    brand: p.brand,
    size: p.size,
    quantity: p.quantity,
    priceCents: p.priceInCents,
    supplierId: p.supplierId,
    slug: p.slug,
    categoria: p.categoria,
    descricao: p.descricao,
    atributos: p.atributos,
    badge: p.badge,
    active: true,
  }
  // Valida contra o schema Zod — mesmo padrao de toContractOrder em mock-order-repository.ts.
  return ProductSchema.parse(mapped)
}

export class MockProductRepository implements ProductRepository {
  private products: Product[]
  private supplierId: string
  private idFactory: () => string

  constructor(options: { supplierId: string; idFactory: () => string; seed?: Product[] }) {
    this.supplierId = options.supplierId
    this.idFactory = options.idFactory
    this.products = options.seed ?? STATIC_PRODUCTS.map(toContractProduct)
  }

  async list(): Promise<Product[]> {
    return this.products.filter((p) => p.active)
  }

  async listForSupplier(): Promise<Product[]> {
    return this.products.filter((p) => p.supplierId === this.supplierId)
  }

  async create(req: CreateProductRequest): Promise<Product> {
    const product: Product = ProductSchema.parse({
      id: this.idFactory(),
      supplierId: this.supplierId,
      active: true,
      name: req.name,
      brand: req.brand,
      size: req.size,
      quantity: req.quantity,
      priceCents: req.priceCents,
      slug: req.slug,
      categoria: req.categoria,
      descricao: req.descricao,
      atributos: req.atributos,
      badge: req.badge,
    })
    this.products.push(product)
    return product
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    const product = this.products.find((p) => p.id === id)
    if (!product) throw new ProductNotFoundError(id)
    if (product.supplierId !== this.supplierId) throw new ProductForbiddenError(id)
    Object.assign(product, req)
    return product
  }

  async remove(id: string): Promise<void> {
    const index = this.products.findIndex((p) => p.id === id)
    if (index === -1) throw new ProductNotFoundError(id)
    if (this.products[index].supplierId !== this.supplierId) throw new ProductForbiddenError(id)
    this.products.splice(index, 1)
  }
}
```

### 3. Criar `front/src/lib/ports/__tests__/product-repository.contract.ts`
Mesmo padrão de `order-repository.contract.ts` (função `runProductRepositoryContract(name, makeRepo)`
exportada, usada com seed vazio pelos testes do adapter). Casos:
- `list()` retorna array vazio quando não há produtos (seed vazio).
- `create()` com `active:true` (sempre, por definição do repositório) faz o produto aparecer em
  `list()` e em `listForSupplier()`.
- `update(id, { active: false })` faz o produto desaparecer de `list()` mas **continuar** em
  `listForSupplier()`.
- `update(id, { active: true })` de volta faz reaparecer em `list()`.
- `remove(id)` faz o produto desaparecer dos dois (`list()` e `listForSupplier()`).
- `update()`/`remove()` de um `id` inexistente lançam `ProductNotFoundError`.
- **Caso de autorização (decisão nova desta tarefa, ver contexto):** `makeRepo` recebe um segundo
  parâmetro `supplierId` (ex.: `runProductRepositoryContract(name, makeRepo, supplierId)`); a função
  usa esse `supplierId` para os testes de dono normais. Adicionar 1 teste que insere via `seed` (não
  via `create()`, que sempre usa o `supplierId` do próprio repo) um produto com `supplierId` DIFERENTE
  e confirma que `update()`/`remove()` desse produto lançam `ProductForbiddenError` (não
  `ProductNotFoundError`).

### 4. Criar `front/src/lib/adapters/__tests__/mock-product-repository.test.ts`
Mesmo padrão de `mock-order-repository.test.ts`: alguns testes diretos da classe (seed default tem os
24 produtos mapeados, todos com `priceCents` correto e `active:true`; `create()` usa `idFactory`
injetado; múltiplas instâncias com estados isolados) + a chamada da suíte de contrato:
```ts
runProductRepositoryContract(
  'MockProductRepository (empty seed)',
  () => new MockProductRepository({ supplierId: 'sup-test', idFactory: mockIdFactory, seed: [] }),
  'sup-test',
)
```
Ajustar a assinatura exata de `runProductRepositoryContract` conforme escrita no passo 3 (o teste de
autorização precisa do `supplierId` para montar o produto "de outro fornecedor" no seed).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd front && npm test` — suíte inteira verde (≥298 testes preexistentes + os novos). Nenhum teste
   existente pode quebrar.
2. `cd front && npx tsc --noEmit` — exit 0.
3. `cd front && npm run lint` — exit 0 (1 warning preexistente em `supplier-mock.ts`, não relacionado,
   tolerável).
4. Confirmar que **nenhum arquivo de produção existente** (`/catalogo`, `market-context.tsx`,
   `front/src/lib/products.ts`, etc.) foi modificado — só a camada nova, isolada.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não invente um padrão diferente do especificado (ex.: não usar singleton
global pro "fornecedor atual", não pular a checagem de `ProductForbiddenError`). Relate o que falhou,
o que tentou e o estado atual.

## Critérios de aceite

- [ ] `front/src/lib/ports/product-repository.ts` criado exatamente como especificado.
- [ ] `front/src/lib/adapters/mock-product-repository.ts` criado, implementando as 5 operações,
      incluindo a checagem de dono (404 vs 403) em `update`/`remove`.
- [ ] `front/src/lib/ports/__tests__/product-repository.contract.ts` criado, cobrindo os 7 casos
      listados (incluindo o de `ProductForbiddenError`).
- [ ] `front/src/lib/adapters/__tests__/mock-product-repository.test.ts` criado e verde.
- [ ] `npm test`/`tsc`/`lint` em `front/` — exit 0 (lint com o warning preexistente tolerado).
- [ ] Nenhum arquivo de produção existente tocado — só a camada nova.

## Restrições

- **Não** tocar em `front/src/lib/products.ts`, `front/src/app/(main)/catalogo/`,
  `front/src/contexts/market-context.tsx`, ou qualquer componente de produção — isso é C8/C9.
- **Não** usar singleton global para o "fornecedor atual" — sempre via parâmetro no construtor.
- **Não** usar `any`. **Não** importar `zod` diretamente — só os schemas prontos de `@contracts`.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(front): ProductRepository (porta) + MockProductRepository + contract test (thread C)`

## Relatório esperado

- Lista de arquivos criados.
- Saída literal dos 4 comandos de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido, e qualquer bloqueio.
