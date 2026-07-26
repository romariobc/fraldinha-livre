# C1 — packages/contracts: ProductSchema/CreateProductRequestSchema/UpdateProductRequestSchema

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — seção
"Interfaces canônicas" de `.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (tarefa C1,
dependências: nenhuma).

## Objetivo

Criar em `packages/contracts` os schemas Zod `ProductSchema`, `CreateProductRequestSchema` e
`UpdateProductRequestSchema` (contrato de rede front↔back para produtos). C1 é a raiz da thread C —
back (C2+) e front (C6+) dependem deste contrato. Esta tarefa não toca `back/` nem `front/`.

## Contexto mínimo

- `packages/contracts` já existe (npm workspace), com `src/address.ts`, `src/order.ts`,
  `src/index.ts` (barrel file) — siga exatamente o mesmo padrão de arquivo/teste desses dois.
- Dinheiro sempre em **centavos** (`priceCents`, `z.number().int().nonnegative()`), nunca float.
- Os nomes de campo espelham `front/src/lib/products.ts` (tipos `Product`/`ProductAtributos` atuais)
  — não invente nomes novos, é migração de fonte de dados, não redesenho de schema. Leia esse arquivo
  antes de escrever o schema, para confirmar os nomes e pegar um produto real (ex. `p1`) como fixture
  de teste.
- `CreateProductRequestSchema`/`UpdateProductRequestSchema` NÃO são decisão sua — o servidor sempre
  define `id`/`supplierId`/`active` na criação (nunca vêm do body). Isso é feito via `.omit()`, não
  via validação condicional.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser
`E:/Labdev/Projetos/fraldinha-livre/.claude/worktrees/eloquent-montalcini-2dff41`, NUNCA o repo
principal (`E:\Labdev\Projetos\fraldinha-livre` sem `.claude\worktrees\...`). Se não bater, PARAR e
relatar antes de continuar — não criar nem commitar nada no lugar errado. Este worktree pode estar
sendo usado concorrentemente por outra sessão — rodar `git log --oneline -3` e `git status --short`
antes do commit final, para confirmar que nenhum commit concorrente ficou intercalado.

## Tarefas (nesta ordem)

### 1. Criar `packages/contracts/src/product.ts`
```ts
import { z } from 'zod'

export const ProductAtributosSchema = z.object({
  faixaPeso: z.string(),
  genero: z.literal('unissex'),
  absorcao: z.string(),
  tecnologia: z.string(),
})
export type ProductAtributos = z.infer<typeof ProductAtributosSchema>

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  brand: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  supplierId: z.string(),
  slug: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string(),
  atributos: ProductAtributosSchema,
  badge: z.string().optional(),
  active: z.boolean(),
})
export type Product = z.infer<typeof ProductSchema>
export const ProductListSchema = z.array(ProductSchema)

// Body do POST /products — servidor define id/supplierId/active, nunca vem do body.
export const CreateProductRequestSchema = ProductSchema.omit({ id: true, supplierId: true, active: true })
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>

// Body do PUT /products/:id — tudo opcional exceto o que muda; inclui `active`
// (única forma de editar despublicar/republicar).
export const UpdateProductRequestSchema = CreateProductRequestSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>
```

### 2. Modificar `packages/contracts/src/index.ts`
Adicionar `export * from './product'` (mesmo padrão de `address`/`order`).

### 3. Criar `packages/contracts/src/__tests__/product.test.ts`
Testes Vitest (mesmo padrão de `order.test.ts`), cobrindo:
- `ProductSchema.parse()` aceita um produto real de `front/src/lib/products.ts` (ex. `p1`, com o
  campo `active: true` adicionado ao fixture — o array atual ainda não tem esse campo).
- `ProductSchema` rejeita `priceCents` negativo.
- `ProductSchema` rejeita `atributos.genero` diferente de `'unissex'`.
- `CreateProductRequestSchema.parse()` num body com `id`/`supplierId`/`active` extras **não falha**
  (Zod não é strict por padrão), mas o objeto resultante do `.parse()` **não contém** essas chaves —
  comprove isso com `expect(result).not.toHaveProperty('id')` etc., não só que o parse não lançou.

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd packages/contracts && npm test` — todos os testes verdes, incluindo `product.test.ts` novo e
   os já existentes de `order.test.ts`/`address.ts` (não podem quebrar).
2. `cd packages/contracts && npx tsc --noEmit` — sem erro de tipo.
3. Confirmar que **nenhum arquivo em `back/` ou `front/` foi tocado** (`git status --short` deve
   mostrar mudanças só em `packages/contracts/`).

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise, não mude a abordagem por conta própria. Relate o que falhou, o que tentou
em cada tentativa e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `packages/contracts/src/product.ts` criado, exportando exatamente os schemas/tipos acima (sem
      campos extras não pedidos).
- [ ] `packages/contracts/src/index.ts` re-exporta `product.ts`.
- [ ] `packages/contracts/src/__tests__/product.test.ts` criado e verde, cobrindo os 4 casos listados.
- [ ] `npm test` em `packages/contracts` verde (novos + preexistentes).
- [ ] `npx tsc --noEmit` em `packages/contracts` exit 0.
- [ ] Nenhum arquivo em `back/`/`front/` foi modificado.

## Restrições

- **Não** criar nem modificar nada em `back/` ou `front/` — esta tarefa é só `packages/contracts/`.
- **Não** inventar nomes de campo novos — usar exatamente os de `front/src/lib/products.ts`.
- **Não** usar `any`.
- **Não** decidir arquitetura — se algo parecer exigir uma decisão nova fora do que está escrito
  aqui, PARE e relate a dúvida em vez de decidir sozinho.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(contracts): schemas de Product/CreateProductRequest/UpdateProductRequest (thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados (deve bater exatamente com os critérios de aceite).
- Saída literal dos 3 comandos de verificação (não resumir, colar a saída real).
- Hash do commit criado.
- Qualquer decisão de detalhe tomada dentro do permitido, e qualquer bloqueio, se houver.
