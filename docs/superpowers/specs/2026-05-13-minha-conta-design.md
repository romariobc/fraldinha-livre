# Design: Área do Cliente — `/minha-conta`

**Data:** 2026-05-13  
**Status:** Aprovado

---

## Objetivo

Criar a área autenticada do comprador em `/minha-conta`. O usuário pode acompanhar pedidos ativos, visualizar e aceitar ofertas de fornecedores, consultar histórico de compras e gerenciar seu perfil. Dois fluxos de compra coexistem: **pedido de cotação** (busca de preço com fornecedores) e **compra direta** (marketplace).

---

## Arquitetura

Single-page Client Component em `/minha-conta/page.tsx`. Tab ativa controlada por `useState`. Estado global de pedidos (`Order[]`) vive no `page.tsx` e desce via props — sem Context, sem Zustand. Dados mock inicializados em `src/lib/account-mock.ts`. Sem chamadas de rede; toda mutação é local ao estado React.

---

## Modelo de Dados

```ts
// src/lib/account-mock.ts

type OrderType   = 'cotacao' | 'compra-direta'
type OrderStatus =
  | 'aguardando'          // cotação criada, nenhum fornecedor respondeu ainda
  | 'ofertas-recebidas'   // ≥1 oferta disponível para aceitar
  | 'aceito'              // comprador aceitou uma oferta (cotação)
  | 'confirmado'          // compra direta confirmada / pagamento ok
  | 'a-caminho'           // pedido em trânsito
  | 'entregue'            // concluído
  | 'cancelado'           // cancelado

interface Address {
  logradouro: string    // ex: "Av. Paulista"
  numero: string        // ex: "1374"
  complemento?: string  // ex: "Apto 52"
  bairro: string        // ex: "Bela Vista"
  cidade: string        // ex: "São Paulo"
  estado: string        // ex: "SP"
  cep: string           // ex: "01310-100"
}

interface User {
  name: string
  email: string
  cpf: string           // ex: "123.456.789-00" — exibido mascarado no perfil
  address: Address      // endereço de cadastro, source of truth
}

interface Offer {
  id: string
  supplier: string      // nome do fornecedor
  price: number         // em centavos
  deliveryDays: number
  rating: number        // 1–5
}

interface Order {
  id: string
  type: OrderType
  product: string       // ex: "Pampers Supersec M"
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  deliveryAddress: Address  // endereço de entrega deste pedido
  status: OrderStatus
  createdAt: string     // ISO 8601
  price?: number        // centavos — compra-direta ou oferta aceita
  offers?: Offer[]      // presente apenas em cotacao
}

// Dados mock iniciais
export const MOCK_USER: User = { ... }   // Ana Lima, CPF mascarado, endereço SP
export const MOCK_ORDERS: Order[] = [
  // 2 cotações ativas (1 com 2 ofertas, 1 aguardando)
  // 1 compra direta "confirmado"
  // 1 pedido "entregue" (histórico)
  // 1 pedido "cancelado" (histórico)
]
```

---

## Estrutura de Arquivos

```
src/
  app/(main)/minha-conta/
    page.tsx                    ← controller: tab state + orders state
  components/minha-conta/
    AccountTabs.tsx             ← barra de tabs com badge
    PedidosTab.tsx              ← lista de pedidos ativos
    OfertasTab.tsx              ← ofertas agrupadas por pedido
    HistoricoTab.tsx            ← pedidos concluídos/cancelados
    PerfilTab.tsx               ← dados do usuário (read-only)
    NovoPedidoModal.tsx         ← modal: formulário de cotação
    OrderCard.tsx               ← card reutilizável para Pedidos e Histórico
  lib/
    account-mock.ts             ← MOCK_USER, MOCK_ORDERS, tipos exportados
```

---

## Navegação — Tabs

Tabs horizontais no topo da página, abaixo do Header. Implementadas com o componente shadcn `Tabs` já instalado.

| Tab | Ícone | Badge |
|---|---|---|
| Pedidos | 📦 | — |
| Ofertas | 🏷️ | contador de ofertas pendentes |
| Histórico | 📋 | — |
| Perfil | 👤 | — |

Badge na aba Ofertas = soma de `offers.length` de todas as cotações com `status === 'ofertas-recebidas'`.

---

## Aba: Pedidos

**Conteúdo:** `orders.filter(o => o.status !== 'entregue' && o.status !== 'cancelado')`

**Layout:**
1. Botão "＋ Novo Pedido de Cotação" (laranja, topo) → abre `NovoPedidoModal`
2. Lista de `OrderCard` (mais recente primeiro)

**`OrderCard` — campos exibidos:**
- Nome do produto + quantidade + unidade
- Endereço de entrega resumido: `"Av. Paulista, 1374 — São Paulo/SP"`
- Badge de tipo: `Cotação` (azul) | `Compra direta` (laranja)
- Badge de status (ver tabela abaixo)
- Para cotações com `status === 'ofertas-recebidas'`: botão/chip "X ofertas →" que navega para a aba Ofertas

**Badges de status:**

| Status | Cor | Texto |
|---|---|---|
| aguardando | cinza | Aguardando ofertas |
| ofertas-recebidas | laranja | X ofertas recebidas |
| aceito | azul | Oferta aceita |
| confirmado | azul | Confirmado |
| a-caminho | roxo | A caminho |
| entregue | verde | Entregue |
| cancelado | vermelho | Cancelado |

---

## Aba: Ofertas

**Conteúdo:** cotações com `status === 'ofertas-recebidas'`, agrupadas por pedido.

**Layout por grupo:**
- Cabeçalho do grupo: nome do produto + quantidade
- Cards de oferta (um por `Offer`):
  - Nome do fornecedor
  - Preço formatado (`R$ XX,XX`)
  - Prazo de entrega (`X dias`)
  - Estrelas de avaliação (★)
  - Botão "✓ Aceitar"

**Ao aceitar uma oferta:**
1. `order.status` → `'aceito'`
2. `order.price` → `offer.price`
3. Toast de confirmação: `"Oferta da [Fornecedor] aceita! Seu pedido está confirmado."`
4. Tab navega para Pedidos

Se não houver nenhuma oferta pendente: empty state com ícone e texto "Nenhuma oferta pendente no momento."

---

## Aba: Histórico

**Conteúdo:** `orders.filter(o => o.status === 'entregue' || o.status === 'cancelado')`

**Layout:** `OrderCard` simplificado, sem botões de ação:
- Nome do produto + quantidade
- Tipo (badge)
- Data formatada (`DD/MM/YYYY`)
- Valor final (`R$ XX,XX`) — apenas se `price` existir
- Status (badge verde ou vermelho)

Empty state se não houver pedidos concluídos.

---

## Aba: Perfil

**Campos exibidos (read-only):**
- Avatar: círculo com inicial do nome (cor `#5BBFEA`)
- Nome completo
- E-mail
- CPF mascarado: `***.***.789-00` (últimos 5 dígitos visíveis)
- Endereço completo: logradouro, número, complemento, bairro, cidade/UF, CEP

**Botão "Editar perfil"** — presente, não-funcional (protótipo). Exibe toast: `"Edição de perfil em breve."` ao clicar.

---

## Modal: Novo Pedido de Cotação

Abre sobre a página com overlay. Implementado com shadcn `Dialog`.

**Campos:**
| Campo | Tipo | Obrigatório |
|---|---|---|
| Produto | text | sim |
| Quantidade | number (min 1) | sim |
| Unidade | select: un / cx / kg | sim |
| Endereço de entrega | — veja abaixo — | sim |

**UX do endereço de entrega:**

Estado padrão — endereço do cadastro pré-selecionado:
```
📍 Av. Paulista, 1374 — Bela Vista, SP · 01310-100   [✓ Usar este endereço]
                                                        [Usar outro endereço ▾]
```

Ao clicar "Usar outro endereço ▾": expande mini-formulário inline com campos logradouro, número, complemento (opcional), CEP, cidade, estado. CEP preenche cidade/estado com valores mock fixos (sem API).

**Ao submeter (todos os campos válidos):**
1. Cria `Order` com `type: 'cotacao'`, `status: 'aguardando'`, `offers: []`, `deliveryAddress` = endereço selecionado
2. Insere no topo de `orders`
3. Fecha modal
4. Toast: `"Pedido criado! Fornecedores serão notificados em breve."`
5. Tab ativa vai para Pedidos

**Validação:** campos obrigatórios com `required` HTML nativo. Botão submit desabilitado enquanto produto ou quantidade estiverem vazios.

---

## Integração com o restante do projeto

- **Header:** link "Minha Conta" adicionado ao `NAV_LINKS` em `Header.tsx` apontando para `/minha-conta`
- **Auth mock:** `IS_LOGGED_IN` em `auth-mock.ts` permanece `false` por padrão. A página `/minha-conta` não implementa redirect — acesso direto sempre funciona no protótipo
- **Toaster:** usa o `<Toaster>` já presente no root layout; chama `toast.success()` e `toast.error()` via `sonner`
- **Tailwind tokens:** segue os tokens existentes (`primary`, `accent`, `brand-text`, `brand-muted`, etc.)
- **shadcn:** usa `Tabs`, `Dialog`, `Badge`, `Avatar`, `Separator` (todos já instalados)

---

## O que está fora de escopo

- Autenticação real (login/sessão)
- Consulta de CEP via API externa
- Pagamento / checkout de compra direta (só exibição de status)
- Edição de perfil funcional
- Notificações push de novas ofertas
