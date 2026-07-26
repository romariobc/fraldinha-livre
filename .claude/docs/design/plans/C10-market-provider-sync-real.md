# C10 — front/: `MarketProvider` sync real (`GET /orders?scope=fornecedor`)

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C10 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C7 commit `1543b08` +
C5 commit `2e861d2`, ambas APROVADAS via D-012).

## Skills obrigatórias (AGENTS.md deste repo)

Antes de tocar em qualquer arquivo, invocar `Skill(domain-fornecedor)` (toca `market-context.tsx` e
`fornecedor/painel/page.tsx`) e `Skill(ui-system)` (é trabalho de UI). Se não existirem/carregarem no
seu ambiente, registrar no relatório e seguir o prompt normalmente — não é bloqueio.

## Objetivo

Hoje `directOrders` (pedidos diretos no painel do fornecedor) nasce de `useState(MOCK_DIRECT_ORDERS)`
— array estático, nunca reflete pedidos reais. Esta tarefa faz `MarketProvider` buscar de verdade via
`GET /orders?scope=fornecedor` (C5, já aprovado) **quando `NEXT_PUBLIC_USE_BACKEND=true`**.

## Contexto mínimo — decisões já tomadas (não redecidir)

1. **`marketOrders`/`offers` (`MOCK_MARKET_ORDERS`/`MOCK_OFFERS`) NÃO mudam nesta tarefa** — leilão/
   cotação continua mock (D-007/D-014, inativo). Só `directOrders` é tocado.
2. **Decisão sobre o bridge otimista `orderToDirectOrder`/`addDirectOrder`
   (`front/src/lib/order-adapters.ts` + `front/src/app/(main)/checkout/page.tsx`) — achado da
   sessão-mãe que a spec não cobria, decisão tomada agora:** **MANTIDO exatamente como está, sem
   nenhuma mudança.** Ele é uma UX otimista, ligada a um `supplierId` fixo (`'sup-001'`) hardcoded
   pré-existente — funciona só em modo mock/demo local. Removê-lo é escopo adicional não estritamente
   necessário: o fetch real (`listForSupplier()`, item 3 abaixo) já fecha RN-007-05 de verdade quando
   `NEXT_PUBLIC_USE_BACKEND=true` (o bridge otimista simplesmente não é mais o mecanismo relevante
   nesse modo, mas não conflita com ele — continua rodando sem erro, só fica redundante). **Não tocar
   em `order-adapters.ts` (a função existente) nem no bloco de checkout que a chama.**
3. **Comportamento em modo MOCK (`NEXT_PUBLIC_USE_BACKEND` não é `'true'`): `directOrders` continua
   nascendo de `MOCK_DIRECT_ORDERS`, SEM fetch nenhum, SEM chamar `listForSupplier()`.** Decisão
   explícita: `MOCK_DIRECT_ORDERS` (`front/src/lib/supplier-mock.ts`) é um dataset de demo
   propositalmente rico, desacoplado dos pedidos de comprador (`INITIAL_ORDERS`,
   `front/src/lib/account-mock.ts` — dataset completamente diferente, sem relação de fornecedor real).
   Tentar unificar os dois em cima do `MockOrderRepository` exigiria inventar dados de endereço
   sintéticos sem base real — fora de escopo. `listForSupplier()` ainda precisa existir no
   `MockOrderRepository` (conformidade de interface, ver item 4), mas **não é chamado pelo
   `MarketProvider` em modo mock**.
4. **`MockOrderRepository.listForSupplier()` existe pra satisfazer a interface e ser testável, mesmo
   sem consumidor em modo mock nesta tarefa** (mesmo espírito de C6: camada pronta, sem uso ainda).
   Filtra `this.orders` pelo `supplierId` recebido (novo parâmetro opcional no construtor,
   `undefined` por padrão → lista vazia, não quebra nenhum call site existente que não passa esse
   parâmetro).
5. **`HttpOrderRepository.listForSupplier()` é o caminho que importa de verdade** — chama
   `GET /orders?scope=fornecedor` (mesmo padrão de `list()`, já existente no arquivo).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que os commits de C8/C9
(`8e41af4`/`bb86c2d`) estão no histórico.

## Tarefas (nesta ordem)

### 1. Modificar `front/src/lib/ports/order-repository.ts`
Adicionar ao `interface OrderRepository`:
```ts
listForSupplier(): Promise<Order[]>
```
(Precisa importar `Order` de `@contracts`, se ainda não importado sob esse nome — conferir o arquivo,
já deve ter.) Não mudar mais nada nesse arquivo (erros existentes intocados).

### 2. Modificar `front/src/lib/adapters/mock-order-repository.ts`
- Construtor ganha `supplierId?: string` (opcional, mantém compatibilidade com todos os call sites
  existentes que não passam esse campo — `orders-context.tsx`, testes):
  ```ts
  constructor(options: { now: () => string; idFactory: () => string; seed?: Order[]; supplierId?: string }) {
    this.now = options.now
    this.idFactory = options.idFactory
    this.orders = options.seed ?? INITIAL_ORDERS.map(toContractOrder)
    this.supplierId = options.supplierId
  }
  ```
  (declarar `private supplierId?: string` junto dos outros campos privados).
- Novo método:
  ```ts
  async listForSupplier(): Promise<Order[]> {
    return this.orders.filter((o) => o.supplierId === this.supplierId)
  }
  ```

### 3. Modificar `front/src/lib/adapters/http-order-repository.ts`
Novo método, mesmo padrão exato de `list()` já existente no arquivo:
```ts
async listForSupplier(): Promise<Order[]> {
  const res = await apiFetch('/orders?scope=fornecedor')
  if (!res.ok) throw new Error(`Failed to list supplier orders: HTTP ${res.status}`)
  const json = await res.json()
  return OrderListSchema.parse(json)
}
```
(`OrderListSchema` já está importado no arquivo, usado por `list()`.)

### 4. Adicionar `contractOrderToDirectOrder` em `front/src/lib/order-adapters.ts`
**Não remover nem modificar `orderToDirectOrder` existente** — só adicionar, ao lado, uma função
nova (mapeamento inverso de espírito, mas pra um `Order` de `@contracts`, não de
`@/lib/account-mock`):
```ts
import type { Order as ContractOrder } from '@contracts'
import type { DirectOrderStatus } from '@/lib/supplier-mock'

export function contractOrderToDirectOrder(order: ContractOrder): DirectOrder {
  const status: DirectOrderStatus =
    order.status === 'aguardando' ? 'aguardando' :
    order.status === 'confirmado' ? 'confirmado' : 'cancelado'

  return {
    id: order.id,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit as 'un' | 'cx' | 'kg',
    price: order.price ?? 0,
    buyerCity: order.deliveryAddress.cidade,
    buyerState: order.deliveryAddress.estado,
    createdAt: order.createdAt,
    status,
  }
}
```
Ajustar imports conforme o que já existe no arquivo (`DirectOrder`/`DirectOrderStatus` de
`@/lib/supplier-mock`).

### 5. Modificar `front/src/contexts/market-context.tsx`
- Novos imports: `useEffect`, `useMemo` (de `react`, já deve importar `useState`); `useAuth` **não é
  necessário** (o backend deriva o fornecedor do token, não precisamos do uid aqui);
  `OrderRepository` (tipo), `HttpOrderRepository`, `contractOrderToDirectOrder` de
  `@/lib/order-adapters`.
- `directOrders` deixa de ser só `useState(MOCK_DIRECT_ORDERS)` — vira:
  ```ts
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>(
    useBackend ? [] : MOCK_DIRECT_ORDERS
  )
  const [directOrdersLoading, setDirectOrdersLoading] = useState(useBackend)
  const [directOrdersError, setDirectOrdersError] = useState<string | null>(null)

  useEffect(() => {
    if (!useBackend) return // modo mock: mantem MOCK_DIRECT_ORDERS estatico, sem fetch (decisao item 3)

    let cancelled = false
    const repo: OrderRepository = new HttpOrderRepository()

    const load = async () => {
      if (cancelled) return
      setDirectOrdersLoading(true)
      setDirectOrdersError(null)
      try {
        const result = await repo.listForSupplier()
        if (cancelled) return
        setDirectOrders(result.map(contractOrderToDirectOrder))
      } catch (err) {
        if (cancelled) return
        console.error('Erro ao carregar pedidos diretos:', err)
        setDirectOrdersError('Não foi possível carregar os pedidos diretos. Tente novamente.')
      } finally {
        if (cancelled) return
        setDirectOrdersLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [useBackend])
  ```
- Adicionar `directOrdersLoading`/`directOrdersError` ao `MarketContextValue` (interface) e ao objeto
  passado pro `Provider` (`value={{ ..., directOrdersLoading, directOrdersError }}`).
- **`marketOrders`/`offers`/`declinedIds` e todas as outras funções (`handleEnviarOferta`,
  `handleDeclineMercado`, `handleConfirmarDireto`, `handleRecusarDireto`,
  `handleAtualizarDespacho`, `addDirectOrder`, `cancelDirectOrder`) continuam EXATAMENTE como estão**
  — não mudar a lógica delas, só o estado inicial/carregamento de `directOrders`. `addDirectOrder`/
  `cancelDirectOrder` continuam mutando `directOrders` localmente como já faziam (isso é ortogonal ao
  fetch inicial, não precisa mudar).

### 6. Modificar `front/src/app/(main)/fornecedor/painel/page.tsx`
- Destructure de `useMarket()` ganha `directOrdersLoading`, `directOrdersError`.
- Dentro de `<TabsContent value="diretos">`, antes de renderizar `<PedidosDiretosTab ...>`, tratar
  loading/erro (RN-007-07 — nunca mostrar a lista vazia como se fosse "sem pedidos" enquanto ainda
  está carregando ou deu erro):
  ```tsx
  <TabsContent value="diretos">
    {directOrdersLoading ? (
      <div className="flex items-center justify-center py-16 text-brand-muted">Carregando pedidos...</div>
    ) : directOrdersError ? (
      <div className="flex items-center justify-center py-16 text-red-600">{directOrdersError}</div>
    ) : (
      <PedidosDiretosTab
        orders={directOrders}
        onConfirmar={handleConfirmarDireto}
        onRecusar={handleRecusarDireto}
      />
    )}
  </TabsContent>
  ```
- **Não mudar mais nada nesta página** (outras abas, hero, contadores continuam como estão — os
  contadores que usam `directOrders` no topo da página simplesmente mostram 0 durante o loading em
  modo backend, comportamento aceitável, não precisa de tratamento especial).

### 7. Testes
- `front/src/lib/adapters/__tests__/mock-order-repository.test.ts`: adicionar teste de
  `listForSupplier()` — fornecedor A (seed com `supplierId: 'sup-a'` em alguns pedidos, `'sup-b'` em
  outros) só vê os próprios (RN-02, mesmo espírito do lado comprador já testado).
- `front/src/lib/adapters/__tests__/http-order-repository.test.ts`: adicionar teste de
  `listForSupplier()` na Parte A (mock de fetch simples, confirma a URL `/orders?scope=fornecedor` e
  o parsing da resposta) — não precisa estender a Parte B (contract test) se isso exigir mudar a
  assinatura de `runOrderRepositoryContract`, que não cobre `listForSupplier` hoje; um teste direto
  já é suficiente aqui.
- `front/src/contexts/__tests__/` — se já existir um arquivo de teste de `market-context.tsx`, ler e
  estender (senão, criar um novo, mesmo padrão de `orders-context.backend.test.tsx`): modo mock
  (`NEXT_PUBLIC_USE_BACKEND` não setado) mantém `MOCK_DIRECT_ORDERS`, sem chamar `listForSupplier()`;
  modo backend chama `listForSupplier()` e popula `directOrders` mapeado.

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd front && npm test` — suíte inteira verde.
2. `cd front && npx tsc --noEmit` — exit 0.
3. `cd front && npm run lint` — exit 0 (warning preexistente tolerável).
4. `cd front && npm run build` — sem erro, rotas intactas.
5. Confirmar que `MOCK_MARKET_ORDERS`/`MOCK_OFFERS`/`OfferModal`/`InlineOfferForm` não foram tocados.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não remova/modifique o bridge otimista do checkout (decisão já tomada,
item 2). Relate o que falhou, o que tentou e o estado atual.

## Critérios de aceite

- [ ] `OrderRepository` ganha `listForSupplier()`, implementado em `Mock` e `Http`.
- [ ] Modo mock: `directOrders` continua vindo de `MOCK_DIRECT_ORDERS`, sem fetch.
- [ ] Modo backend: `directOrders` vem de `GET /orders?scope=fornecedor`, com loading/erro explícitos
      no painel.
- [ ] Fornecedor A (mock, teste direto) não vê pedidos do fornecedor B.
- [ ] `order-adapters.ts` e o bloco de checkout que usa `orderToDirectOrder` **intocados**.
- [ ] `marketOrders`/`offers`/leilão intocados.
- [ ] `npm test`/`tsc`/`lint`/`build` em `front/` — todos OK.

## Restrições

- **Não** tocar em `order-adapters.ts` (função existente), `checkout/page.tsx`,
  `OfferModal.tsx`/`InlineOfferForm.tsx`/`MOCK_MARKET_ORDERS`/`MOCK_OFFERS` — decisões já tomadas
  (itens 2 e 1 do contexto).
- **Não** usar `any`. **Não** importar `zod` direto.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(front): MarketProvider carrega pedidos diretos reais via GET /orders?scope=fornecedor (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 5 itens de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido, e qualquer bloqueio.
