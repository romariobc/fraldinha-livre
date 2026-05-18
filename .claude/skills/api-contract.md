---
name: api-contract
description: Contrato frontend↔backend — mapeamento mock→endpoint REST, tipos que cruzam a fronteira e checklist de conexão
---

# API Contract: Frontend ↔ Backend

Invoque esta skill ao migrar qualquer mock para chamadas reais de API.

---

## Estado atual

Todos os dados são mock em `src/lib/`. Não há backend. Mutações vivem no `useState` do `page.tsx` — não há funções de mutação nos arquivos de mock.

---

## Mapa mock → endpoint REST

### Domínio Fornecedor (`src/lib/supplier-mock.ts`)

| Dado atual | Método | Endpoint futuro |
|---|---|---|
| `MOCK_MARKET_ORDERS` | GET | `/api/fornecedor/mercado` |
| `MOCK_DIRECT_ORDERS` | GET | `/api/fornecedor/diretos` |
| `MOCK_OFFERS` | GET | `/api/fornecedor/ofertas` |
| *(useState local)* | POST | `/api/fornecedor/ofertas` — enviar oferta |
| *(useState local)* | PUT | `/api/fornecedor/diretos/:id` — confirmar/recusar |
| *(useState local)* | POST | `/api/fornecedor/mercado/:id/declinar` |

### Domínio Comprador (`src/lib/account-mock.ts`)

> `INITIAL_ORDERS` é uma única lista com `type: 'cotacao' | 'compra-direta'`. A separação por tipo é feita via `.filter()` no `page.tsx`.

| Dado atual | Método | Endpoint futuro |
|---|---|---|
| `INITIAL_ORDERS` (type: compra-direta) | GET | `/api/comprador/pedidos` |
| `INITIAL_ORDERS` (type: cotacao) | GET | `/api/comprador/cotacoes` |
| `INITIAL_ORDERS` (status: entregue/cancelado) | GET | `/api/comprador/historico` |
| *(useState local)* | POST | `/api/comprador/cotacoes` — criar nova cotação |
| *(useState local)* | POST | `/api/comprador/cotacoes/:id/aceitar` |

### Mercado Global (`src/contexts/market-context.tsx` + `src/lib/supplier-mock.ts`)

> O estado do mercado vive em `MarketContext`. Os handlers já têm `TODO: fetch(...)` inline com a assinatura correta.

| Dado atual | Método | Endpoint futuro |
|---|---|---|
| `MOCK_MARKET_ORDERS` | GET | `/api/mercado/pedidos?scope=<neighborhood\|radius\|city\|national>` |
| `handleEnviarOferta` | POST | `/api/mercado/pedidos/:id/oferta` `{ price, deliveryType, note? }` |
| `handleDeclineMercado` | POST | `/api/mercado/pedidos/:id/declinar` |

### Catálogo (`src/lib/products.ts`)

| Dado atual | Método | Endpoint futuro |
|---|---|---|
| `PRODUCTS` | GET | `/api/produtos` |
| `PRODUCTS.find(p => p.id === id)` | GET | `/api/produtos/:id` |

---

## Tipos que cruzam a fronteira

Hoje os tipos estão nos arquivos de mock. Ao conectar o backend, eles migram para `src/types/api.ts` — a fonte única de verdade de tipos compartilhados. Mock files passam a importar deste arquivo.

**De `supplier-mock.ts`:**
```typescript
MockSupplier, MarketOrder, MarketOrderStatus,
DirectOrder, DirectOrderStatus, SupplierOffer, OfferStatus
```

**De `account-mock.ts`:**
```typescript
Order, OrderType, OrderStatus, Offer, Address, MockUser
```

**De `products.ts`:**
```typescript
Product, Brand, Size, Badge, ProductFilters
```

---

## Auth

Quando auth for implementado, o token JWT vai em todos os requests:

```
Authorization: Bearer <token>
```

O `fetchJson` em `src/lib/api.ts` deve ler o token de `next/headers` (server) ou cookies (client) e injetá-lo automaticamente.

---

## Checklist de conexão

Execute nesta ordem ao migrar um domínio de mock para API real:

1. **Criar `src/types/api.ts`** com os tipos do domínio sendo migrado (importados pelos mocks enquanto coexistirem)

2. **Criar `src/lib/api.ts`** com o helper base:
   ```typescript
   export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
     const res = await fetch(url, {
       ...init,
       headers: {
         'Content-Type': 'application/json',
         // Authorization: `Bearer ${getToken()}` — adicionar quando auth existir
         ...init?.headers,
       },
     })
     if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
     return res.json() as Promise<T>
   }
   ```

3. **No `page.tsx` do domínio**, substituir import do mock por chamada API:
   ```typescript
   // Antes
   import { MOCK_MARKET_ORDERS } from '@/lib/supplier-mock'
   const [orders, setOrders] = useState(MOCK_MARKET_ORDERS)

   // Depois
   const [orders, setOrders] = useState<MarketOrder[]>([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)

   useEffect(() => {
     fetchJson<MarketOrder[]>('/api/fornecedor/mercado')
       .then(setOrders)
       .catch(e => setError(e.message))
       .finally(() => setLoading(false))
   }, [])
   ```

4. **Adicionar estados de loading e erro** na renderização do controller

5. **Remover import do mock** (ou manter como fallback com flag `USE_MOCK=true`)

6. **Verificar tratamento de erros:** rede, timeout (status 0), 401 (redirecionar para login), 500 (mostrar banner de erro)

---

## Nota sobre MarketContext na migração

`MarketContext` (`src/contexts/market-context.tsx`) é o ponto central de migração para `/mercado` e `/fornecedor/painel`. Ao conectar o backend:

1. Substituir os `TODO: fetch(...)` já presentes nos handlers do contexto
2. Adicionar `loading` e `error` state no provider
3. **Não** mover a lógica de volta para `page.tsx` — o contexto permanece como camada de dados

`src/contexts/` é **Zona de Risco** — invoke `Skill(risk-zone-protocol)` antes de modificar.

---

## Nota sobre agentes paralelos

O agente de backend e o agente de frontend podem trabalhar simultaneamente se:
- Frontend agent: trabalha nos componentes e `page.tsx` do domínio (zona segura)
- Backend agent: cria as API Routes em `src/app/api/` (nova zona, sem conflito)
- Ponto de sincronização: `src/types/api.ts` — criar este arquivo primeiro, antes de disparar ambos
