---
name: domain-catalogo
description: Mapa do catálogo público e integração com produtos, carrinho e autenticação.
---

# Catálogo

- Rotas: front/src/app/(main)/catalogo/ e sua vitrine por fornecedor.
- Implementação compartilhada: front/src/components/catalogo/CatalogoView.tsx. A página de catálogo apenas envolve a view com Suspense.
- Produtos vêm de useProducts em front/src/contexts/products-context.tsx. Consulte o provider e ProductRepository; não use PRODUCTS como catálogo real estático.
- Filtros e paginação são derivados da URL. A vitrine também usa fornecedorId da rota; preserve esse escopo ao atualizar filtros.
- Preços do modelo de apresentação usam priceInCents; os contratos usam priceCents. Confirme o mapeamento e mantenha valores em centavos.
- Compras passam por autenticação/perfil, carrinho e checkout; verifique handleBuy na view. Não presuma que BuyModal participa do fluxo só por existir no diretório.
- Cotação e leilão têm restrições próprias: confirme flags e implementação antes de declarar persistência ou disponibilidade.

Escopo local: front/src/components/catalogo/ e front/src/app/(main)/catalogo/. Providers, helpers, contratos e outros domínios exigem análise de impacto conforme risk-zone-protocol. Ao alterar UI, leia ui-system.
