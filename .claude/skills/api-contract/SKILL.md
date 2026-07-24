---
name: api-contract
description: Contrato frontend↔backend — mapeamento mock→endpoint REST, tipos que cruzam a fronteira e checklist de conexão
---

# API Contract: Frontend ↔ Backend

Invoque esta skill ao migrar qualquer mock para chamadas reais de API.

> **Correção importante (2026-07-23):** a afirmação "Todos os dados são mock, não há backend" já não é verdade para o domínio Pedidos (comprador). Esse domínio já tem uma implementação real de ports/adapters com endpoints ativos por trás de um feature flag — use-a como referência ao migrar os outros domínios, em vez do checklist genérico abaixo do zero.

---

## Estado atual (por domínio)

**Pedidos (comprador) — já migrado, atrás de feature flag `NEXT_PUBLIC_USE_BACKEND`:**
- `src/lib/ports/order-repository.ts` define a interface `OrderRepository` (`list`, `create`, `cancel`) + erros tipados (`OrderNotFoundError`, `OrderCancelNotAllowedError`, `OrderForbiddenError`).
- `src/lib/adapters/mock-order-repository.ts` e `src/lib/adapters/http-order-repository.ts` implementam a interface; `src/contexts/orders-context.tsx` escolhe qual usar via `process.env.NEXT_PUBLIC_USE_BACKEND === 'true'`.
- `HttpOrderRepository` chama `apiFetch` (`src/lib/api-client.ts`), que injeta `Authorization: Bearer <firebase-id-token>` automaticamente e usa `NEXT_PUBLIC_BACKEND_URL` como base.
- Tipos e validação em runtime vêm de um pacote de contrato compartilhado: `@contracts` → `packages/contracts/src` (monorepo), com schemas Zod (`OrderSchema`, `OrderListSchema`) e tipos (`Order`, `CreateOrderRequest`).
- Endpoints reais em uso:

| Ação | Método | Endpoint |
|---|---|---|
| Listar pedidos | GET | `/orders` |
| Criar pedido | POST | `/orders` |
| Cancelar pedido | PATCH | `/orders/:id/cancel` (409 se status ≠ `aguardando`, 403 se não é do usuário, 404 se não existe) |

- Também existem ports/adapters equivalentes para pagamento e fulfillment (`src/lib/ports/payment.ts`, `src/lib/ports/fulfillment.ts`, `src/lib/adapters/mock-payment-gateway.ts`, `src/lib/adapters/mock-fulfillment-service.ts`) — prováveis do fluxo de checkout. Não auditados em detalhe nesta revisão; confira o `Order Repository` acima como o padrão de referência antes de assumir a shape exata desses outros ports.

**Fornecedor (`src/lib/supplier-mock.ts`) e Catálogo (`src/lib/products.ts`) — ainda 100% mock**, sem port/adapter. Mutações do domínio fornecedor vivem em `src/contexts/market-context.tsx` como `useState` local, com comentários `// TODO: await fetch(...)` marcando os endpoints futuros:

| Dado atual | Método | Endpoint futuro (comentado no código) |
|---|---|---|
| `MOCK_MARKET_ORDERS` (via `/mercado`) | GET | não documentado no código ainda |
| `MOCK_DIRECT_ORDERS` | GET | (sem TODO explícito de listagem) |
| `MOCK_OFFERS` | GET | (sem TODO explícito de listagem) |
| `handleEnviarOferta` | POST | `/api/market-orders/:id/offer` |
| `handleConfirmarDireto` | POST | `/api/direct-orders/:id/confirm` |
| `handleRecusarDireto` | POST | `/api/direct-orders/:id/refuse` |
| `handleAtualizarDespacho` | PATCH | `/api/orders/:id/dispatch` |

| Catálogo (`src/lib/products.ts`) | Método | Endpoint futuro |
|---|---|---|
| `PRODUCTS` | GET | `/api/produtos` (não confirmado no código, apenas convenção) |
| `getProductBySlug(slug)` | GET | `/api/produtos/:slug` |

---

## Tipos que cruzam a fronteira

**Pedidos:** já migrados para `@contracts` (`packages/contracts/src`) — `Order`, `CreateOrderRequest`, com validação Zod em runtime no adapter HTTP. `src/lib/account-mock.ts` mantém sua própria `Order` local (`accountOrderToContractOrder`/`contractOrderToAccountMockOrder` fazem a ponte em `orders-context.tsx`) enquanto a migração completa não acontece — os dois tipos coexistem e não são idênticos hoje (`account-mock.Order` não passa pelo schema Zod diretamente).

**De `supplier-mock.ts` (ainda não migrados):**
```typescript
MockSupplier, MarketOrder, MarketOrderStatus,
DirectOrder, DirectOrderStatus, SupplierOffer, OfferStatus,
DeliveryType, GeoScope, DispatchStatus, PaymentStatus
```

**De `products.ts` (ainda não migrado):**
```typescript
Product, Brand, Size, Badge, ProductCategory, ProductAtributos, ProductFilters
```

---

## Auth

Já implementado para o domínio Pedidos: `src/lib/api-client.ts` lê `auth.currentUser?.getIdToken()` (Firebase, via `src/lib/firebase.ts`) e injeta `Authorization: Bearer <token>` em toda chamada feita com `apiFetch`. Ao migrar outro domínio para API real, reuse `apiFetch` em vez de escrever um novo helper de fetch.

---

## Checklist de conexão (para domínios ainda 100% mock: fornecedor, catálogo)

Siga o padrão já provado em Pedidos em vez de inventar um novo:

1. **Adicionar os tipos do domínio a `packages/contracts/src`** (ou confirmar que já existem lá) — essa é a fonte única de verdade compartilhada com o backend, com schemas Zod.

2. **Criar um port** em `src/lib/ports/<dominio>-repository.ts` com a interface mínima (`list`/`create`/`update`, conforme o domínio) e os erros tipados relevantes.

3. **Criar dois adapters:** `src/lib/adapters/mock-<dominio>-repository.ts` (mantém o comportamento atual) e `src/lib/adapters/http-<dominio>-repository.ts` (usa `apiFetch` de `src/lib/api-client.ts` + valida a resposta com o schema Zod do `@contracts`).

4. **No Context do domínio** (`src/contexts/<dominio>-context.tsx` — criar se não existir), escolher o adapter via `process.env.NEXT_PUBLIC_USE_BACKEND === 'true'`, igual a `orders-context.tsx`.

5. **Adicionar estados de loading e erro** expostos pelo Context, consumidos pelo controller (`page.tsx`) do domínio.

6. **Verificar tratamento de erros:** rede, timeout, 401 (redirecionar para login), 403/404/409 (erros tipados específicos, como em `order-repository.ts`), 500 (mostrar banner de erro).

---

## Nota sobre agentes paralelos

O agente de backend e o agente de frontend podem trabalhar simultaneamente se:
- Frontend agent: cria o port + os dois adapters + o Context do domínio (zona segura até o Context existir — depois, zona de risco, ver `Skill(risk-zone-protocol)`)
- Backend agent: implementa os endpoints reais
- Ponto de sincronização: `packages/contracts/src` — os schemas devem existir e estar acordados antes de disparar os dois agentes.
