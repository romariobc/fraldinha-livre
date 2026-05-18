---
name: paralelize
description: Guia de orquestração para paralelização por domínio — mapa de conflitos, merge order e template de prompt para sub-agentes
---

# Paralelização por Domínio

Invoque esta skill antes de decompor qualquer tarefa em sub-agentes paralelos.

---

## Princípio

Sub-agentes rodam em **worktrees isolados** (`isolation: "worktree"` no Agent tool). Cada worktree é uma cópia independente do repo — sem conflito de escrita em tempo real. O risco está no **merge de volta para main**: dois agentes que tocam o mesmo arquivo criarão conflito.

---

## Mapa de conflitos

### 🔴 Zona de Risco — um agente por vez

Arquivos usados por múltiplos domínios. Se dois agentes tocarem qualquer um destes arquivos simultaneamente, **haverá conflito de merge**.

```
src/lib/                          ← mocks de dados compartilhados entre domínios
src/contexts/                     ← estado global (MarketContext usado por /mercado e /fornecedor/painel)
src/components/ui/                ← primitivos base-ui/shadcn usados em tudo
src/components/Header.tsx
src/components/Footer.tsx
src/components/WaveDivider.tsx
src/components/FaqAccordion.tsx
src/app/(main)/layout.tsx         ← layout raiz aplicado a todas as rotas
tailwind.config.ts                ← design tokens globais
src/app/globals.css
```

### 🟢 Zona Segura — paralelização livre

Cada domínio é completamente isolado. Múltiplos agentes podem trabalhar simultaneamente nesses diretórios sem conflito.

```
src/components/fornecedor/   +   src/app/(main)/fornecedor/painel/   → Agente Fornecedor
src/components/mercado/      +   src/app/(main)/mercado/             → Agente Mercado
src/components/minha-conta/  +   src/app/(main)/minha-conta/         → Agente Comprador
src/components/catalogo/     +   src/app/(main)/catalogo/            → Agente Catálogo
src/app/(main)/contato/                                               → Agente Contato
src/app/(main)/login/        +   src/app/(main)/cadastro/            → Agente Auth (futuro)
```

---

## Checklist "pronto para disparar o agente?"

- [ ] A tarefa toca apenas arquivos da zona segura deste domínio?
- [ ] Há outro agente ativo que também toca os mesmos arquivos da zona de risco?
- [ ] O prompt inclui instrução para invocar a domain skill?
- [ ] O prompt lista explicitamente os arquivos proibidos?
- [ ] O prompt especifica todos os arquivos modificados ao terminar?

Se **qualquer item for "não"**, resolva antes de disparar.

---

## Ordem de merge recomendada

1. **Agente que tocou zona de risco** (`src/lib/`, `src/components/ui/`, `tailwind.config.ts`) — merge primeiro
2. **Agentes de domínio isolado** — podem ser mergeados em qualquer ordem entre si
3. Se dois agentes adicionaram tipos em `src/lib/` → resolver conflito manualmente, garantindo que os tipos de ambos sejam preservados

---

## Template de prompt para sub-agente

Use este template ao compor o prompt para qualquer sub-agente:

```
Você está trabalhando no domínio [fornecedor|comprador|catálogo] do projeto Fraldinha Livre.

ANTES DE QUALQUER AÇÃO:
1. Invoke Skill(domain-[domínio]) para carregar o contexto do domínio
2. Invoke Skill(ui-system) se for criar ou modificar componentes de UI

ARQUIVOS QUE VOCÊ PODE TOCAR:
- src/components/[domínio]/**
- src/app/(main)/[rota]/**

ARQUIVOS PROIBIDOS (não modifique):
- src/components/ui/**
- src/lib/ (exceto [arquivo específico do domínio] — com cautela)
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
TAREFA: Adicionar filtro por data na tab Histórico do fornecedor..."

// Prompt Agente 2 (Comprador)
"Você está trabalhando no domínio comprador...
Invoke Skill(domain-comprador) antes de qualquer ação.
TAREFA: Adicionar avaliação de fornecedor após entrega na tab Pedidos..."
```

Esses dois agentes podem rodar simultaneamente — zonas completamente isoladas.

---

## Quando NÃO paralelizar

- A tarefa exige novo design token em `tailwind.config.ts` → fazer sequencialmente
- A tarefa exige novo tipo em `src/lib/` que ambos os domínios vão usar → fazer sequencialmente
- A tarefa modifica `src/components/ui/` → fazer sequencialmente

Se uma tarefa exige zona de risco, conclua-a primeiro e mergeia antes de disparar agentes paralelos.
