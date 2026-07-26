# C8 — front/: `/catalogo` e `/produto/[slug]` migram para `ProductRepository`

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C8 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C7, commit `1543b08`,
APROVADO 2026-07-26 via D-012).

**⚠️ MAIOR RISCO DA FATIA (registrado na spec).** Revisão humana no navegador é OBRIGATÓRIA antes de
aprovar — a sessão-mãe fará isso depois da sua entrega, não pule a etapa de verificação automatizada
achando que a revisão manual substitui.

## Objetivo

`/catalogo` e `/produto/[slug]` hoje leem direto do array estático `PRODUCTS`
(`front/src/lib/products.ts`), síncrono. Esta tarefa troca a origem do dado pro `ProductRepository`
(C6/C7) — `MockProductRepository` por padrão, `HttpProductRepository` se
`NEXT_PUBLIC_USE_BACKEND=true` (mesma flag já usada por `OrdersProvider`) — com loading/erro
explícitos (RN-007-07, nunca cai silenciosamente pro array estático em caso de erro).

## Contexto mínimo — decisões já tomadas (não redecidir)

1. **`front/src/lib/products.ts` não é intocável nesta tarefa** (diferente do que C6 disse — aqui é
   diferente, é a própria migração). Mudança específica e mínima: os tipos `Brand`, `Size`, `Badge`,
   `ProductCategory` (hoje unions literais fixas) passam a ser `string`. **Motivo:** uma vez que
   fornecedores podem cadastrar produtos livremente (C4, já aprovado), a marca/tamanho/categoria/selo
   de um produto real não fica mais restrita às 5 marcas/6 tamanhos/1 categoria do seed antigo — o
   `Product` que vem do backend real pode ter qualquer string nesses campos. Isso NÃO é um cast sem
   validação (proibido pelo checklist de revisão) — é alargar o tipo pra refletir a realidade dos
   dados, com fallback seguro onde havia lookup exaustivo (ver item 2). `PRODUCTS` (o array de seed)
   continua existindo e válido (strings literais são atribuíveis a `string`).
2. **`ProductCard.tsx` tem 1 ponto que dependia da união fechada de `Badge`:**
   `BADGE_STYLES: Record<Badge, string>` faz lookup exaustivo. Com `Badge` = `string`, o lookup
   `BADGE_STYLES[product.badge]` pode retornar `undefined` pra um badge que não é um dos 3 valores
   conhecidos — precisa de fallback (ver Tarefa 2), senão a classe CSS vira a string `"undefined"`.
3. **Novo provider, não extensão do `MarketProvider`:** `MarketProvider`
   (`front/src/contexts/market-context.tsx`) é reservado pro estado do lado FORNECEDOR (pedidos
   diretos/ofertas, C10) — não é o lugar certo pro catálogo público. Criar
   `front/src/contexts/products-context.tsx` (`ProductsProvider`/`useProducts`), mesmo molde
   estrutural de `OrdersProvider` (`front/src/contexts/orders-context.tsx` — **ler esse arquivo
   inteiro antes de escrever o provider novo**), mas **mais simples**: `list()` é rota pública (nunca
   exige auth), então **não precisa** do gating por `onAuthStateChanged` que `OrdersProvider` tem —
   carregar direto no mount, sempre.
4. **`supplierId` do construtor do `MockProductRepository` é irrelevante aqui:** o catálogo público
   só chama `list()` (nunca `listForSupplier()`), e `list()` não usa `supplierId`. Usar `''` (string
   vazia) com um comentário explicando por que é seguro nesse contexto específico — não é um valor
   real de fornecedor, só satisfaz o parâmetro obrigatório do construtor.
5. **Mapeamento `@contracts.Product` → `Product` legado:** só `priceCents`→`priceInCents` muda de
   nome; os demais campos batem 1:1 (nomes iguais, tipos agora compatíveis por causa do item 1).

## Skills obrigatórias (AGENTS.md deste repo)

Antes de tocar em qualquer arquivo, invocar (nesta ordem, se ambas existirem no seu ambiente):
`Skill(domain-catalogo)` (esta tarefa toca `src/app/(main)/catalogo/`) e `Skill(ui-system)` (é
trabalho de UI/componente). Se as skills não existirem/não carregarem no seu ambiente, registrar
isso no relatório e seguir pelo prompt normalmente — não é motivo de bloqueio, mas não pule a
tentativa.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que `1543b08` (C7) está no
histórico.

## Tarefas (nesta ordem)

### 1. Modificar `front/src/lib/products.ts` — alargar 4 tipos
```ts
// Antes de cada tipo, adicionar comentário explicando (ver item 1 do contexto):
// Alargado para `string` em C8: produtos reais de fornecedor (via CRUD, C4) nao ficam
// restritos aos valores do seed antigo. PRODUCTS abaixo continua valido (strings literais
// sao atribuiveis a string).
export type Brand = string
export type Size = string
export type Badge = string
export type ProductCategory = string
```
Não mudar mais nada neste arquivo (`PRODUCTS`, `filterProducts`, `getProductBySlug` continuam como
estão — `getProductBySlug` fica sem uso em produção depois desta tarefa, mas **não remover**, pode
servir de fixture de teste do `MockProductRepository`, mesmo espírito de C6).

### 2. Modificar `front/src/components/catalogo/ProductCard.tsx` — fallback de badge
Trocar o uso de `BADGE_STYLES[product.badge]` (dentro do bloco `{product.badge && (...)}`) por uma
variável com fallback:
```ts
// Antes de usar no JSX:
const badgeClass = product.badge ? (BADGE_STYLES[product.badge] ?? 'bg-brand-muted text-white') : undefined
```
E usar `badgeClass` no lugar de `BADGE_STYLES[product.badge]` diretamente no `className`. Não mudar
mais nada neste arquivo.

### 3. Criar `front/src/contexts/products-context.tsx`
```tsx
'use client'

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import type { Product as LegacyProduct } from '@/lib/products'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { MockProductRepository } from '@/lib/adapters/mock-product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import type { Product as ContractProduct } from '@contracts'

function contractProductToLegacyProduct(p: ContractProduct): LegacyProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    size: p.size,
    quantity: p.quantity,
    priceInCents: p.priceCents,
    supplierId: p.supplierId,
    slug: p.slug,
    categoria: p.categoria,
    descricao: p.descricao,
    atributos: p.atributos,
    badge: p.badge,
  }
}

interface ProductsContextType {
  products: LegacyProduct[]
  loading: boolean
  error: string | null
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<LegacyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'

  const repo: ProductRepository = useMemo(() => {
    if (useBackend) return new HttpProductRepository()
    // supplierId vazio: catalogo publico so chama list(), que nao usa supplierId.
    return new MockProductRepository({
      supplierId: '',
      idFactory: () => crypto.randomUUID(),
    })
  }, [useBackend])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const result = await repo.list()
        if (cancelled) return
        setProducts(result.map(contractProductToLegacyProduct))
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar produtos:', err)
        setError('Não foi possível carregar o catálogo. Tente novamente.')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    // list() e rota publica - nunca exige auth, carrega direto (diferente de OrdersProvider).
    load()
    return () => { cancelled = true }
  }, [repo])

  return (
    <ProductsContext.Provider value={{ products, loading, error }}>
      {children}
    </ProductsContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductsContext)
  if (!context) {
    throw new Error('useProducts deve ser usado dentro de ProductsProvider')
  }
  return context
}
```

### 4. Modificar `front/src/app/(main)/layout.tsx`
Adicionar `ProductsProvider` (mesmo nível dos outros providers, ordem não importa pois não têm
dependência entre si — colocar como mais externo, ao lado de `OrdersProvider`):
```tsx
import { ProductsProvider } from '@/contexts/products-context'
// ...
    <OrdersProvider>
      <ProductsProvider>
        <CartProvider>
          <MarketProvider>
            {/* ... resto igual ... */}
          </MarketProvider>
        </CartProvider>
      </ProductsProvider>
    </OrdersProvider>
```

### 5. Modificar `front/src/app/(main)/catalogo/page.tsx`
- Remover o import de `PRODUCTS` de `@/lib/products` (manter `filterProducts`, `Product`,
  `ProductFilters` — esses continuam vindo de lá, só o array estático sai).
- Importar `useProducts` de `@/contexts/products-context`.
- Dentro de `CatalogoContent`, obter `{ products, loading, error } = useProducts()` e trocar
  `filterProducts(PRODUCTS, filters)` por `filterProducts(products, filters)`.
- Adicionar estado de loading (skeleton simples — reaproveitar o padrão visual já usado em algum
  outro loading do projeto se existir; senão, um placeholder textual/spinner simples é aceitável,
  não é o foco de qualidade visual desta tarefa) ANTES do grid, e estado de erro explícito (mensagem
  + eventualmente botão de retry chamando reload — não implementar retry sofisticado, um simples
  texto de erro já satisfaz RN-007-07: nunca cair silenciosamente pro estático).
- **Não mudar mais nada** (filtros, paginação, `handleBuy`, `OfferModal` continuam exatamente como
  estão — leilão/oferta é fora de escopo desta thread).

### 6. Modificar `front/src/app/(main)/produto/[slug]/page.tsx`
- Remover o import de `getProductBySlug` de `@/lib/products`.
- Importar `useProducts` de `@/contexts/products-context`.
- Trocar `const product = getProductBySlug(slug)` por: obter `{ products, loading, error } =
  useProducts()` e derivar `const product = products.find((p) => p.slug === slug)`.
- **Antes** do `if (!product)` existente (que já trata "produto não encontrado"), adicionar checagem
  de `loading` (mostrar um estado de carregamento simples) e de `error` (mostrar mensagem de erro
  explícita, RN-007-07) — só depois dessas duas checagens é que `!product` significa de fato "não
  existe" (evitar falso-positivo de "produto não encontrado" enquanto ainda está carregando).
- **Não mudar mais nada** (`handleAddToCart`, `handleBuyNow`, o JSX de exibição do produto continuam
  exatamente como estão).

### 7. Adaptar `front/src/app/(main)/produto/[slug]/__tests__/page.test.tsx`
Ler o arquivo primeiro. Ele hoje espera `getProductBySlug` síncrono. Adicionar
`vi.mock('@/contexts/products-context', () => ({ useProducts: vi.fn() }))` (mesmo padrão dos mocks já
existentes de `useAuth`/`useCart` nesse arquivo) e, em cada teste, configurar o mock de `useProducts`
para retornar `{ products: [...], loading: false, error: null }` com o produto esperado no array
(reaproveitar os dados de `front/src/lib/products.ts` como fixture, mesmo produto que os testes já
usavam antes via `getProductBySlug`). Adicionar 1 teste novo: `loading: true` mostra o estado de
carregamento (não "produto não encontrado").

### 8. Criar teste para `/catalogo` (não existe ainda um arquivo de teste desta página)
Criar `front/src/app/(main)/catalogo/__tests__/page.test.tsx`, mockando `useProducts` (mesmo padrão do
passo 7) e os outros contextos que a página usa (`useAuth`, `useCart` — ver mocks já usados no teste
de `produto/[slug]` como referência de como mockar esses dois). Casos mínimos: renderiza produtos
quando `useProducts` retorna dados; mostra loading quando `loading: true`; mostra erro quando `error`
não é `null`; **não quebra nenhum comportamento de filtro/paginação já existente** (1 teste básico de
filtro por marca é suficiente, não precisa recriar toda a cobertura de `filterProducts`, que já tem
teste próprio se existir, ou é lógica pura simples).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd front && npm test` — suíte inteira verde (≥325 preexistentes + os novos/adaptados).
2. `cd front && npx tsc --noEmit` — exit 0.
3. `cd front && npm run lint` — exit 0 (warning preexistente tolerável).
4. `cd front && npm run build` — **sem erro**. Esta página passa de estática pra depender de dado em
   runtime (client-side, via provider) — confirmar que o build não quebra e que a lista de rotas
   continua incluindo `/catalogo` e `/produto/[slug]`.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não mexa em `OfferModal`/`InlineOfferForm`/`MOCK_MARKET_ORDERS`/
`MOCK_OFFERS` (leilão inativo, fora de escopo, D-007/D-014). Relate o que falhou, o que tentou e o
estado atual.

## Critérios de aceite

- [ ] `Brand`/`Size`/`Badge`/`ProductCategory` alargados para `string` em `products.ts`, com comentário
      explicando o motivo.
- [ ] `ProductCard.tsx` com fallback seguro pro badge (nunca renderiza classe `"undefined"`).
- [ ] `ProductsProvider`/`useProducts` criados, carregando via `ProductRepository` (mock por padrão,
      HTTP com a flag), sem gating de auth (rota pública).
- [ ] `/catalogo` e `/produto/[slug]` usam `useProducts()`, com loading/erro explícitos — **nunca**
      caem silenciosamente pro array estático em caso de erro.
- [ ] `npm test`/`tsc`/`lint`/`build` em `front/` — todos OK.
- [ ] `OfferModal`/`MOCK_MARKET_ORDERS`/`MOCK_OFFERS` intocados.

## Restrições

- **Não** tocar em `OfferModal.tsx`, `InlineOfferForm.tsx`, `market-context.tsx`,
  `MOCK_MARKET_ORDERS`, `MOCK_OFFERS` — leilão/oferta inativo (D-007/D-014), fora de escopo.
- **Não** remover `PRODUCTS`/`getProductBySlug` de `products.ts` — continuam como fixture de teste.
- **Não** usar `any`. **Não** importar `zod` direto.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(front): /catalogo e /produto/[slug] migram para ProductRepository (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 4 comandos de verificação (incluindo a lista de rotas do `npm run build`).
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido (ex.: exato texto/visual do loading state), e
  qualquer bloqueio.

## Nota para a sessão-mãe (não faz parte do prompt do executor)
Depois da entrega do Haiku e da revisão D-012 automatizada, **abrir o navegador
(`preview_start`) e navegar em `/catalogo` e `/produto/<slug-existente>` de verdade** antes de
aprovar — ver o grid carregar, um produto abrir, loading/erro aparecerem corretamente. Não aprovar
só com testes verdes, esta tarefa exige confirmação visual (maior risco da fatia).
