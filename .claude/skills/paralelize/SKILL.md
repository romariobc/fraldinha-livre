---
name: paralelize
description: Guia de orquestração para paralelização por domínio — mapa de conflitos, merge order e template de prompt para sub-agentes
---

# Paralelização por Domínio

Invoque esta skill antes de decompor qualquer tarefa em sub-agentes paralelos.

> Revisado em 2026-07-23: `src/contexts/` (providers `Market`/`Orders`/`Cart`/`Auth`, montados no layout raiz) é zona de risco tão crítica quanto `src/lib/` e não estava na lista original. `login`/`cadastro`/`onboarding` já existem, mas como rotas de nível superior (`src/app/login`, não `src/app/(main)/login`) — fora do layout compartilhado do grupo `(main)`.

---

## Princípio

Sub-agentes rodam em **worktrees isolados** (`isolation: "worktree"` no Agent tool). Cada worktree é uma cópia independente do repo — sem conflito de escrita em tempo real. O risco está no **merge de volta para main**: dois agentes que tocam o mesmo arquivo criarão conflito.

---

## Mapa de conflitos

### 🔴 Zona de Risco — um agente por vez

Arquivos usados por múltiplos domínios. Se dois agentes tocarem qualquer um destes arquivos simultaneamente, **haverá conflito de merge**.

```
src/lib/                          ← mocks, tipos e helpers compartilhados entre domínios
src/contexts/                     ← providers compartilhados (Market/Orders/Cart/Auth), montados no layout raiz
src/components/ui/                ← primitivos base-ui/shadcn usados em tudo
src/components/Header.tsx
src/components/Footer.tsx
src/components/WaveDivider.tsx
src/components/FaqAccordion.tsx
src/app/(main)/layout.tsx         ← layout raiz aplicado a todas as rotas de (main)
tailwind.config.ts                ← design tokens globais
src/app/globals.css
```

### 🟢 Zona Segura — paralelização livre

Cada domínio é completamente isolado. Múltiplos agentes podem trabalhar simultaneamente nesses diretórios sem conflito.

```
src/components/fornecedor/   +   src/app/(main)/fornecedor/    → Agente Fornecedor
src/components/minha-conta/  +   src/app/(main)/minha-conta/   → Agente Comprador
src/components/catalogo/     +   src/app/(main)/catalogo/      → Agente Catálogo
src/components/mercado/      +   src/app/(main)/mercado/       → Agente Mercado
src/app/(main)/contato/                                         → Agente Contato
src/app/(main)/checkout/    +    src/app/(main)/sacola/        → Agente Checkout
src/app/(main)/produto/                                         → Agente Produto (página de detalhe)
src/app/login/  +  src/app/cadastro/  +  src/app/onboarding/   → Agente Auth (fora do grupo (main), sem Header/Footer compartilhado)
```

Não há domain skill dedicada para mercado/checkout/produto/auth ainda — se for despachar um agente para essas áreas, ao menos invoque `Skill(ui-system)` e liste os arquivos permitidos manualmente seguindo o padrão desta tabela.

---

## Checklist "pronto para disparar o agente?"

- [ ] A tarefa toca apenas arquivos da zona segura deste domínio?
- [ ] Há outro agente ativo que também toca os mesmos arquivos da zona de risco?
- [ ] O prompt inclui instrução para invocar a domain skill (quando existir)?
- [ ] O prompt lista explicitamente os arquivos proibidos?
- [ ] O prompt especifica todos os arquivos modificados ao terminar?

Se **qualquer item for "não"**, resolva antes de disparar.

---

## Ordem de merge recomendada

1. **Agente que tocou zona de risco** (`src/lib/`, `src/contexts/`, `src/components/ui/`, `tailwind.config.ts`) — merge primeiro
2. **Agentes de domínio isolado** — podem ser mergeados em qualquer ordem entre si
3. Se dois agentes adicionaram tipos em `src/lib/` ou um handler novo em `src/contexts/` → resolver conflito manualmente, garantindo que ambos sejam preservados

---

## Template de prompt para sub-agente

Use este template ao compor o prompt para qualquer sub-agente:

```
Você está trabalhando no domínio [fornecedor|comprador|catálogo|mercado|...] do projeto Fraldinha Livre.

ANTES DE QUALQUER AÇÃO:
1. Invoke Skill(domain-[domínio]) para carregar o contexto do domínio, se existir
2. Invoke Skill(ui-system) se for criar ou modificar componentes de UI

ARQUIVOS QUE VOCÊ PODE TOCAR:
- src/components/[domínio]/**
- src/app/(main)/[rota]/**

ARQUIVOS PROIBIDOS (não modifique):
- src/components/ui/**
- src/lib/ (exceto [arquivo específico do domínio] — com cautela)
- src/contexts/ (exceto leitura via hooks já existentes — com cautela)
- tailwind.config.ts, src/app/(main)/layout.tsx, src/app/globals.css

TAREFA:
[Descrição concreta e autocontida da tarefa. Inclua: o que criar/modificar, como deve funcionar, quais componentes existentes reutilizar.]

AO TERMINAR:
- Liste todos os arquivos criados ou modificados
- Se tocou algum arquivo da zona de risco, explique por quê
```

---

## Exemplo: paralelizando fornecedor + comprador

```
// Prompt Agente 1 (Fornecedor)
"Você está trabalhando no domínio fornecedor...
Invoke Skill(domain-fornecedor) antes de qualquer ação.
TAREFA: Adicionar filtro por data na tab Logística do fornecedor..."

// Prompt Agente 2 (Comprador)
"Você está trabalhando no domínio comprador...
Invoke Skill(domain-comprador) antes de qualquer ação.
TAREFA: Adicionar avaliação de fornecedor após entrega na tab Pedidos..."
```

Esses dois agentes podem rodar simultaneamente — zonas completamente isoladas. Atenção: `OrderCard.tsx` (comprador) e `market-context.tsx` (fornecedor) já têm um acoplamento direto (`cancelDirectOrder`) — se a tarefa de qualquer um dos dois mexer nesse contrato, não paralelize.

---

## Quando NÃO paralelizar

- A tarefa exige novo design token em `tailwind.config.ts` → fazer sequencialmente
- A tarefa exige novo tipo em `src/lib/` que ambos os domínios vão usar → fazer sequencialmente
- A tarefa exige novo handler ou campo em `src/contexts/` compartilhado entre domínios → fazer sequencialmente
- A tarefa modifica `src/components/ui/` → fazer sequencialmente

Se uma tarefa exige zona de risco, conclua-a primeiro e mergeia antes de disparar agentes paralelos.
