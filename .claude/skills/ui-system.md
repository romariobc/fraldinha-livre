---
name: ui-system
description: Padrões transversais de UI — base-ui quirks, design tokens, tipografia, padrão page→tab→card e armadilhas de hydration
---

# UI System: Padrões Transversais

Invoque esta skill ao criar ou modificar qualquer componente de UI, independente do domínio.

---

## Padrão arquitetural: page → tab → card

```
page.tsx (controller)
  ├── useState: dados, modal aberto, tab ativa
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
- `page.tsx` é o único dono do estado (`useState`)
- Tabs recebem dados + callbacks como props; sem estado próprio (exceto filtros internos de UI)
- Cards não têm lógica de negócio; recebem tudo via props
- Modais são controlados pelo `page.tsx` via `open` + `onOpenChange`

---

## `@base-ui/react` — quirks críticos

### Tabs

```tsx
// ✅ CORRETO — usar className diretamente
<Tabs className="flex-col">

// ❌ ERRADO — base-ui emite data-orientation="horizontal", NÃO data-horizontal
<Tabs className="data-horizontal:flex-col">
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

`timeAgo()` usa `Date.now()` — gera valor diferente no SSR vs. cliente.

```tsx
// ✅ CORRETO — suppressHydrationWarning no span
<span suppressHydrationWarning>{timeAgo(order.createdAt)}</span>

// ❌ ERRADO — overhead desnecessário para texto secundário
const [tempo, setTempo] = useState('')
useEffect(() => { setTempo(timeAgo(order.createdAt)) }, [])
```

---

## Design tokens Tailwind

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
// ✅ SEMPRE usar container-fl (classe customizada do projeto)
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

Componentes de `src/components/ui/` são os primitivos base (`Button`, `Dialog`, `Tabs`, `Select`, `Badge`). Sempre preferir esses sobre implementar do zero.
