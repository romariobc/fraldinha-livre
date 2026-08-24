---
name: domain-fornecedor
description: Contexto completo do painel do fornecedor — tipos, componentes, rotas, regras de negócio e arquivos permitidos
---

# Domain: Painel do Fornecedor

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/fornecedor/` ou nas rotas sob `src/app/(fornecedor)/painel-fornecedor/`.

> Reescrito em 24 de Agosto de 2026 para refletir a migração para REST (HttpProductRepository) e a nova estrutura de rotas Next.js 15 (Route Groups), além do sistema de edição dinâmica de preços.

---

## Camada de Dados (Catálogo)

O painel de produtos do fornecedor abandonou o `MarketProvider` mockado para gerenciamento do catálogo próprio.

**Adaptador HTTP:** `src/lib/adapters/http-product-repository.ts` implementa `ProductRepository`.
**Entidade Base:** O tipo `Product` em `@contracts` e `src/lib/products.ts`.
**Rotas da API:** Backend hospedado no Cloudflare Workers (`/products?scope=fornecedor`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`).

> [!NOTE]
> Os pedidos diretos e a logística (ofertas) podem ainda utilizar mocks/contexto, mas **todo o gerenciamento do catálogo (produtos)** já funciona end-to-end com o banco D1 na nuvem.

### Atributos Relevantes do Produto
- `priceCents` / `priceInCents`: Preço atual de venda definido pelo fornecedor.
- `oldPriceCents`: Quando o fornecedor reduz o preço, o sistema (backend) guarda o valor antigo nesta coluna automaticamente. Na interface do comprador, isso é usado para calcular descontos (% OFF) visualmente e riscar o preço antigo.
- `active`: Controla a visibilidade no Marketplace.
- `quantity`: Estoque unificado por pacote.

---

## Componentes

```
src/components/fornecedor/
  SupplierSidebar.tsx       ← Navegação lateral (inclui "Ver Meu Catálogo Ativo")
  SupplierTopNav.tsx        ← Barra superior do dashboard
  AddProductDialog.tsx      ← Modal para vincular produtos do Catálogo Mestre ao fornecedor
  EditPriceDialog.tsx       ← Modal recém-criado para edição livre de preços (fixo ou em %)
```

---

## Rota e Arquitetura

- **Route Group Exclusivo:** O painel migrou de `(main)/fornecedor` para `(fornecedor)/painel-fornecedor/`. Isso permitiu um layout isolado sem herdar o Global Context (Providers) da área de compradores.
- **Controller do Catálogo:** `src/app/(fornecedor)/painel-fornecedor/catalogo/page.tsx`.
- **Gerenciamento de Estado:** Não usamos contextos globais para gerenciar a lista de produtos no painel; o state `products` e `loading/error` são gerenciados localmente no arquivo da página, e as ações de salvar (PUT), criar (POST) ou remover (DELETE) atualizam esse state.

---

## Regras de Negócio

**Catálogo do Fornecedor:**
- O fornecedor pode ver produtos (ativos ou despublicados).
- **Adicionar Produto:** Utiliza o `AddProductDialog` para copiar dados-base do "Catálogo Mestre" da plataforma.
- **Editar Preço:** Utiliza o `EditPriceDialog`. O preço pode ser ajustado com um novo valor bruto em Reais, ou informando uma porcentagem de desconto (que deduz sobre o preço atual).
- **Regra de Desconto (`oldPriceCents`):** A regra que define se um produto está em "Promoção" é executada inteiramente no backend (`productsPutHandler`). O painel do fornecedor apenas submete o novo `priceCents`. O painel fornece feedback instantâneo visual (UI text) se o novo preço ativará ou removerá um desconto.
- **Despublicar/Publicar:** Utiliza a chamada `PUT` para alterar o atributo `active`.

---

## Pitfalls críticos

**Contextos e Layouts:** O painel B2B do fornecedor *não* compartilha os provedores globais como `CartProvider` que habitam em `(main)`. Modificações nestes providers podem quebrar o acesso ao painel caso não estejam configurados corretamente na raiz (`app/layout.tsx`).
**Rastreio do `priceCents` versus `priceInCents`:** Há uma ligeira divergência entre as tipagens de frontend legado (`priceInCents`) e do novo pacote de contratos `@contracts` (`priceCents`). O frontend possui funções de mapa, tenha cuidado com mapeamentos nulos.

---

## Arquivos que este agente PODE tocar

```
✅ src/components/fornecedor/**
✅ src/app/(fornecedor)/painel-fornecedor/**
✅ packages/contracts/src/product.ts
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**              — primitivos compartilhados
❌ src/components/minha-conta/**     — domínio do comprador
❌ src/components/catalogo/**        — domínio do catálogo (vitrine do comprador)
❌ src/app/(main)/**                 — layouts de compradores
❌ tailwind.config.ts                — configuração global
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoque `Skill(risk-zone-protocol)` antes.
