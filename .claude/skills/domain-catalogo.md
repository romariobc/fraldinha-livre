---
name: domain-catalogo
description: Contexto completo do catálogo de produtos — tipos, componentes, rotas, fluxo de browsing e arquivos permitidos
---

# Domain: Catálogo de Produtos

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/catalogo/` ou `src/app/(main)/catalogo/`.

---

## Camada de dados

**Arquivo:** `src/lib/products.ts`

**Tipos exportados:**
```typescript
Brand    // 'Pampers' | 'Huggies' | 'MamyPoko' | 'Turma da Mônica' | 'Cremer'
Size     // 'RN' | 'P' | 'M' | 'G' | 'GG' | 'XXG'
Badge    // 'Mais vendido' | 'Oferta' | 'Novidade'

Product  // { id, name, brand: Brand, size: Size, quantity, price, badge?: Badge }
         //   price é preço por UNIDADE em reais (não centavos)

ProductFilters  // { search, brand, size, sort, page }
```

**Constantes e funções exportadas:**
```typescript
PRODUCTS: Product[]    // 24 produtos (5 Pampers, 5 Huggies, 5 MamyPoko, 5 Turma da Mônica, 4 Cremer)

filterProducts(
  products: Product[],
  filters: ProductFilters
): { items: Product[]; total: number; totalPages: number }
// Aplica busca, filtro de marca/tamanho, ordenação e paginação (12 por página)
```

**Atenção:** `Product.price` está em **reais inteiros** (ex: `22` = R$ 22,00), diferente dos outros domínios onde preço é em centavos. Não usar `formatPrice()` do `supplier-mock.ts` aqui.

---

## Componentes

```
src/components/catalogo/
  ProductCard.tsx       ← card de produto com badge, preço, marca e botão de ação
  CatalogFilters.tsx    ← barra de filtros: busca, marca, tamanho, ordenação
  Pagination.tsx        ← controles de paginação
  OfferModal.tsx        ← modal para criar cotação a partir de um produto do catálogo
```

---

## Rota e arquitetura

- **Controller:** `src/app/(main)/catalogo/page.tsx`
- `page.tsx` gerencia estado de filtros, página atual e modal aberto
- `filterProducts()` é chamada no render com o state de filtros atual
- `OfferModal` ao confirmar cria um novo `Order` em `account-mock` (integração entre domínios — cuidado)

**Fluxo completo:**
```
Usuário acessa /catalogo
  → CatalogFilters atualiza estado de filtros em page.tsx
  → filterProducts() recalcula lista
  → ProductCard renderiza cada produto
  → Clique em "Cotar" abre OfferModal
  → OfferModal confirma → novo Order{type:'cotacao'} adicionado ao state do comprador
```

---

## Integração com domínio comprador

O `OfferModal` cria pedidos de cotação. Quando conectado ao backend, isso chamará `POST /api/comprador/cotacoes`. Por enquanto, a integração é via estado local ou callback passado do `page.tsx`.

Se precisar modificar o shape de `Order` para suportar algo do catálogo, **primeiro verifique** `src/lib/account-mock.ts` e invoke `Skill(risk-zone-protocol)`.

---

## Pitfalls críticos

**`price` em reais, não centavos:**
```typescript
// Correto para este domínio
`R$ ${product.price},00`

// ERRADO — não usar formatPrice() do supplier-mock
formatPrice(product.price)  // resultado incorreto: R$ 0,22 para price=22
```

**Paginação fixa em 12 items (`PER_PAGE = 12`):**
Constante local em `products.ts`, não exportada. Se precisar alterar, é uma mudança de infraestrutura compartilhada.

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
❌ src/lib/account-mock.ts         — domínio do comprador (mesmo que OfferModal use)
❌ tailwind.config.ts              — configuração global
❌ src/app/(main)/layout.tsx       — layout raiz
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
