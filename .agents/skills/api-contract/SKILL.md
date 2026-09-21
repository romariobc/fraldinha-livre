---
name: api-contract
description: Contratos e integração real entre frontend, API e dados; consultar ao alterar a fronteira entre workspaces.
---

# Frontend ↔ backend

A fonte compartilhada de tipos e schemas Zod é `packages/contracts/src/`. Confirme exports e consumidores antes de criar contratos duplicados.

- Pedidos: `front/src/lib/ports/order-repository.ts`, adapters mock/http e `front/src/contexts/orders-context.tsx`.
- Produtos: `front/src/lib/ports/product-repository.ts`, `front/src/lib/adapters/http-product-repository.ts`, `front/src/contexts/products-context.tsx` e catálogo do fornecedor. Já existe backend real; não trate catálogo e fornecedor como 100% mock.
- HTTP: `front/src/lib/api-client.ts` centraliza token Firebase, identificação da requisição e erros. Reutilize-o.
- API: `back/src/routes/`; persistência em `back/src/schema/` e `back/migrations/`.
- Auth: `back/src/middleware/auth.ts` valida ID Token via JWKS e resolve Custom Claims. Há compatibilidade com ADMIN_UID; claims conflitantes negam acesso. Não implemente autorização apenas na interface.

Rotas já implementadas incluem GET/POST /orders, PATCH /orders/:id/cancel, GET /products (incluindo scope=fornecedor), POST /products e PUT/DELETE /products/:id. Confira métodos, payloads e permissões nas rotas antes de alterar consumidores.

Mocks restantes, flags e adaptadores de pagamento/fulfillment têm funções específicas; a existência de um mock não significa ausência de backend. O checkout ainda tem pagamento simulado conforme estado atual.

Ao mudar uma integração: verifique schema compartilhado, consumidores, erros tipados (use error.code, não inferência por mensagem), loading/erro e testes pertinentes. Siga risk-zone-protocol para contracts e infraestrutura compartilhada. Detalhes em `docs/architecture/integration-guide.md`.
