---
name: domain-catalogo
description: Contexto completo do catálogo de produtos — tipos, componentes, rotas, fluxo de browsing e arquivos permitidos
---

# Domain: Catálogo de Produtos

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/catalogo/` ou `src/app/(main)/catalogo/`.

> Revisado a partir do código real em 2026-07-23. **Correção crítica:** a versão anterior afirmava que `Product.price` estava em reais inteiros. Isso está invertido — o campo se chama `priceInCents` e está em **centavos**, igual aos outros domínios.

---

## Camada de dados

**Arquivo:** `src/lib/products.ts`

**Tipos exportados:**
```typescript
Brand    // 'Pampers' | 'Huggies' | 'MamyPoko' | 'Turma da Mônica' | 'Cremer'
Size     // 'RN' | 'P' | 'M' | 'G' | 'GG' | 'XXG'
Badge    // 'Mais vendido' | 'Oferta' | 'Novidade'
ProductCategory   // 'fraldas-descartaveis' — hoje só um valor; tipo deixa espaço para expandir (RN-02)
ProductAtributos  // { faixaPeso, genero: 'unissex', absorcao, tecnologia }

Product  // { id, name, brand, size, quantity, priceInCents, supplierId, slug,
         //   categoria, descricao, atributos, badge? }

ProductFilters  // { search, brand, size, sort, page }
```

**Constantes e funções exportadas:**
```typescript
PRODUCTS: Product[]    // 24 produtos (5 Pampers, 5 Huggies, 5 MamyPoko, 5 Turma da Mônica, 4 Cremer)

filterProducts(products, filters): { items; total; totalPages }
// busca, filtro de marca/tamanho, ordenação e paginação (PER_PAGE = 12, constante local não exportada)

getProductBySlug(slug: string): Product | undefined
```

**`Product.priceInCents` está em centavos** — use `formatPrice()` de `src/lib/utils.ts` normalmente, igual aos outros domínios. Não há mais nenhum campo de preço em reais inteiros neste domínio.

---

## Componentes

```
src/components/catalogo/
  ProductCard.tsx       ← card de produto; recebe isLoggedIn, onRequestOffer, onBuy
  CatalogFilters.tsx    ← barra de filtros: busca, marca, tamanho, ordenação
  Pagination.tsx        ← controles de paginação
  OfferModal.tsx        ← modal "pedir oferta" (cotação) — hoje só mostra um toast de confirmação
  BuyModal.tsx          ← modal de compra direta com quantidade + endereço — NÃO está importado em nenhuma página (código órfão hoje)
```

---

## Rota e arquitetura

- **Controller:** `src/app/(main)/catalogo/page.tsx`, envolto em `<Suspense>`.
- **Filtros vivem na URL**, não em `useState` local: `useFilters()` lê/escreve `search`, `marca`, `tam`, `sort`, `page` via `useSearchParams`/`router.replace`. `brand`/`size` usam o sentinela `'todos'` para "sem filtro" (remove o param da URL); `search`/`sort` gravam qualquer valor não vazio.
- `filterProducts()` é chamada no render com o state de filtros derivado da URL.
- Duas ações distintas por produto, ambas partindo de `ProductCard`:
  - **"Cotar" → `OfferModal`**: formulário (tamanho, quantidade, CEP, observações); ao enviar, só dispara `toast.success(...)` — **não cria nenhum `Order`** nem chama `account-mock`/`useOrders`. É puramente front, aguardando integração real.
  - **"Comprar" → `handleBuy` em `page.tsx`**: valida `useAuth()` + `isProfileComplete(profile)` (RN-06: perfil incompleto → `router.push('/minha-conta?tab=perfil&returnTo=/catalogo')`); senão, `useCart().addItem(...)` e navega para `/checkout`. **`BuyModal` não participa deste fluxo** apesar de existir no diretório — confirme antes de assumir que ele está em uso.

**Fluxo "Comprar" real:**
```
Usuário acessa /catalogo
  → CatalogFilters/useFilters atualizam a URL
  → filterProducts() recalcula lista a partir dos searchParams
  → ProductCard renderiza cada produto
  → Clique em "Comprar" → handleBuy() → checa perfil → addItem(useCart) → router.push('/checkout')
  → Clique em "Cotar" → abre OfferModal → submit → toast (sem persistência ainda)
```

---

## Integração com outros domínios

- `STORE_SUPPLIERS` (`src/lib/suppliers.ts`) resolve `product.supplierId` para nome do fornecedor (usado em `BuyModal` e no `handleBuy`).
- `useCart()` (`src/contexts/cart-context.tsx`) e `useAuth()` (`src/contexts/auth-context.tsx`) são consumidos diretamente pelo controller — não são exclusivos do domínio catálogo.
- Se for reativar `BuyModal` ou fazer `OfferModal` persistir um pedido de fato, isso toca `src/contexts/orders-context.tsx` / `src/lib/account-mock.ts` (comprador) — invoke `Skill(risk-zone-protocol)` antes.

---

## Pitfalls críticos

**`priceInCents`, não `price`:**
```typescript
// Correto — mesmo padrão dos outros domínios
formatPrice(product.priceInCents)

// ERRADO — o campo não existe mais como "reais inteiros"
`R$ ${product.price},00`
```

**Paginação fixa em 12 items (`PER_PAGE = 12`):**
Constante local em `products.ts`, não exportada. Alterar é mudança de infraestrutura compartilhada.

**`BuyModal.tsx` é código não utilizado hoje** — não assuma que editá-lo afeta o app rodando; verifique com `grep -r BuyModal src/` antes de investir tempo nele.

---

## Arquivos que este agente PODE tocar

```
✅ src/components/catalogo/**
✅ src/app/(main)/catalogo/**
✅ src/lib/products.ts            (cautela: arquivo compartilhado — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**            — primitivos compartilhados
❌ src/components/fornecedor/**    — domínio do fornecedor
❌ src/components/minha-conta/**   — domínio do comprador
❌ src/lib/account-mock.ts         — domínio do comprador
❌ src/contexts/**                 — providers compartilhados (Orders/Market/Auth/Cart)
❌ tailwind.config.ts              — configuração global
❌ src/app/(main)/layout.tsx       — layout raiz
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
