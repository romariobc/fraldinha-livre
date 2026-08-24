---
name: ui-system
description: Padrões transversais de UI — base-ui quirks, design tokens, tipografia, padrão page→tab→card e armadilhas de hydration
---

# UI System: Padrões Transversais

Invoque esta skill ao criar ou modificar qualquer componente de UI, independente do domínio.

> Verificado contra o código real em 2026-07-23: tokens de design, padrão page→tab→card e o quirk de `data-horizontal` foram confirmados corretos. Único ajuste: os componentes de tabs/select/dialog são importados de `@/components/ui/*` (wrapper local), não direto de `@base-ui/react`.

---

## Padrão arquitetural: page → tab → card

```
page.tsx (controller)
  ├── useState: modal aberto, tab ativa (dados podem vir de Context — ver domain skill)
  ├── handlers: onConfirm, onCancel, onFilter, ...
  ├── Hero com métricas rápidas
  └── <Tabs className="flex-col">           ← className="flex-col" é OBRIGATÓRIO
        ├── <TabsList>
        │     └── <TabsTrigger value="aba1">Aba 1</TabsTrigger>
        └── <TabsContent value="aba1">
              └── <MinhaTab dados={dados} onAcao={handler} />
                    └── <MeuCard item={item} />   ← puramente apresentacional
```

**Regras:**
- Tabs recebem dados + callbacks como props; sem estado próprio (exceto filtros internos de UI).
- Cards não têm lógica de negócio; recebem tudo via props.
- Modais são controlados pelo `page.tsx` via `open` + `onOpenChange`.
- Nos domínios fornecedor e comprador, o `page.tsx` já não é o único dono dos dados — eles vêm de um Context (`useMarket`, `useOrders`, `useAuth`). `useState` local no controller hoje é usado só para UI (tab ativa, filtros). Confirme com a domain skill correspondente antes de assumir onde o estado mora.

---

## `@base-ui/react` — quirks críticos

Os componentes base-ui são consumidos através dos wrappers locais em `src/components/ui/` (`tabs.tsx`, `select.tsx`, `dialog.tsx`, etc.), que já aplicam `cn()`/`cva()` e defaults do projeto. **Importe de `@/components/ui/*`, não direto de `@base-ui/react`.**

### Tabs

```tsx
// ✅ CORRETO — usar className diretamente
<Tabs className="flex-col">

// ❌ ERRADO — o wrapper local já tem "data-horizontal:flex-col" por padrão,
// mas na prática essa variante do base-ui não dispara sozinha (confirmado em
// comentário de código: "Fix: forçar flex-col pois data-horizontal:flex-col
// não dispara com base-ui"). Force sempre className="flex-col" explícito.
```

### Select

```tsx
// onValueChange retorna string | null — SEMPRE null-coalesce
<Select.Root onValueChange={(v) => setState(v ?? '')}>
```

### Dialog / Modal

```tsx
// Controlar com open + onOpenChange — nunca usar defaultOpen
<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
```

### Accordion (FaqAccordion)

Componente existente em `src/components/FaqAccordion.tsx` — reutilizar em vez de criar novo.

---

## Hydration mismatch com `timeAgo()`

`timeAgo()` (de `src/lib/supplier-mock.ts`) usa `Date.now()` — gera valor diferente no SSR vs. cliente. Hoje é usado nos componentes do domínio fornecedor (`DirectOrderCard`, `OfertasMercadoTab`, `LogisticaTab`); o domínio comprador usa um `formatDate` local sem esse problema.

```tsx
// ✅ CORRETO — suppressHydrationWarning no span
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>

// ❌ ERRADO — overhead desnecessário para texto secundário
const [tempo, setTempo] = useState('')
useEffect(() => { setTempo(timeAgo(order.createdAt)) }, [])
```

---

## Design tokens Tailwind

Confirmado contra `tailwind.config.ts`:

| Classe | Valor hex | Uso |
|---|---|---|
| `text-primary` / `bg-primary` | `#5BBFEA` | Azul primário (cotações, links, badges de cotação) |
| `text-primary-dark` / `bg-primary-dark` | `#2A9FD4` | Azul escuro (badges de destaque, textos importantes) |
| `bg-primary-light` | `#E8F6FD` | Fundo azul suave (cards no estado "ofertado") |
| `text-accent` / `bg-accent` | `#F5A623` | Laranja (CTAs de compra direta, destaques de preço) |
| `hover:bg-accent-dark` | `#D4891A` | Hover de botões laranja |
| `text-brand-text` | `#1A2E3B` | Texto principal |
| `text-brand-muted` | `#5A7385` | Texto secundário, labels, metadados |
| `bg-brand-bg` | `#F0F8FD` | Fundo de seções alternadas |

`rounded-card` = `16px`, `shadow-card` = `0 4px 20px rgba(91,191,234,0.12)` (`boxShadow.card` em `tailwind.config.ts`).

---

## Tipografia

```tsx
// Títulos, botões, badges — Nunito
<h2 className="font-display text-2xl font-bold">
<button className="font-display font-semibold">
<span className="font-display text-xs font-medium">

// Textos corridos — Inter (padrão, sem classe necessária)
<p>Texto corrido usa Inter automaticamente.</p>
```

---

## Container

```tsx
// ✅ SEMPRE usar container-fl (classe customizada do projeto, definida em globals.css)
<div className="container-fl mx-auto px-4">

// ❌ NUNCA usar container padrão do Tailwind
<div className="container mx-auto px-4">
```

---

## Cards

- **Border-radius:** sempre `rounded-card` (= 16px)
- **Sombra:** `shadow-card` (sombra azul suave)
- **Estrutura padrão:**
```tsx
<div className="rounded-card shadow-card bg-white p-4">
  {/* conteúdo */}
</div>
```

---

## Ícones

Biblioteca: `lucide-react`

```tsx
import { Package, ChevronRight, CheckCircle } from 'lucide-react'

// Tamanhos padrão
<Icon size={16} />   // badges, inline com texto
<Icon size={20} />   // botões, ações
<Icon size={24} />   // cabeçalhos de seção
```

---

## WaveDivider

```tsx
import WaveDivider from '@/components/WaveDivider'

// Divisor SVG entre seções — aceita className para customizar gradiente
<WaveDivider className="text-brand-bg" />
```

---

## Responsividade

O projeto segue **mobile-first**. Usar breakpoints do Tailwind progressivamente:
- Base: mobile
- `md:` → tablet (768px+)
- `lg:` → desktop (1024px+)

---

## Imports de UI

Componentes de `src/components/ui/` são os primitivos base (`Button`, `Dialog`, `Tabs`, `Select`, `Badge`, `Avatar`, `Checkbox`, `Input`, `Label`, `Separator`, `Sheet`, `Textarea`, `Accordion`). Sempre preferir esses sobre implementar do zero ou importar `@base-ui/react` diretamente.
