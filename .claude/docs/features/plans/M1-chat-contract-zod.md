# M1 — packages/contracts: schema Zod de ChatRequest/ChatResponse

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M1, dep: nenhuma)

## Objetivo

Criar o schema Zod (`packages/contracts`) que descreve a requisição e a resposta de
`POST /chat/message` (feature 018 — chat-agent de compra). Esse contrato é a fonte única de tipos entre
o Worker (`back/`, tarefa M4) e o front (`front/`, tarefas M5/M6) — nenhum dos dois deve redefinir esses
tipos localmente.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser este worktree
(`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`), **NUNCA**
o repo principal (`E:\Labdev\Projetos\fraldinha-livre` sem `.claude\worktrees\...`). Se não bater, PARAR
e relatar antes de continuar — não criar nem commitar nada no lugar errado.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`.
- Pacote: `packages/contracts` (nome real `@fraldinha-livre/contracts`, ver `package.json` do pacote —
  não usar `@contracts` nem nenhum outro nome inventado nos imports).
- Padrão a copiar exatamente:
  - `packages/contracts/src/product.ts` — como um schema de domínio é declarado (schema base, `type`
    inferido via `z.infer`, schemas derivados com `.omit`/`.partial` quando fizer sentido).
  - `packages/contracts/src/index.ts` — como cada schema novo é reexportado (`export * from './<arquivo>'`,
    um por linha, ordem alfabética não é obrigatória mas siga o padrão do arquivo).
  - `packages/contracts/src/__tests__/product.test.ts` — como os testes de um schema são escritos
    (`describe`/`it`, `safeParse`, casos válidos e casos que devem falhar), e onde o arquivo de teste
    mora (`src/__tests__/<nome>.test.ts`, importando de `'../index'`, não do arquivo direto).
- Este schema descreve o corpo de `POST /chat/message` (rota que será criada na tarefa M4, **não** faça
  parte desta tarefa) e a resposta dela. Não crie a rota, não crie nada em `back/` ou `front/` — esta
  tarefa é só `packages/contracts`.

## Tarefas (nesta ordem)

### 1. Criar `packages/contracts/src/chat.ts`

```ts
import { z } from 'zod'

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  image: z.string().optional(),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const ChatTextResponseSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
})
export type ChatTextResponse = z.infer<typeof ChatTextResponseSchema>

export const ChatActionResponseSchema = z.object({
  type: z.literal('action'),
  action: z.literal('select_product'),
  productId: z.string(),
  quantity: z.number().int().positive(),
})
export type ChatActionResponse = z.infer<typeof ChatActionResponseSchema>

export const ChatResponseSchema = z.union([ChatTextResponseSchema, ChatActionResponseSchema])
export type ChatResponse = z.infer<typeof ChatResponseSchema>
```

Comentários no arquivo: **não adicione nenhum** além do que já está acima — o código já é
autoexplicativo (nomes claros); só descreveria o que o código já diz.

### 2. Modificar `packages/contracts/src/index.ts`

Adicionar a linha de reexport do novo arquivo, no mesmo padrão das existentes:
```ts
export * from './chat'
```
(Confira o arquivo real antes de editar — a ordem/posição exata das linhas existentes não deve mudar,
só adicionar esta.)

### 3. Criar `packages/contracts/src/__tests__/chat.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { ChatRequestSchema, ChatResponseSchema } from '../index'

describe('ChatRequestSchema', () => {
  it('aceita uma mensagem de usuário sem foto', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'preciso de fralda tamanho M' }],
    })
    expect(result.success).toBe(true)
  })

  it('aceita com foto (data URL base64)', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'essa aqui' }],
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita messages vazio', () => {
    const result = ChatRequestSchema.safeParse({ messages: [] })
    expect(result.success).toBe(false)
  })

  it('rejeita role fora de user/assistant', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'system', content: 'oi' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita content vazio', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: '' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('ChatResponseSchema', () => {
  it('faz parse de uma resposta de texto', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'text',
      content: 'qual marca voce prefere?',
    })
    expect(result.success).toBe(true)
  })

  it('faz parse de uma acao select_product', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita quantity zero ou negativo', () => {
    const zero = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 0,
    })
    const negativo = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: -1,
    })
    expect(zero.success).toBe(false)
    expect(negativo.success).toBe(false)
  })

  it('rejeita quantity não inteiro', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita type fora de text/action', () => {
    const result = ChatResponseSchema.safeParse({ type: 'oops', content: 'x' })
    expect(result.success).toBe(false)
  })
})
```

## Testes e verificação (D-008)

Dentro de `packages/contracts`, nesta ordem:
1. `npm test` — todos os testes verdes, incluindo os novos de `chat.test.ts` (`order.test.ts` e
   `product.test.ts` continuam passando sem nenhuma mudança — esta tarefa não toca neles).
2. `npx tsc --noEmit` — sem erro de tipo.

Se o pacote não tiver `tsc`/lint configurado separadamente do resto do monorepo, rode a partir da raiz
do worktree o equivalente (`npm run -w packages/contracts test`, ou o comando que o `package.json` da
raiz definir — confira antes de assumir).

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade, PARE e relate o
obstáculo exato — não invente um workaround.

## Critérios de aceite

- [ ] `packages/contracts/src/chat.ts` criado, exatamente como especificado no passo 1.
- [ ] `packages/contracts/src/index.ts` reexporta `./chat`.
- [ ] `packages/contracts/src/__tests__/chat.test.ts` com os 10 casos acima (5 de `ChatRequestSchema`,
      5 de `ChatResponseSchema`), todos verdes.
- [ ] `npm test` completo do pacote verde (novos + existentes); `tsc` exit 0.
- [ ] Nenhum arquivo fora de `packages/contracts/` modificado (não tocar em `back/`, `front/`).
- [ ] Nenhum comentário supérfluo adicionado ao `chat.ts` (código autoexplicativo, sem `// cria X`).

## Restrições

- **Não** crie a rota `/chat/message` nem qualquer arquivo em `back/` — isso é a tarefa M4.
- **Não** crie nada em `front/` — isso são as tarefas M5/M6.
- **Não** use `any`.
- **Não** invente um nome de pacote diferente de `@fraldinha-livre/contracts` nos imports de outros
  lugares (esta tarefa não importa o pacote de lugar nenhum, mas se algum exemplo de código de tarefas
  futuras aparecer com `@contracts/...`, é um erro de digitação do plano — não repita esse erro aqui).
- Commit em português, Conventional Commits, mensagem:
  `feat(contracts): schema Zod de ChatRequest/ChatResponse (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal de `npm test` e `tsc --noEmit`.
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio ou decisão de detalhe tomada (ex.: como rodar `tsc` se não houver script dedicado).
