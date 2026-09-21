# C7 — front/: `HttpProductRepository`

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C7 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C6, commit `34dd865`,
APROVADO 2026-07-26 via D-012).

## Objetivo

Implementar `ProductRepository` (porta de C6) contra o backend real (endpoints de C3/C4, já em
produção-local/aprovados: `GET/POST /products`, `PUT`/`DELETE /products/:id`). Mesmo molde exato de
`HttpOrderRepository` (`front/src/lib/adapters/http-order-repository.ts`) — **ler esse arquivo e seu
teste (`http-order-repository.test.ts`) antes de escrever qualquer coisa**, são o template.

## Contexto mínimo

- `apiFetch` (`front/src/lib/api-client.ts`) já injeta `Authorization: Bearer <token>` via
  `auth.currentUser?.getIdToken()` e monta a URL com `NEXT_PUBLIC_BACKEND_URL` — usar sem modificar.
- Endpoints (já aprovados, ver `C-catalogo-fornecedor-breakdown.md` seção "Contrato HTTP"):
  | Método | Rota | Resp OK | Erros |
  |---|---|---|---|
  | GET | `/products` | `200 Product[]` | — |
  | GET | `/products?scope=fornecedor` | `200 Product[]` | 401 |
  | POST | `/products` | `201 Product` | 401, 400 |
  | PUT | `/products/:id` | `200 Product` | 401, 403, 404, 400 |
  | DELETE | `/products/:id` | `204` (sem corpo) | 401, 403, 404 |
- Mapeamento de status → erro tipado (mesmo padrão de `HttpOrderRepository.cancel`): `404` →
  `ProductNotFoundError`, `403` → `ProductForbiddenError` (checar 404 antes de 403, mesma ordem do
  backend). `401`/outros erros não específicos → `Error` genérico (`!res.ok`), sem tipo próprio (a
  UI de login/sessão trata 401 em outra camada, fora de escopo aqui).
- `ProductSchema`/`ProductListSchema` (não esqueça de importar `ProductListSchema`, já exportado por
  C1) — usar para validar a resposta, mesmo padrão de `OrderSchema`/`OrderListSchema`.
- **Zero import de `'zod'` direto** — só os schemas prontos de `@contracts`
  ([[feedback-zod-versao-packages-contracts]], já é restrição conhecida do projeto).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que `34dd865` (C6) está no
histórico.

## Tarefas (nesta ordem)

### 1. Criar `front/src/lib/adapters/http-product-repository.ts`
```ts
import { apiFetch } from '@/lib/api-client'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import { ProductSchema, ProductListSchema } from '@contracts'

export class HttpProductRepository implements ProductRepository {
  async list(): Promise<Product[]> {
    const res = await apiFetch('/products')
    if (!res.ok) throw new Error(`Failed to list products: HTTP ${res.status}`)
    const json = await res.json()
    return ProductListSchema.parse(json)
  }

  async listForSupplier(): Promise<Product[]> {
    const res = await apiFetch('/products?scope=fornecedor')
    if (!res.ok) throw new Error(`Failed to list supplier products: HTTP ${res.status}`)
    const json = await res.json()
    return ProductListSchema.parse(json)
  }

  async create(req: CreateProductRequest): Promise<Product> {
    const res = await apiFetch('/products', { method: 'POST', body: JSON.stringify(req) })
    if (!res.ok) throw new Error(`Failed to create product: HTTP ${res.status}`)
    const json = await res.json()
    return ProductSchema.parse(json)
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    const res = await apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(req) })
    if (res.status === 404) throw new ProductNotFoundError(id)
    if (res.status === 403) throw new ProductForbiddenError(id)
    if (!res.ok) throw new Error(`Failed to update product: HTTP ${res.status}`)
    const json = await res.json()
    return ProductSchema.parse(json)
  }

  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' })
    if (res.status === 404) throw new ProductNotFoundError(id)
    if (res.status === 403) throw new ProductForbiddenError(id)
    if (!res.ok) throw new Error(`Failed to remove product: HTTP ${res.status}`)
  }
}
```

### 2. Criar `front/src/lib/adapters/__tests__/http-product-repository.test.ts`
Mesmo padrão em duas partes de `http-order-repository.test.ts`:

**Parte A — comportamento específico de HTTP (fetch mockado simples, `vi.stubGlobal('fetch', ...)`)**,
mockando `@/lib/firebase` (`auth.currentUser.getIdToken`) igual ao arquivo-molde:
- `list()`/`create()`/`update()`/`remove()` enviam `Authorization: Bearer <token>` (pelo menos 2 dos 4,
  não precisa repetir todos os 5 métodos se ficar redundante — usar julgamento, documentar no
  relatório quantos cobriu).
- `update()` com status 404 → lança `ProductNotFoundError`.
- `update()` com status 403 → lança `ProductForbiddenError`.
- `remove()` com status 404 → lança `ProductNotFoundError`.
- `remove()` com status 403 → lança `ProductForbiddenError`.
- `list()` com resposta 200 vazia → array vazio.

**Parte B — `runProductRepositoryContract` com fetch mockado stateful** (mesmo padrão de
`createFakeFetch()` em `http-order-repository.test.ts` — um fake in-memory que resolve
GET/POST/PUT/DELETE por URL/método):
```ts
function createFakeFetch() {
  const fakeDb: Product[] = []
  let counter = 0

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.includes('/products') && url.includes('scope=fornecedor')) {
      return new Response(JSON.stringify(fakeDb), { status: 200 })
    }

    if (method === 'GET' && url.endsWith('/products')) {
      return new Response(JSON.stringify(fakeDb.filter((p) => p.active)), { status: 200 })
    }

    if (method === 'POST' && url.endsWith('/products')) {
      const body = JSON.parse(init!.body as string)
      counter += 1
      const product: Product = {
        id: `fake-product-${counter}`,
        supplierId: 'fake-supplier',
        active: true,
        name: body.name,
        brand: body.brand,
        size: body.size,
        quantity: body.quantity,
        priceCents: body.priceCents,
        slug: body.slug,
        categoria: body.categoria,
        descricao: body.descricao,
        atributos: body.atributos,
        badge: body.badge,
      }
      fakeDb.push(product)
      return new Response(JSON.stringify(product), { status: 201 })
    }

    const idMatch = url.match(/\/products\/([^/?]+)$/)
    if (method === 'PUT' && idMatch) {
      const product = fakeDb.find((p) => p.id === idMatch[1])
      if (!product) return new Response(JSON.stringify({ error: 'product not found' }), { status: 404 })
      const body = JSON.parse(init!.body as string)
      Object.assign(product, body)
      return new Response(JSON.stringify(product), { status: 200 })
    }

    if (method === 'DELETE' && idMatch) {
      const index = fakeDb.findIndex((p) => p.id === idMatch[1])
      if (index === -1) return new Response(JSON.stringify({ error: 'product not found' }), { status: 404 })
      fakeDb.splice(index, 1)
      return new Response(null, { status: 204 })
    }

    throw new Error(`fetch fake nao trata: ${method} ${url}`)
  })
}

describe('HttpProductRepository - Parte B: Contract test com fetch mockado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  runProductRepositoryContract('HttpProductRepository (fetch mockado)', () => {
    vi.stubGlobal('fetch', createFakeFetch())
    return new HttpProductRepository()
  })
})
```
Confirmar a assinatura exata de `runProductRepositoryContract` em
`front/src/lib/ports/__tests__/product-repository.contract.ts` (C6 mudou a assinatura original do
prompt — hoje é `(name, makeRepo)`, sem parâmetro de `supplierId`; o teste de `ProductForbiddenError`
específico do mock não se aplica aqui, já que este fake fetch não modela múltiplos fornecedores — só
rodar o contract test como está, não adaptar a assinatura).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd front && npm test` — suíte inteira verde (≥311 preexistentes + os novos). Nenhum teste
   existente pode quebrar.
2. `cd front && npx tsc --noEmit` — exit 0.
3. `cd front && npm run lint` — exit 0 (warning preexistente em `supplier-mock.ts` tolerável).
4. Confirmar zero import de `'zod'` direto no arquivo novo (`grep -n "from 'zod'"` não deve achar
   nada em `http-product-repository.ts`).
5. Confirmar que nenhum arquivo de produção existente (`/catalogo`, `market-context.tsx`, etc.) foi
   tocado.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise. Relate o que falhou, o que tentou e o estado atual.

## Critérios de aceite

- [ ] `HttpProductRepository` implementa as 5 operações exatamente como especificado.
- [ ] Mapeamento de erro: 404→`ProductNotFoundError`, 403→`ProductForbiddenError` (nessa ordem,
      404 primeiro), outros erros → `Error` genérico.
- [ ] Teste cobre header de auth, mapeamento de status, e passa pelo contract test reutilizável de C6.
- [ ] `npm test`/`tsc`/`lint` em `front/` exit 0.
- [ ] Zero import de `'zod'` direto.
- [ ] Nenhum arquivo de produção existente modificado.

## Restrições

- **Não** tocar em `front/src/lib/products.ts`, `/catalogo`, `market-context.tsx`, ou qualquer
  componente de produção — isso é C8/C9.
- **Não** modificar a assinatura de `runProductRepositoryContract` (herdada de C6) — se este prompt
  e o arquivo real conflitarem, o arquivo real manda; relatar a diferença, não silenciar.
- **Não** usar `any`. **Não** importar `zod` direto.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(front): HttpProductRepository (thread C)`

## Relatório esperado

- Lista de arquivos criados.
- Saída literal dos 5 itens de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido (ex.: quantos casos de auth-header cobriu na Parte
  A), e qualquer bloqueio.
