---
name: domain-comprador
description: Contexto completo da área do comprador — tipos, componentes, rotas, regras de negócio e arquivos permitidos
---

# Domain: Área do Comprador (Minha Conta)

Invoque esta skill antes de qualquer ação quando trabalhar em `src/components/minha-conta/` ou `src/app/(main)/minha-conta/`.

---

## Camada de dados

**Arquivo:** `src/lib/account-mock.ts`

**Tipos exportados:**
```typescript
OrderType     // 'cotacao' | 'compra-direta'
OrderStatus   // 'aguardando' | 'ofertas-recebidas' | 'aceito' | 'confirmado'
              //   | 'a-caminho' | 'entregue' | 'cancelado'
Address       // { logradouro, numero, complemento?, bairro, cidade, estado, cep }
MockUser      // { name, email, cpf, address: Address }
Offer         // { id, supplier, price (centavos), deliveryDays, rating }
Order         // { id, type, product, quantity, unit, deliveryAddress,
              //   status, createdAt, price?, offers? }
```

**Constantes exportadas:**
```typescript
MOCK_USER       // MockUser — dados do comprador logado
INITIAL_ORDERS  // Order[] — TODOS os pedidos (cotação + compra direta misturados)
```

**Separação de pedidos é feita via filter no `page.tsx`:**
```typescript
const pedidosAtivos    = orders.filter(o => o.type === 'compra-direta' && o.status !== 'entregue' && o.status !== 'cancelado')
const cotacoesAtivas   = orders.filter(o => o.type === 'cotacao' && o.status !== 'entregue' && o.status !== 'cancelado')
const historico        = orders.filter(o => o.status === 'entregue' || o.status === 'cancelado')
```

---

## Componentes

```
src/components/minha-conta/
  PedidosTab.tsx        ← lista de pedidos de compra direta ativos
  OfertasTab.tsx        ← cotações abertas aguardando ofertas dos fornecedores
  HistoricoTab.tsx      ← pedidos e cotações finalizados (entregue/cancelado)
  PerfilTab.tsx         ← dados do comprador (nome, email, CPF, endereço)
  OrderCard.tsx         ← card de pedido genérico (apresentacional)
  NovoPedidoModal.tsx   ← modal para criar nova cotação: produto + quantidade
```

---

## Rota e arquitetura

- **Controller:** `src/app/(main)/minha-conta/page.tsx`
- `page.tsx` gerencia todo o `useState` (lista de pedidos, modal aberto, etc.)
- Tabs não têm estado próprio; OrderCard é puramente apresentacional
- Tabs usam `@base-ui/react` — sempre `<Tabs className="flex-col">`

---

## Regras de negócio

**Pedidos (Compra Direta):**
- Originados do catálogo; vinculados a um único fornecedor (não há concorrência)
- Flow de status: `aguardando` → `confirmado` → `a-caminho` → `entregue`

**Cotações (Leilão):**
- Comprador cria cotação via NovoPedidoModal → pedido aparece para TODOS os fornecedores no Mercado
- Status evolui: `aguardando` → `ofertas-recebidas` → `aceito` → `a-caminho` → `entregue`
- Quando comprador aceita uma oferta (`aceito`), as demais são recusadas automaticamente (lógica futura)

**NovoPedidoModal:**
- Campos: produto (texto livre), quantidade, unidade (un/cx/kg)
- Ao confirmar, adiciona novo `Order` com `type: 'cotacao'` e `status: 'aguardando'` ao state

---

## Pitfalls críticos

**`INITIAL_ORDERS` é imutável (const):**
Mutações ao state de pedidos no `page.tsx` são feitas via `useState` inicializado com `INITIAL_ORDERS`:
```typescript
const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
```

**timeAgo() se aplicar — mesma regra do domínio fornecedor:**
```tsx
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>
```

---

## Arquivos que este agente PODE tocar

```
✅ src/components/minha-conta/**
✅ src/app/(main)/minha-conta/**
✅ src/lib/account-mock.ts        (cautela: arquivo compartilhado — invoke risk-zone-protocol)
```

## Arquivos que este agente NÃO PODE tocar

```
❌ src/components/ui/**            — primitivos compartilhados
❌ src/components/fornecedor/**    — domínio do fornecedor
❌ src/components/catalogo/**      — domínio do catálogo
❌ tailwind.config.ts              — configuração global
❌ src/app/(main)/layout.tsx       — layout raiz
❌ src/app/globals.css
```

Se precisar alterar qualquer arquivo proibido, invoke `Skill(risk-zone-protocol)` antes.
