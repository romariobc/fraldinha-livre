---
name: risk-zone-protocol
description: Protocolo de governança para modificação de arquivos compartilhados — verificação de concorrência, documentação obrigatória e princípio de toque mínimo
---

# Risk Zone Protocol

Invoque esta skill quando sua tarefa exigir modificar qualquer arquivo da **Zona de Risco**.

> Atualizado em 2026-07-23: `src/contexts/` entrou na lista — os providers `Market`/`Orders`/`Cart`/`Auth` são montados no layout raiz e compartilhados entre domínios, exatamente como `src/lib/`.

---

## Zona de Risco — arquivos protegidos

Você está terminantemente proibido de modificar os arquivos abaixo sem seguir este protocolo:

```
src/lib/                          ← tipos e mocks compartilhados entre domínios
src/contexts/                     ← providers compartilhados (Market/Orders/Cart/Auth)
src/components/ui/                ← primitivos base-ui/shadcn usados em tudo
src/components/Header.tsx
src/components/Footer.tsx
src/components/WaveDivider.tsx
src/components/FaqAccordion.tsx
src/app/(main)/layout.tsx
tailwind.config.ts
src/app/globals.css
```

---

## Protocolo (3 passos obrigatórios)

### Passo 1 — Verificação de concorrência

Antes de abrir qualquer arquivo da Zona de Risco para escrita, execute:

```bash
git log -n 5 --pretty=format:"%ai %an — %s" -- <caminho_do_arquivo>
```

**Se houver commits de outro agente ou branch nas últimas 2 horas neste arquivo:**
- PARE imediatamente
- Reporte ao humano: "Detectei atividade recente em `<arquivo>`. Outro agente pode estar trabalhando neste arquivo. Confirme se é seguro prosseguir."
- Aguarde confirmação antes de continuar

### Passo 1.5 — Análise de Dependências (Graphify)

Antes de fazer alterações em estruturas públicas (interfaces, contexts, wrappers globais):
1. Consulte o relatório de dependências em [graphify-out/GRAPH_REPORT.md](file:///graphify-out/GRAPH_REPORT.md) para identificar quais módulos e componentes dependem da abstração que você está prestes a alterar (evitando regressões em outros domínios).
2. Se a mudança no fluxo de dados for complexa ou estrutural, execute a regeneração do grafo de dependências via ferramenta Graphify local para mapear o impacto real do acoplamento antes de iniciar a edição do código.

### Passo 2 — Justificativa documentada

Antes de escrever qualquer linha, responda as três perguntas e inclua as respostas no seu commit message:

1. **Por que** este arquivo compartilhado precisa mudar? (não pode ser resolvido só no domínio isolado?)
2. **Quais domínios** são impactados por esta mudança? (fornecedor / comprador / catálogo / mercado / ...)
3. **O que quebra** se a mudança for aplicada sem os outros domínios serem atualizados?

Formato do commit:
```
chore(shared): <descrição curta da mudança>

Por que: <resposta 1>
Impacto: <resposta 2>
Quebra: <resposta 3>
```

### Passo 3 — Verificação de tipos após a mudança

Após modificar qualquer arquivo da Zona de Risco, execute:

```bash
npx tsc --noEmit
```

**Se TypeScript reportar erros:** corrija-os antes de commitar. Uma mudança em `src/lib/` ou `src/contexts/` pode quebrar componentes de múltiplos domínios.

---

## Princípio do toque mínimo

Faça a **menor mudança possível**:

- Adicionando um tipo novo → adicione sem alterar tipos existentes
- Adicionando um token Tailwind → adicione no final da seção relevante
- Corrigindo um helper → corrija somente o helper, não reescreva o arquivo
- Adicionando um handler novo em um Context → adicione a função e inclua no value do Provider, sem alterar a assinatura dos handlers existentes
- Adicionando uma propriedade opcional → use `?:` para não quebrar consumidores existentes

```typescript
// ✅ Adição segura — propriedade opcional não quebra nada
interface Order {
  // ...campos existentes...
  supplierId?: string   // novo campo opcional
}

// ❌ Adição perigosa — propriedade obrigatória quebra todos os places que criam Order
interface Order {
  // ...campos existentes...
  supplierId: string    // todos os INITIAL_ORDERS e criações de Order falharão no TS
}
```

---

## Casos comuns e como lidar

**Preciso adicionar um helper em `src/lib/supplier-mock.ts`:**
→ Verifique concorrência (Passo 1), adicione no final do arquivo, documente no commit (Passo 2), rode tsc (Passo 3).

**Preciso adicionar um novo token de cor em `tailwind.config.ts`:**
→ Verifique concorrência, adicione na seção `colors` sem remover nenhum token existente, documente, rode tsc.

**Preciso modificar um componente em `src/components/ui/`:**
→ Se for adicionar uma nova prop, torne-a opcional. Se for alterar comportamento existente, verifique todos os usos com `grep` antes de modificar.

**Preciso adicionar um handler ou campo novo em `src/contexts/market-context.tsx` (ou outro Provider):**
→ Verifique quem mais consome o Context com `grep -r "useMarket\|useOrders\|useAuth\|useCart" src/` — já há acoplamento cross-domain conhecido (`OrderCard.tsx` do comprador chama `useMarket().cancelDirectOrder`). Adicione o novo campo/handler sem remover ou renomear os existentes.

**Preciso alterar um tipo que já é usado por múltiplos domínios:**
→ Este é o caso de maior risco. Sempre faça em uma branch separada, nunca em paralelo com outros agentes.
