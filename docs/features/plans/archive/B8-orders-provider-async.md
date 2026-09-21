# B8 — front/: OrdersProvider assíncrono + loading/erro + flag de backend

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-20) | **Status:** aguardando execução
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B8, dep: B5 e B7 — ambos
APROVADOS). **DEC-A** e **DEC-B** do mesmo arquivo se aplicam diretamente aqui.

## ⚠️ Esta é a tarefa de maior risco da fatia 1

Toca o fluxo de produção real (`/checkout`, `/minha-conta`, cancelamento de pedido) já validado no
navegador pelo cliente. Foi feito um levantamento completo do código atual antes de escrever este
prompt — siga as instruções ao pé da letra, não invente uma abordagem diferente. Se alguma premissa
deste prompt não bater com o código real, PARE e relate — não improvise.

## Objetivo

`OrdersProvider` deixa de ler `INITIAL_ORDERS` direto e passa a carregar pedidos via `OrderRepository`
(mock por padrão, HTTP se `NEXT_PUBLIC_USE_BACKEND=true`). `createOrdersFromCart`/`cancelOrder` viram
assíncronos (DEC-B — é uma mudança de assinatura real, os 3 chamadores precisam de `await`).
`orders-context.tsx` ganha `loading`/`error`; `/minha-conta` mostra estado de carregamento/erro.

## Levantamento já feito (não precisa refazer, só aplicar)

**Chamadores de `createOrdersFromCart`/`cancelOrder`/`useOrders` (únicos 3 arquivos de produção fora do
context):**
- `front/src/app/(main)/checkout/page.tsx:66` — `const orders = createOrdersFromCart(items,
  deliveryAddress)` dentro de `handlePagar` (já é `async`, já tem `try { ... } finally { ... }`, **sem
  `catch`** — precisa ganhar um).
- `front/src/components/minha-conta/OrderCard.tsx:88` — `cancelOrder(order.id)` dentro de
  `handleConfirmCancel` (já é `async`, já tem `try { ... } finally { ... }`, **sem `catch`** — precisa
  ganhar um; `toast` de `sonner` já importado nesse arquivo).
- `front/src/app/(main)/minha-conta/page.tsx:19` — só lê `orders` (lista), não chama mutação. É aqui
  que entra o loading/erro da aba Pedidos.

**Testes afetados (únicos 3 arquivos, confirmado por grep):**
- `front/src/contexts/__tests__/orders-context.test.tsx` — testa o context direto, maior volume de
  mudança (13 `it`s, todos chamam `createOrdersFromCart`/`cancelOrder` de forma síncrona hoje).
- `front/src/app/(main)/checkout/__tests__/page.test.tsx` — usa `<OrdersProvider>` real (não mockado).
- `front/src/components/minha-conta/__tests__/OrderCard.test.tsx` — idem.

**Duas `Order` diferentes (mesma situação da B5, agora na direção inversa):** `OrderRepository` fala o
tipo de `@contracts` (tem `uid`, não tem `offers`). O contexto precisa CONTINUAR expondo o tipo de
`account-mock.ts` pros componentes existentes (não vale a pena/não é o escopo desta tarefa migrar
`OrderCard`/`PedidosTab`/etc. pro tipo novo). Por isso o context faz a ponte inversa da B5.

**`createDirectOrder`: é código morto.** Só é referenciado em `OrderCard.test.tsx` (não em nenhum
componente de produção — sobrou do "flip" S5b/D-023). **Não mexer nele** — deixar exatamente como está
(síncrono, escreve direto no estado local). Fora de escopo mexer/remover.

## Tarefas (nesta ordem)

### 1. Reescrever `front/src/contexts/orders-context.tsx`

```tsx
'use client'

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { Order, Address } from '@/lib/account-mock'
import type { CartItem } from '@/lib/domain/cart'
import { buildOrdersFromCart } from '@/lib/domain/order'
import type { OrderRepository } from '@/lib/ports/order-repository'
import { MockOrderRepository } from '@/lib/adapters/mock-order-repository'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import type { Order as ContractOrder, CreateOrderRequest } from '@contracts'

function contractOrderToAccountMockOrder(order: ContractOrder): Order {
  return {
    id: order.id,
    type: order.type,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    createdAt: order.createdAt,
    price: order.price,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    items: order.items,
  }
}

interface OrdersContextType {
  orders: Order[]
  loading: boolean
  error: string | null
  createDirectOrder: (product: string, quantity: number, deliveryAddress: Address, price: number, supplierId?: string, supplierName?: string) => Order
  createOrdersFromCart: (items: CartItem[], address: Address) => Promise<Order[]>
  cancelOrder: (orderId: string) => Promise<void>
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo: OrderRepository = useMemo(() => {
    const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
    if (useBackend) return new HttpOrderRepository()
    return new MockOrderRepository({
      now: () => new Date().toISOString(),
      idFactory: () => crypto.randomUUID(),
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    repo.list()
      .then((result) => {
        if (cancelled) return
        setOrders(result.map(contractOrderToAccountMockOrder))
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Erro ao carregar pedidos:', err)
        setError('Não foi possível carregar seus pedidos. Tente novamente.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [repo])

  // Codigo morto (sem chamador em producao, sobrou do flip S5b/D-023) - NAO MEXER, fora de escopo B8.
  const createDirectOrder = (
    product: string,
    quantity: number,
    deliveryAddress: Address,
    price: number,
    supplierId?: string,
    supplierName?: string
  ): Order => {
    const newOrderId = `ord-${Date.now()}`
    const newOrder: Order = {
      id: newOrderId,
      type: 'compra-direta',
      product,
      quantity,
      unit: 'un',
      deliveryAddress,
      status: 'aguardando',
      createdAt: new Date().toISOString(),
      price,
      supplierId,
      supplierName,
      items: [{
        productId: `${newOrderId}-p1`,
        productName: product,
        unitPrice: price,
        quantity,
        unit: 'un',
      }],
    }
    setOrders(prev => [...prev, newOrder])
    return newOrder
  }

  const createOrdersFromCart = async (items: CartItem[], address: Address): Promise<Order[]> => {
    let idCounter = 0
    const idFactory = () => {
      idCounter++
      return `tmp-${idCounter}` // descartado - servidor define o id real (RN-03)
    }
    const now = new Date().toISOString()

    // DEC-A: o split por fornecedor continua no front (dominio puro, ja testado, T1).
    const domainOrders = buildOrdersFromCart(items, address, idFactory, now)

    const newOrders: Order[] = []
    for (const domainOrder of domainOrders) {
      const totalQuantity = domainOrder.items.reduce((sum, item) => sum + item.quantity, 0)
      const productField = domainOrder.items.length === 1
        ? domainOrder.items[0].productName
        : `${domainOrder.items.length} itens`

      const createRequest: CreateOrderRequest = {
        product: productField,
        quantity: totalQuantity,
        unit: 'un',
        price: domainOrder.total,
        supplierId: domainOrder.supplierId,
        supplierName: domainOrder.supplierName,
        deliveryAddress: address,
        items: domainOrder.items,
      }

      // DEC-A: uma chamada POST /orders por pedido resultante do split.
      const created = await repo.create(createRequest)
      newOrders.push(contractOrderToAccountMockOrder(created))
    }

    setOrders((prev) => [...prev, ...newOrders])
    return newOrders
  }

  const cancelOrder = async (orderId: string): Promise<void> => {
    const updated = await repo.cancel(orderId)
    const mapped = contractOrderToAccountMockOrder(updated)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? mapped : o)))
  }

  return (
    <OrdersContext.Provider value={{ orders, loading, error, createDirectOrder, createOrdersFromCart, cancelOrder }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error('useOrders deve ser usado dentro de OrdersProvider')
  }
  return context
}
```
Note: `INITIAL_ORDERS` não é mais importado (o seed agora vem do repo, não de uma constante local).

### 2. Modificar `front/src/app/(main)/checkout/page.tsx`
Em `handlePagar`, linha `const orders = createOrdersFromCart(items, deliveryAddress)` vira
`const orders = await createOrdersFromCart(items, deliveryAddress)`. O `try {...} finally {...}` que já
existe ganha um `catch` antes do `finally`:
```ts
} catch (err) {
  console.error('Erro ao finalizar compra:', err)
  toast.error('Não foi possível finalizar a compra. Tente novamente.')
} finally {
  setSubmitting(false)
}
```
Precisa adicionar `import { toast } from 'sonner'` no topo do arquivo (ainda não importado ali).

### 3. Modificar `front/src/components/minha-conta/OrderCard.tsx`
Em `handleConfirmCancel`, linha `cancelOrder(order.id)` vira `await cancelOrder(order.id)`. Adicionar
`catch` antes do `finally` já existente:
```ts
} catch (err) {
  console.error('Erro ao cancelar pedido:', err)
  toast.error('Não foi possível cancelar o pedido. Tente novamente.')
} finally {
  setIsCanceling(false)
}
```
`toast` já está importado nesse arquivo (linha 10) — não precisa adicionar import.

### 4. Modificar `front/src/app/(main)/minha-conta/page.tsx`
Depois da linha `const { orders } = useOrders()`, capturar também `loading`/`error` (renomear pra não
colidir com o `loading` de `useAuth()`, que já existe):
```ts
const { orders, loading: ordersLoading, error: ordersError } = useOrders()
```
Depois do guard existente `if (!user) { return null }`, adicionar (mesmo estilo visual do "Carregando..."
que já existe no arquivo, um estado por vez — não precisa de skeleton animado, o padrão do projeto hoje
é texto simples):
```tsx
if (ordersLoading) {
  return <div className="min-h-screen flex items-center justify-center">Carregando pedidos...</div>
}

if (ordersError) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-brand-muted">{ordersError}</p>
    </div>
  )
}
```

## Testes e verificação (D-008)

### 5. Adaptar os 3 arquivos de teste afetados
Padrão geral: qualquer `act(() => { result.current.createOrdersFromCart(...) })` ou
`act(() => { result.current.cancelOrder(...) })` precisa virar `await act(async () => { ... await
result.current.createOrdersFromCart(...) })`. Qualquer teste que lê `result.current.orders` logo após
`renderHook` (sem esperar o load inicial) precisa de um `await waitFor(() => expect(result.current.loading).toBe(false))`
(ou equivalente `findBy`/`waitFor` do RTL) antes de ler `orders`.

**Não adivinhe os pontos exatos de falha** — rode `npm test -- orders-context` (e os outros 2 arquivos)
DEPOIS da tarefa 1-4, veja o que realmente quebra, e conserte com base no erro real, não numa suposição.
Isso vale pros 3 arquivos: `orders-context.test.tsx`, `checkout/__tests__/page.test.tsx`,
`OrderCard.test.tsx`. Provavelmente o `checkout/page.test.tsx` já usa `waitFor`/`findBy` pra esperar a
tela de confirmação (porque `handlePagar` já tinha `await`s internos antes desta tarefa) — pode ser que
não precise de mudança nenhuma, ou precise de pouca. Confirme rodando, não assuma.

### 6. Comandos, nesta ordem, dentro de `front/`
1. `npm test -- orders-context` — isolado primeiro, ajustar até verde.
2. `npm test -- checkout` — idem.
3. `npm test -- OrderCard` — idem.
4. `npm test` — suíte COMPLETA, esperar **>=285 verde, ZERO regressão** em qualquer teste que não seja
   dos 3 arquivos acima (se algo mais quebrar, é sinal de que o mapeamento contractOrder↔accountMockOrder
   ou a assinatura async vazou pra um lugar não previsto — investigue, não ignore).
5. `npx tsc --noEmit` (ou build) — sem erro de tipo.
6. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas pra cada arquivo de teste problemático, mas o limite é por PROBLEMA
encontrado, não pela tarefa inteira — se travar de verdade em algo específico depois de 3 tentativas
nesse ponto, PARE e relate exatamente o que foi tentado e o erro atual, não pule pra outra abordagem
por conta própria (ex.: não reintroduza `INITIAL_ORDERS` como fallback silencioso, não capture erros de
`repo.list()` sem setar `error`).

## Critérios de aceite

- [ ] `orders-context.tsx`: `orders`/`loading`/`error` + `createOrdersFromCart`/`cancelOrder`
      assíncronos, mapeamento `contractOrderToAccountMockOrder` aplicado em todos os pontos que recebem
      dado do repo.
- [ ] Flag `NEXT_PUBLIC_USE_BACKEND` escolhe `HttpOrderRepository` vs `MockOrderRepository` (default:
      mock, já que a variável não existe neste worktree).
- [ ] `checkout/page.tsx` e `OrderCard.tsx`: `await` nas chamadas + `catch` com `toast.error(...)`.
- [ ] `minha-conta/page.tsx`: estado de loading e erro da aba Pedidos, mesmo estilo visual do loading de
      auth já existente.
- [ ] `createDirectOrder` intocado (código morto, fora de escopo).
- [ ] Os 3 arquivos de teste afetados, verdes, com as mudanças justificadas pelo erro real observado.
- [ ] `npm test` completo verde (>=285), `tsc`/`build`/`lint` exit 0.
- [ ] Nenhum arquivo fora do escopo listado foi tocado (`back/`, `packages/contracts/`,
      `account-mock.ts`, `PedidosTab.tsx`/`HistoricoTab.tsx` — a menos que o teste real exija, e nesse
      caso relatar por quê).

## Restrições

- **Não** mexa em `createDirectOrder`.
- **Não** mude o tipo `Order` de `account-mock.ts` (a ponte é feita só dentro de `orders-context.tsx`).
- **Não** invente skeleton animado/componente novo de UI — texto simples, mesmo padrão já usado no
  projeto pro loading de auth.
- **Não** capture erros silenciosamente — todo `catch` novo precisa setar `error`/mostrar `toast.error`,
  nunca só logar e seguir como se nada tivesse acontecido.
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `feat(front): OrdersProvider assincrono (porta) + loading/erro + flag de backend (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Para cada um dos 3 arquivos de teste: o que quebrou de verdade (erro real, não suposição) e como foi
  corrigido.
- Saída literal de `npm test` (suíte completa), `tsc`/`build`, `lint`.
- Confirmação de que `createDirectOrder` não foi tocado (`git diff` desse trecho vazio).
- Hash do commit.
- Qualquer bloqueio ou decisão de detalhe tomada.
