# M4 — back/: rota POST /chat/message (tool-loop)

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M4, dep: M1, M2, M3 — todas APROVADAS)

## Objetivo

Criar a rota `POST /chat/message`: recebe o histórico de mensagens do comprador, roda um loop de
tool-use contra o `RunChatCompletion` (M2) usando as tools de catálogo (M3), e devolve pro front uma de
duas coisas — texto (a conversa continua) ou uma ação estruturada `select_product` (o modelo decidiu
qual produto/quantidade comprar). Esta tarefa fecha o backend inteiro da feature 018; depois dela só
falta o front (M5/M6) e o deploy (M7).

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser este worktree
(`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`), **NUNCA**
o repo principal. Se não bater, PARAR e relatar antes de continuar.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\fraldinha-livre-app-strategy-309c5a`.
- **O que já existe e esta tarefa CONSOME sem modificar:**
  - `back/src/lib/chat-completion.ts` (M2) — `RunChatCompletion`, `ChatCompletionMessage`,
    `ChatCompletionTool`, `ChatCompletionToolCall`, `ChatCompletionResult`, `createWorkersAiChatCompletion`.
  - `back/src/lib/chat-tools.ts` (M3) — `searchProducts(db, query)`, `getProduct(db, productId)`.
  - `packages/contracts/src/chat.ts` (M1) — `ChatRequestSchema`, `ChatResponse` (tipo).
  - `back/src/middleware/auth.ts` — `createAuthMiddleware`, `verifyFirebaseIdToken` (mesmo par usado
    por `/orders/*` e por `/products` autenticado).
- **Padrão a copiar exatamente:**
  - `back/src/routes/orders.ts`, função `ordersGetHandler` — como um handler autenticado é tipado
    (`Context<{ Bindings: Env; Variables: AppContext['Variables'] }>`) e como `c.get('uid')` é lido.
  - `back/src/routes/orders.ts`, topo do arquivo — como esse arquivo importa um schema de
    `packages/contracts` via caminho **relativo** (`../../../packages/contracts/src/order`), **NÃO**
    pelo nome do pacote `@fraldinha-livre/contracts` (esse nome não é usado dentro de `back/` em
    nenhum lugar — `back/package.json` nem declara `packages/contracts` como dependência). Copie
    exatamente esse estilo de import pro `chat.ts`.
  - `back/src/index.ts` — como cada rota é montada, com middleware de auth condicional por
    `app.use('/rota/*', ...)` antes do `app.get`/`app.post` correspondente (ver os blocos de
    `/orders/*` e `/products/:id`).
  - `back/test/products.get.test.ts`, função `createTestApp` — como um teste monta um Hono app de
    teste próprio com `createAuthMiddleware(fakeVerify)` (fake que reconhece um token fixo), em vez de
    tentar mockar o JWKS real do Firebase. Use o MESMO padrão pros testes desta tarefa.
- **Regra de saída (já decidida na spec, não é escolha desta tarefa):** a tool
  `select_product_for_purchase` **não é uma tool de dados** — quando o modelo a chama, a rota PARA o
  loop e responde a ação estruturada, sem chamar `runChatCompletion` de novo.

## Tarefas (nesta ordem)

### 1. Criar `back/src/routes/chat.ts`

```ts
import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { ChatRequestSchema } from '../../../packages/contracts/src/chat'
import type { ChatResponse } from '../../../packages/contracts/src/chat'
import type {
  RunChatCompletion,
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionToolCall,
} from '../lib/chat-completion'
import { searchProducts, getProduct } from '../lib/chat-tools'
import type { Env, AppContext } from '../env'

const SYSTEM_PROMPT =
  'Voce e o assistente de compras da Fraldinha Livre. Ajude o comprador a achar o produto certo ' +
  'no catalogo (fraldas e itens relacionados), perguntando marca/tamanho quando precisar. Use ' +
  'search_products e get_product para consultar o catalogo real - nunca invente produto, preco ou ' +
  'id. So chame select_product_for_purchase quando tiver certeza do productId e da quantidade.'

const TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description: 'Busca produtos do catalogo por nome, marca ou categoria',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Detalhe de um produto pelo id',
    parameters: {
      type: 'object',
      properties: { productId: { type: 'string' } },
      required: ['productId'],
    },
  },
  {
    name: 'select_product_for_purchase',
    description:
      'Chame quando tiver certeza de qual produto (productId real do catalogo) e quantidade o ' +
      'comprador quer comprar',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: ['productId', 'quantity'],
    },
  },
]

const MAX_TOOL_ITERATIONS = 4

export function createChatHandler(runChatCompletion: RunChatCompletion) {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'payload invalido' }, 400)
    }

    const db = drizzle(c.env.DB)
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
    ]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await runChatCompletion(messages, TOOLS)

      const selectCall = result.toolCalls.find((call) => call.name === 'select_product_for_purchase')
      if (selectCall) {
        const response: ChatResponse = {
          type: 'action',
          action: 'select_product',
          productId: String(selectCall.arguments.productId),
          quantity: Number(selectCall.arguments.quantity),
        }
        return c.json(response, 200)
      }

      if (result.toolCalls.length === 0) {
        const response: ChatResponse = { type: 'text', content: result.text ?? '' }
        return c.json(response, 200)
      }

      for (const call of result.toolCalls) {
        messages.push({ role: 'assistant', content: JSON.stringify(call) })
        const toolResult = await runDataTool(db, call)
        messages.push({ role: 'tool', content: JSON.stringify(toolResult), toolCallId: call.id })
      }
    }

    return c.json({ error: 'assistente indisponivel, tente novamente' }, 502)
  }
}

async function runDataTool(db: ReturnType<typeof drizzle>, call: ChatCompletionToolCall) {
  if (call.name === 'search_products') {
    return searchProducts(db, String(call.arguments.query ?? ''))
  }
  if (call.name === 'get_product') {
    return getProduct(db, String(call.arguments.productId ?? ''))
  }
  return { error: `tool desconhecida: ${call.name}` }
}
```

Comentários no arquivo: **não adicione nenhum** além do que já está acima — o código já é
autoexplicativo. **Não implemente `parsed.data.image`** — o campo existe no schema (M1) mas o envio de
foto pro modelo ainda não está nesta fatia (decisão registrada em M2); simplesmente não referencie esse
campo neste arquivo.

### 2. Criar `back/test/chat.test.ts`

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { createAuthMiddleware } from '../src/middleware/auth'
import { createChatHandler } from '../src/routes/chat'
import type { Env, AppContext } from '../src/env'
import type { RunChatCompletion } from '../src/lib/chat-completion'

const createTestApp = (runChatCompletion: RunChatCompletion) => {
  const fakeVerify = async (token: string) => {
    if (token === 'token-uid-comprador-teste') return { uid: 'uid-comprador-teste' }
    return null
  }

  const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
  testApp.use('/chat/*', (c, next) => createAuthMiddleware(fakeVerify)(c, next))
  testApp.post('/chat/message', (c) => createChatHandler(runChatCompletion)(c))
  return testApp
}

const AUTH_HEADER = { Authorization: 'Bearer token-uid-comprador-teste' }

describe('POST /chat/message', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('sem Authorization retorna 401', async () => {
    const run = vi.fn()
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('body com messages vazio retorna 400', async () => {
    const run = vi.fn()
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(400)
    expect(run).not.toHaveBeenCalled()
  })

  it('resposta de texto direto (sem tool call): 1 chamada, devolve type text', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'oi! o que voce procura?', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'text', content: 'oi! o que voce procura?' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('1 rodada de tool de dados antes da resposta final: 2 chamadas, 2a recebe mensagem role=tool', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'call_1', name: 'search_products', arguments: { query: 'fralda M' } }],
      })
      .mockResolvedValueOnce({ text: 'achei a fralda M, confirma?', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'quero fralda M' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'text', content: 'achei a fralda M, confirma?' })
    expect(run).toHaveBeenCalledTimes(2)

    const secondCallMessages = run.mock.calls[1][0]
    expect(secondCallMessages.some((m: { role: string }) => m.role === 'tool')).toBe(true)
  })

  it('tool select_product_for_purchase: para no primeiro select, devolve type action, 1 chamada', async () => {
    const run = vi.fn().mockResolvedValue({
      text: null,
      toolCalls: [{ id: 'call_1', name: 'select_product_for_purchase', arguments: { productId: 'p1', quantity: 2 } }],
    })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'quero 2 do Supersec Pants P' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('modelo so chama tool de dados, nunca fecha: apos MAX_TOOL_ITERATIONS, retorna 502', async () => {
    const run = vi.fn().mockResolvedValue({
      text: null,
      toolCalls: [{ id: 'call_x', name: 'search_products', arguments: { query: 'fralda' } }],
    })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'fralda' }] }),
    })
    const response = await testApp.fetch(request, env)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'assistente indisponivel, tente novamente' })
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('search_products/get_product de verdade contra o D1 real (sem fake nessa parte)', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'call_1', name: 'search_products', arguments: { query: 'Supersec Pants' } }],
      })
      .mockResolvedValueOnce({ text: 'achei', toolCalls: [] })
    const testApp = createTestApp(run)
    const request = new Request('http://localhost/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Supersec Pants' }] }),
    })
    const response = await testApp.fetch(request, env)

    expect(response.status).toBe(200)

    const secondCallMessages = run.mock.calls[1][0]
    const toolMessage = secondCallMessages.find((m: { role: string }) => m.role === 'tool')
    const toolResult = JSON.parse(toolMessage.content)
    expect(Array.isArray(toolResult)).toBe(true)
    expect(toolResult.some((p: { id: string }) => p.id === 'p1')).toBe(true)
  })
})
```

### 3. Modificar `back/src/index.ts`

Adicionar os imports novos e montar a rota, seguindo o padrão de `/orders/*` já existente:
```ts
import { createChatHandler } from './routes/chat'
import { createWorkersAiChatCompletion } from './lib/chat-completion'
```
E, depois do bloco de `/orders` (fim do arquivo, antes do `export default app`):
```ts
app.use('/chat/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.post('/chat/message', (c) => createChatHandler(createWorkersAiChatCompletion(c.env.AI))(c))
```

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. Se `node_modules` não estiver instalado (verifique com `ls node_modules/.bin/vitest`), rode
   `npm install` (raiz e, se necessário, dentro de `back/`) e AGUARDE terminar antes de prosseguir.
2. `npm test` — todos os testes verdes, incluindo os 7 casos novos de `chat.test.ts` (`orders.*`,
   `products.*`, `cors.*`, `notifications.*`, `chat-completion.*`, `chat-tools.*` continuam passando
   sem nenhuma mudança).
3. `npx tsc --noEmit` — sem erro de tipo.
4. `npm run lint` — não existe em `back/package.json` (achado já confirmado em M1/M2/M3, não
   bloqueante).

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade na 3ª tentativa,
PARE e relate o obstáculo exato — não invente workaround.

## Critérios de aceite

- [ ] `back/src/routes/chat.ts` criado, exatamente como especificado no passo 1 (sem comentários
      supérfluos, sem tratar `image`).
- [ ] `back/test/chat.test.ts` com os 7 casos do passo 2, todos verdes.
- [ ] `back/src/index.ts` monta `POST /chat/message` atrás do mesmo middleware de auth Firebase usado
      por `/orders/*`.
- [ ] Requisição sem token → 401; body inválido → 400; loop sem fechar após `MAX_TOOL_ITERATIONS` → 502.
- [ ] Quando o modelo chama `select_product_for_purchase`, a rota para no primeiro select — não chama
      `runChatCompletion` de novo depois disso.
- [ ] `search_products`/`get_product` chamadas pela rota usam os dados REAIS do D1 (não um mock) —
      confirmado pelo caso de teste 7.
- [ ] `npm test` completo do `back/` verde (novos + existentes); `tsc --noEmit` exit 0.
- [ ] Nenhum arquivo fora de `back/` modificado (não tocar em `front/`, `packages/contracts/`).
- [ ] `back/src/lib/chat-completion.ts`, `back/src/lib/chat-tools.ts`, `packages/contracts/src/chat.ts`
      **não foram tocados** nesta tarefa (só consumidos).

## Restrições

- **Não** implemente envio de imagem/foto (`parsed.data.image` não é usado nesta tarefa).
- **Não** modifique `back/src/lib/chat-completion.ts` nem `back/src/lib/chat-tools.ts` — se algo parecer
  exigir mudança neles, PARE e relate, não ajuste por conta própria.
- **Não** use `any`.
- **Não** modifique `front/` nem `packages/contracts/`.
- Commit em português, Conventional Commits, mensagem:
  `feat(back): rota POST /chat/message com tool-loop (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal de `npm test` e `tsc --noEmit`.
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio, ajuste de mecanismo ou decisão de detalhe tomada.
