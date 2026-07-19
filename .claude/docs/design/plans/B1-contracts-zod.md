# B1 — packages/contracts: schemas Zod de Order/OrderItem/Address

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-pedidos-cloudflare.md` (APROVADA) — seção "Interfaces canônicas"
do `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B1, dependências: nenhuma).

## Objetivo

Criar o pacote `packages/contracts` com os schemas Zod (`Address`, `OrderItem`, `Order`,
`CreateOrderRequest`) que serão o seam de tipos compartilhado entre o front e o futuro Worker
(`back/`, ainda não existe — não criar nesta tarefa). Isso destrava todo o resto da thread B.

## Contexto mínimo

- Monorepo (D-005): `front/` já existe; `packages/` é novo; `back/` vem em B2 (não mexer aqui).
- Dinheiro sempre em **centavos** (INTEGER).
- D-026/D-027 (Cloudflare Workers + D1) já estão decididos — **não redecidir arquitetura, não propor
  alternativas**. Esta tarefa é só a camada de contratos.
- **Não existe ainda `packages/` no repo nem workspaces npm no root.** Não criar `package.json` na
  raiz nem configurar npm workspaces — isso é decisão fora do escopo de B1. A ligação front↔contracts
  nesta tarefa é feita por **path alias do TypeScript/Vite** (não por resolução de pacote npm).
- **Camada distinta da que já existe:** `front/src/lib/domain/order.ts` já tem tipos TS puros
  (`DomainOrder`, `OrderItem`) para lógica interna do front — **não mexer nesse arquivo**. O que você
  cria aqui é o schema Zod do **contrato de rede** (front↔Worker), uma camada diferente e paralela.
  Os nomes se parecem de propósito (mesmo domínio), mas os arquivos não se importam um do outro nesta
  tarefa.

## Tarefas (nesta ordem)

### 1. Criar `packages/contracts/package.json`
```json
{
  "name": "@fraldinha-livre/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^3.2.7",
    "typescript": "^5"
  }
}
```
Ajustar a versão do `zod` para a última 3.x estável disponível via `npm install` se `^3.23.0` não
resolver (não usar Zod 4 — API diferente, fora de escopo decidir essa migração aqui).

### 2. Criar `packages/contracts/tsconfig.json`
Só para type-check do pacote isoladamente (não precisa emitir build):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

### 3. Criar `packages/contracts/src/address.ts`
```ts
import { z } from 'zod'

export const AddressSchema = z.object({
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().length(2),
  cep: z.string().min(1),
})
export type Address = z.infer<typeof AddressSchema>
```

### 4. Criar `packages/contracts/src/order.ts`
```ts
import { z } from 'zod'
import { AddressSchema } from './address'

export const OrderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(), // centavos
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const OrderStatusSchema = z.enum([
  'aguardando', 'ofertas-recebidas', 'aceito', 'confirmado', 'a-caminho', 'entregue', 'cancelado',
])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderSchema = z.object({
  id: z.string(),
  uid: z.string(),
  type: z.literal('compra-direta'),
  status: OrderStatusSchema,
  product: z.string(),
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  deliveryAddress: AddressSchema,
  createdAt: z.string(), // ISO 8601
  items: z.array(OrderItemSchema),
})
export type Order = z.infer<typeof OrderSchema>

// Body do POST /orders — o cliente NAO envia id/uid/createdAt/status (servidor define, RN-03).
// Zod ignora chaves desconhecidas por padrao (nao-strict): se o body vier com id/uid/status,
// eles sao descartados no parse — o servidor sempre usa os seus proprios valores.
export const CreateOrderRequestSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  deliveryAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1),
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>
```

### 5. Criar `packages/contracts/src/index.ts`
Re-exportar tudo de `./address` e `./order` (barrel file).

### 6. Modificar `front/tsconfig.json`
Adicionar em `compilerOptions.paths` (manter o `@/*` existente):
```json
"@contracts/*": ["../packages/contracts/src/*"]
```

### 7. Modificar `front/vitest.config.ts`
Adicionar em `resolve.alias` (manter o `@` existente), seguindo o MESMO padrão de
`fileURLToPath(new URL(...))` já usado ali:
```ts
'@contracts': fileURLToPath(new URL('../packages/contracts/src', import.meta.url)),
```

### 8. Criar `packages/contracts/src/__tests__/order.test.ts`
Testes Vitest cobrindo (rodar dentro de `packages/contracts`, `npm test`):
- `AddressSchema`: parse válido de um endereço completo; rejeita `estado` com mais/menos de 2
  caracteres.
- `OrderItemSchema`: parse válido; rejeita `unitPrice` negativo; rejeita `quantity` zero ou negativo.
- `OrderSchema`: parse válido de um pedido completo com `items` não-vazio.
- `CreateOrderRequestSchema`: parse válido; rejeita `items: []` (vazio); **teste que documenta** que
  um body com `id`/`uid`/`status` extras faz `parse` funcionar normalmente e o resultado (`.parse(...)`)
  NÃO contém essas chaves (comprovando que o servidor, não o cliente, define esses campos — RN-03).

### 9. Criar `front/src/lib/__tests__/contracts-alias.test.ts`
Teste mínimo, SEM tocar em nenhum componente/UI, só para provar que o alias `@contracts` resolve em
runtime (vitest) e em type-check (tsc) a partir do `front/`:
```ts
import { describe, it, expect } from 'vitest'
import { AddressSchema } from '@contracts'

describe('alias @contracts resolve a partir do front', () => {
  it('importa e valida um endereco', () => {
    const result = AddressSchema.safeParse({
      logradouro: 'Rua X', numero: '1', bairro: 'Centro',
      cidade: 'Sao Paulo', estado: 'SP', cep: '01000-000',
    })
    expect(result.success).toBe(true)
  })
})
```

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd packages/contracts && npm install && npm test` — todos os testes de `order.test.ts` verdes.
2. `cd front && npm test` — suíte inteira (≥258 testes preexistentes + o novo
   `contracts-alias.test.ts`) verde. **Nenhum teste existente pode quebrar.**
3. `cd front && npx tsc --noEmit` (ou `npm run build`) — sem erro de tipo, prova que `@contracts`
   resolve para o TypeScript do front.
4. `cd front && npm run lint` — exit 0.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS.
Após a 3ª falha: PARE. Não improvise, não mude a abordagem por conta própria (ex.: não introduza npm
workspaces, não altere Zod para v4, não toque em `front/src/lib/domain/order.ts`). Relate o que falhou,
o que tentou em cada tentativa e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `packages/contracts/src/{address,order,index}.ts` criados, exportando exatamente os schemas e
      tipos acima (sem campos extras não pedidos).
- [ ] `packages/contracts/src/__tests__/order.test.ts` verde, cobrindo os casos listados no passo 8.
- [ ] `front/tsconfig.json` tem o path alias `@contracts/*` novo, e o `@/*` existente **não foi
      removido nem alterado**.
- [ ] `front/vitest.config.ts` tem o alias `@contracts` novo, e o `@` existente **não foi alterado**.
- [ ] `front/src/lib/__tests__/contracts-alias.test.ts` criado e verde.
- [ ] Suíte completa do `front` (`npm test`) verde, incluindo os 258+ testes preexistentes.
- [ ] `front`: `tsc --noEmit`/`build` e `lint` — exit 0.
- [ ] Nenhum arquivo fora da lista acima foi modificado (nada em `back/`, `legacy/`, `.claude/`, ou
      componentes/telas do front).

## Restrições

- **Não** criar `back/` nem `packages/*` além de `contracts/`.
- **Não** criar `package.json`/workspaces na raiz do repo.
- **Não** modificar `front/src/lib/domain/order.ts`, `front/src/lib/account-mock.ts`,
  `front/src/contexts/orders-context.tsx` — essas mudanças são de tarefas posteriores (B5+).
- **Não** decidir arquitetura (D-026/D-027 já fechados). Se algo parecer exigir uma decisão nova,
  PARE e relate a dúvida em vez de decidir sozinho.
- **Não** usar `any`.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(contracts): schemas Zod de Order/OrderItem/Address (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados (deve bater exatamente com os critérios de aceite).
- Saída literal dos 4 comandos de verificação (não resumir, colar a saída real).
- Hash do commit criado.
- Qualquer decisão de detalhe que você tomou dentro do permitido (ex.: mensagem exata de um teste) e
  qualquer bloqueio, se houver.
