# Thread M — App Mobile: Chat-Agent de Compra (PWA) (feature 018)

> **Para workers agenticos:** cada tarefa M-N vira um prompt Haiku completo (M1.md, M2.md, ...)
> escrito pela sessao-mae **na hora do disparo** (padrao D-006), seguindo o template de
> `README.md`. Revisao de entrega obrigatoria pelo `../review-checklist.md` (D-012).

**Spec:** `../specs/spec-app-mobile-chat-agent.md` (APROVADA 2026-08-02)
**Decisoes:** D-026/D-027 (Cloudflare Workers+D1), D-005 (monorepo), D-023/D-024 (checkout e gate de
login existentes — reaproveitados, nao reabertos por esta thread).

**Objetivo da fatia:** um chat (`/assistente` no front) onde o comprador manda texto/foto, um LLM real
com tool-use (Workers AI, `env.AI`) busca no catalogo REAL (tabela `products` do D1, a mesma que
`/produtos` ja usa) e, ao identificar o produto certo, devolve uma acao estruturada que o front usa para
adicionar ao carrinho e abrir o checkout que **ja existe** (S5a/S5b) — sem reimplementa-lo.

**Stack:** Hono + Drizzle (back, igual as threads B/P/C), Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`,
function calling + vision), Next.js/React (front, igual as threads S/C).

---

## Constraints globais (valem para TODA tarefa)

- **Login obrigatorio.** `/assistente` exige sessao Firebase — mesmo padrao de guarda client-side que
  `/minha-conta`/`/fornecedor` ja usam. `POST /chat/message` exige o mesmo Bearer ID Token que
  `/orders/*` ja exige (reusar `createAuthMiddleware`/`verifyFirebaseIdToken` de `back/src/middleware/auth.ts`,
  nao reescrever).
- **Sem tabela nova no D1.** As tools do agente leem a tabela `products` (`back/src/schema/products.ts`)
  que ja existe e ja esta populada. Nenhuma migration nesta thread.
- **Conversa stateless no servidor.** O cliente reenvia o historico completo a cada turno; o Worker nao
  persiste conversa em lugar nenhum.
- **A "tool" `select_product_for_purchase` NAO e uma tool de dados — e o sinal de saida.** Quando o
  modelo a chama, o Worker responde `{ type: 'action', action: 'select_product', productId, quantity }`
  em vez de continuar o loop. Nenhuma outra tool tem esse efeito.
- **Checkout intocado.** Nenhuma tarefa desta thread modifica `front/src/app/(main)/checkout/`, o
  cart-context em si (so o CONSOME, via `addItem` ja existente) ou `back/src/routes/orders.ts`.
- **Interface de chat-completion agnostica de provedor** (`RunChatCompletion`, definida em M2) — as
  tarefas de roteamento (M4) e de teste NUNCA chamam `env.AI.run()` diretamente; sempre atraves dessa
  interface, injetada. Isso é o que permite testar o tool-loop sem custo/latencia de IA real e trocar
  Workers AI por Claude via AI Gateway depois sem reescrever M4.
- **Sem `any`.** `lint`/`tsc` exit 0 antes de todo relatorio (D-008, max 3 tentativas por problema).
- **Commits em pt-BR** (Conventional Commits).
- **Dinheiro nesta thread:** nao se aplica diretamente (o chat nao grava preco/pedido — quem faz isso e
  o `POST /orders` que ja existe), mas ao ler `products` os campos `priceCents` continuam em centavos,
  igual sempre.

---

## Interfaces canonicas (definidas UMA vez — DRY; todas as tarefas usam estas)

### Contrato Zod (produzido por M1, consumido por M4/M5/M6)
```ts
// packages/contracts/src/chat.ts
import { z } from 'zod'

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  image: z.string().optional(), // data URL base64 (ex: "data:image/jpeg;base64,...")
})

export const ChatTextResponseSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
})

export const ChatActionResponseSchema = z.object({
  type: z.literal('action'),
  action: z.literal('select_product'),
  productId: z.string(),
  quantity: z.number().int().positive(),
})

export const ChatResponseSchema = z.union([ChatTextResponseSchema, ChatActionResponseSchema])

export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
```

### Interface de chat-completion (produzida por M2, consumida por M4)
```ts
// back/src/lib/chat-completion.ts
export interface ChatCompletionTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema do parametro
}

export interface ChatCompletionToolCall {
  id: string // correlaciona com ChatCompletionMessage.toolCallId na resposta da tool
  name: string
  arguments: Record<string, unknown>
}

export interface ChatCompletionResult {
  text: string | null
  toolCalls: ChatCompletionToolCall[]
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string // obrigatorio quando role === 'tool' (id do ChatCompletionToolCall correspondente)
}

export type RunChatCompletion = (
  messages: ChatCompletionMessage[],
  tools: ChatCompletionTool[],
) => Promise<ChatCompletionResult>
```

### Contrato HTTP (produzido por M4)
| Metodo | Rota | Auth | Body | Resp OK |
|---|---|---|---|---|
| POST | `/chat/message` | Sim (Bearer Firebase ID Token) | `ChatRequest` (Zod) | `200 ChatResponse` (text ou action) |

Erros: `400` payload invalido (Zod), `401` sem token (middleware existente), `502` assistente
indisponivel apos `MAX_TOOL_ITERATIONS` sem resposta final (ver M4).

---

## Tarefas (ordem e dependencias)

```
M1 (contrato Zod) ──┬──> M4 (rota /chat/message + tool-loop) ──> M6 (front intercepta acao) ──> M7 (deploy)
M2 (adapter Workers AI) ─┤                                          ^
M3 (tools search/get)  ──┘                                          |
M5 (front: /assistente + ChatUI) ────────────────────────────────────┘
```
M1/M2/M3 sao independentes entre si (podem rodar em paralelo). M4 depende dos tres. M5 so depende de M1
(so precisa do tipo do contrato pra tipar a chamada). M6 depende de M4 (contrato de resposta real) e M5
(onde a interceptacao entra). M7 e deploy+validacao humana, so depois de M4 e M6 aprovados.

### M1 — `packages/contracts`: schema Zod de chat  [dep: —]
- **Create:**
  - `packages/contracts/src/chat.ts` (schema acima, exato).
  - `packages/contracts/src/__tests__/chat.test.ts` — casos: `ChatRequestSchema` aceita `{messages:[{role:'user',content:'oi'}]}`
    sem `image`; aceita com `image` string; rejeita `messages` vazio; rejeita `role` fora de
    `user`/`assistant`. `ChatResponseSchema` faz parse correto de um `{type:'text', content:'...'}` e de
    um `{type:'action', action:'select_product', productId:'p1', quantity:2}`; rejeita `quantity` <= 0;
    rejeita `quantity` nao-inteiro.
- **Modify:** `packages/contracts/src/index.ts` — reexporta tudo de `./chat` (mesmo padrao de
  `./orders`/`./products` ja existentes; conferir o arquivo antes de editar para copiar o estilo exato).
- **DoD:** `npm test` (packages/contracts) verde incluindo os casos novos; `tsc` exit 0.
- **Commit:** `feat(contracts): schema Zod de ChatRequest/ChatResponse (thread M)`

### M2 — `back/`: adapter Workers AI (`RunChatCompletion`)  [dep: —]
- **Formato CONFIRMADO no pacote `@cloudflare/workers-types` instalado (fonte mais confiavel que a doc
  generica — 2026-08-02, `node_modules/@cloudflare/workers-types/index.ts`, tipos
  `Ai_Cf_Meta_Llama_4_Scout_17B_16E_Instruct_Messages`/`_Output`), especifico deste modelo:**
  `tools` no INPUT aceita tanto o formato plano `{name, description, parameters}` quanto o formato
  aninhado `{type, function:{...}}}` (union) — usar o formato plano, mais simples. **No OUTPUT, porem,
  `tool_calls[]` vem SEMPRE aninhado:** cada item e `{ id?, type?, function?: { name?, arguments? } }` —
  o nome e os argumentos ficam dentro de `call.function`, NAO em `call.name`/`call.arguments` direto (a
  doc generica de function-calling mostra o formato plano no output, mas isso e de um modelo diferente e
  mais antigo, `@hf/nousresearch/hermes-2-pro-mistral-7b` — NAO se aplica ao llama-4-scout). Tambem ha um
  `id` por tool call, usado pra correlacionar quando a mensagem de resposta da tool volta pro modelo (a
  mensagem de input aceita `tool_call_id?: string`) — por isso a interface `ChatCompletionToolCall` tem
  `id` e `ChatCompletionMessage` tem `toolCallId?`.
  **Bonus confirmado no mesmo lugar (nao e mais "nao confirmado"):** o formato de imagem para este
  modelo e `content` como array de partes `{ type, text?, image_url?: { url } }`, `url` sendo uma data
  URI (`data:image/jpeg;base64,...`) — padrao OpenAI-compatible. Isso **ainda nao entra no escopo de
  M2** (M2 continua so texto+tools), mas fica registrado pra quando a foto for integrada (M4 ou
  refinamento futuro) nao precisar mais adivinhar nem verificar empiricamente — o tipo ja confirma.
- **Create:**
  - `back/src/lib/chat-completion.ts` — os tipos da secao "Interfaces canonicas" acima, mais:
    ```ts
    interface WorkersAiChatCompletionResponse {
      response?: string
      tool_calls?: { id?: string; function?: { name?: string; arguments?: Record<string, unknown> } }[]
    }

    export function createWorkersAiChatCompletion(ai: Ai): RunChatCompletion {
      return async (messages, tools) => {
        const response = (await ai.run(
          '@cf/meta/llama-4-scout-17b-16e-instruct',
          {
            messages: messages.map((m) => ({ role: m.role, content: m.content, tool_call_id: m.toolCallId })),
            tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
          } as AiModels['@cf/meta/llama-4-scout-17b-16e-instruct']['inputs'],
        )) as unknown as WorkersAiChatCompletionResponse

        const toolCalls = (response.tool_calls ?? [])
          .filter((call) => call.function?.name)
          .map((call) => ({
            id: call.id ?? '',
            name: call.function!.name!,
            arguments: (call.function!.arguments ?? {}) as Record<string, unknown>,
          }))

        return { text: response.response ?? null, toolCalls }
      }
    }
    ```
    O `as AiModels[...]['inputs']`/`as unknown as WorkersAiChatCompletionResponse` sao necessarios porque
    o tipo `AiModels['@cf/meta/llama-4-scout-17b-16e-instruct']` do pacote instalado tem overloads mais
    estritos que nao casam 1:1 com este shape simplificado — isso e esperado, nao e sinal de erro; NAO
    tente eliminar esses casts reescrevendo a chamada de outra forma.
  - `back/test/chat-completion.test.ts` — teste de UNIDADE (sem chamar IA real): injete um `Ai` fake
    (objeto com `run: vi.fn().mockResolvedValue({ response: 'oi', tool_calls: [{ id: 'call_1', function:
    { name: 'search_products', arguments: { query: 'fralda' } } }] })`) e confirme que
    `createWorkersAiChatCompletion`: (a) chama `ai.run` com o nome do modelo certo e `tools` no formato
    plano (sem wrapper); (b) traduz a resposta pra `ChatCompletionResult` com `toolCalls` no formato
    canonico `{id, name, arguments}` (desaninhado de `function`); (c) com `tool_calls` ausente/undefined
    na resposta fake, retorna `toolCalls: []` (nao quebra); (d) com um item de `tool_calls` sem
    `function.name` (mal formado), esse item e ignorado (nao quebra, nao aparece no resultado).
- **Modify:** `back/wrangler.jsonc` — adicionar o binding:
  ```jsonc
  "ai": {
    "binding": "AI"
  },
  ```
  (no mesmo nivel de `d1_databases`/`vars`). Rodar `npx wrangler types` depois (gera/atualiza o tipo
  `Ai` em `back/worker-configuration.d.ts` ou equivalente — confira onde o projeto guarda os tipos
  gerados, mesmo lugar onde `Env` ja e usado).
- **Modify:** `back/src/env.d.ts` (ou onde `Env` esta definido) — adicionar `AI: Ai` a interface `Env`.
- **DoD:** `npm test` (back) verde incluindo `chat-completion.test.ts`; `tsc`/lint exit 0; `wrangler.jsonc`
  tem o binding `AI`.
- **Commit:** `feat(back): adapter Workers AI para chat-completion com tool-use (thread M)`

### M3 — `back/`: tools de dados (`search_products`, `get_product`)  [dep: —]
- **Regra de negocio (RN-007-04, mesma do `GET /products` publico):** as tools NUNCA retornam produto
  despublicado (`active: false`) — o chat e uma superficie de comprador, mesma visibilidade do catalogo
  publico. **Tambem nunca expoem `supplierEmail`/`supplierId`** — o resultado vira contexto de um prompt
  de LLM (M4), vazar e-mail/id de fornecedor pra dentro do historico de conversa nao tem necessidade nem
  e seguro. So as colunas que o agente precisa: `id`, `name`, `brand`, `size`, `priceCents`, `categoria`,
  `descricao`, `quantity`.
- **Create:**
  - `back/src/lib/chat-tools.ts`:
    ```ts
    import { and, eq, like, or } from 'drizzle-orm'
    import type { drizzle } from 'drizzle-orm/d1'
    import { products } from '../schema/products'

    const SEARCH_COLUMNS = {
      id: products.id,
      name: products.name,
      brand: products.brand,
      size: products.size,
      priceCents: products.priceCents,
      categoria: products.categoria,
      descricao: products.descricao,
      quantity: products.quantity,
    }

    export async function searchProducts(db: ReturnType<typeof drizzle>, query: string) {
      const term = `%${query}%`
      return db
        .select(SEARCH_COLUMNS)
        .from(products)
        .where(
          and(
            eq(products.active, true),
            or(like(products.name, term), like(products.brand, term), like(products.categoria, term)),
          ),
        )
        .all()
    }

    export async function getProduct(db: ReturnType<typeof drizzle>, productId: string) {
      const rows = await db
        .select(SEARCH_COLUMNS)
        .from(products)
        .where(and(eq(products.id, productId), eq(products.active, true)))
        .all()
      return rows[0] ?? null
    }
    ```
  - `back/test/chat-tools.test.ts` — mesmo padrao de `products.get.test.ts` (aplica migrations reais via
    `applyD1Migrations`/`env.TEST_MIGRATIONS`, ja configurado, contra os 24 produtos reais do seed).
    Casos: `searchProducts` com termo que bate no nome/marca de um produto real retorna >=1 resultado;
    termo que nao bate em nada retorna array vazio; `searchProducts`/`getProduct` NUNCA retornam produto
    despublicado (fixture extra `active: false`); resultado NUNCA inclui `supplierEmail`/`supplierId`;
    `getProduct` com id real retorna o produto (`priceCents` presente); `getProduct` com id inexistente
    retorna `null`.
- **DoD:** `npm test` (back) verde incluindo `chat-tools.test.ts`; `tsc` exit 0 (`lint` nao existe em
  `back/`, achado pre-existente ja confirmado em M1/M2); nenhum arquivo de `orders.ts`/`products.ts`
  (rotas) tocado — M3 so cria o arquivo novo de tools.
- **Commit:** `feat(back): tools search_products/get_product para o chat-agent (thread M)`

### M4 — `back/`: rota `POST /chat/message` (tool-loop)  [dep: M1, M2, M3]
- **Create:**
  - `back/src/routes/chat.ts`:
    ```ts
    import { drizzle } from 'drizzle-orm/d1'
    import type { Context } from 'hono'
    import { ChatRequestSchema } from '@fraldinha-livre/contracts'
    import type { ChatResponse } from '@fraldinha-livre/contracts'
    import type { RunChatCompletion, ChatCompletionMessage, ChatCompletionTool } from '../lib/chat-completion'
    import { searchProducts, getProduct } from '../lib/chat-tools'
    import type { Env } from '../env'

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
      return async (c: Context<{ Bindings: Env }>) => {
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
        // Envio de foto ainda NAO implementado aqui (M2 nao confirmou o formato de imagem do
        // modelo) — `parsed.data.image`, quando presente, e ignorado nesta fatia; resolver com
        // verificacao empirica antes de ligar de fato (ver nota de M2).

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
            const toolResult = await runDataTool(db, call.name, call.arguments)
            messages.push({ role: 'tool', content: JSON.stringify(toolResult), toolCallId: call.id })
          }
        }

        return c.json({ error: 'assistente indisponivel, tente novamente' }, 502)
      }
    }

    async function runDataTool(
      db: ReturnType<typeof drizzle>,
      name: string,
      args: Record<string, unknown>,
    ) {
      if (name === 'search_products') {
        return searchProducts(db, String(args.query ?? ''))
      }
      if (name === 'get_product') {
        return getProduct(db, String(args.productId ?? ''))
      }
      return { error: `tool desconhecida: ${name}` }
    }
    ```
  - `back/test/chat.test.ts` — NUNCA chama IA real; injeta um `RunChatCompletion` fake (`vi.fn()`) nos
    testes via `createChatHandler(fakeRunChatCompletion)`. Casos:
    1. Sem `Authorization` → 401 (middleware existente).
    2. Body invalido (`messages` vazio) → 400.
    3. Fake que retorna `{text:'ola, o que voce procura?', toolCalls:[]}` na 1a chamada → resposta
       `200 {type:'text', content:'ola, o que voce procura?'}`; `runChatCompletion` foi chamado 1 vez.
    4. Fake que na 1a chamada retorna `toolCalls:[{name:'search_products', arguments:{query:'fralda M'}}]`
       e na 2a retorna `{text:'achei a fralda M da marca X, confirma?', toolCalls:[]}` → resposta final
       `200 {type:'text', ...}`; `runChatCompletion` chamado 2 vezes; a 2a chamada recebeu uma mensagem
       `role:'tool'` no array de `messages` (confirma que o resultado da tool voltou pro modelo).
    5. Fake que retorna `toolCalls:[{name:'select_product_for_purchase', arguments:{productId:'p1',
       quantity:2}}]` → resposta `200 {type:'action', action:'select_product', productId:'p1',
       quantity:2}`, SEM chamar `runChatCompletion` de novo (para no primeiro select).
    6. Fake que SEMPRE retorna uma tool de dados (nunca `select_product_for_purchase` nem texto final) →
       apos `MAX_TOOL_ITERATIONS` chamadas, resposta `502 {error:'assistente indisponivel...'}`.
    7. `search_products`/`get_product` de verdade (sem fake nessa parte) contra o D1 de teste (aplicar
       migrations reais) — confirma que `runDataTool` bate com os dados reais da tabela `products`.
- **Modify:** `back/src/index.ts` — montar a rota:
  ```ts
  import { createChatHandler } from './routes/chat'
  import { createWorkersAiChatCompletion } from './lib/chat-completion'
  // ...
  app.use('/chat/*', (c, next) => {
    const authMiddleware = createAuthMiddleware((token) =>
      verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
    )
    return authMiddleware(c, next)
  })
  app.post('/chat/message', (c) => createChatHandler(createWorkersAiChatCompletion(c.env.AI))(c))
  ```
- **DoD:** `npm test` (back) verde incluindo os 7 casos de `chat.test.ts`; `tsc`/lint exit 0; suite
  existente (`orders.*`, `products.*`, `cors.*`) continua verde sem mudanca.
- **Commit:** `feat(back): POST /chat/message com tool-loop (busca+selecao) (thread M)`

### M5 — `front/`: rota `/assistente` protegida + ChatUI  [dep: M1]
- **Invocar `Skill(ui-system)` antes de tocar em qualquer componente** (AGENTS.md — trabalho de UI
  transversal).
- **Create:**
  - `front/src/app/(main)/assistente/page.tsx` — Client Component; guarda client-side igual
    `/minha-conta` (redirect `/login?redirect=/assistente` se `useAuth()` nao logado — copiar o padrao
    exato do guard ja usado, nao inventar um novo).
  - `front/src/components/assistente/ChatUI.tsx` — lista de mensagens (`role:'user'|'assistant'`),
    input de texto, botao de anexar foto (`<input type="file" accept="image/*" capture="environment">`,
    convertido pra data URL base64 no client antes de enviar), estado local do historico completo
    (array `ChatMessage[]` do `@contracts`), chama `POST /chat/message` via `apiFetch` (mesmo helper de
    `front/src/lib/api-client.ts` que ja injeta o Bearer token — nao reescrever).
  - `front/src/components/assistente/ChatUI.test.tsx` — renderiza, digita mensagem, envia, mocka
    `apiFetch` retornando `{type:'text', content:'...'}` e confirma que a mensagem aparece na lista;
    mocka erro de rede/500 e confirma que aparece a mensagem de sistema com opcao de retry (sem perder o
    historico ja digitado).
- **DoD:** `npm test` (front) verde incluindo `ChatUI.test.tsx`; `tsc`/lint/build exit 0; rota
  `/assistente` redireciona deslogado, renderiza logado (verificar no navegador antes de fechar — maior
  risco de UI da fatia, mesmo cuidado que C8 teve).
- **Commit:** `feat(front): rota /assistente protegida + ChatUI (thread M)`

### M6 — `front/`: intercepta acao `select_product` → carrinho + checkout  [dep: M4, M5]
- **Modify:** `front/src/components/assistente/ChatUI.tsx` — ao receber uma resposta com
  `response.type === 'action' && response.action === 'select_product'`: buscar o produto real (via
  `ProductRepository`/`get_product` — reusar o repositorio ja existente de C6/C7, NAO duplicar
  fetch), chamar `addItem` do cart-context (mesma funcao que "Comprar agora"/"Adicionar a sacola" ja
  usam — copiar a chamada exata, nao inventar uma nova assinatura) com a quantidade vinda da acao, e
  `router.push('/checkout')`.
- **Modify:** `front/src/components/assistente/ChatUI.test.tsx` — caso novo: mocka `apiFetch` retornando
  `{type:'action', action:'select_product', productId:'p1', quantity:2}`, confirma que `addItem` foi
  chamado com o produto/quantidade certos e que `router.push` foi chamado com `/checkout`.
- **DoD:** `npm test` (front) verde; `tsc`/lint/build exit 0; **nenhum arquivo de checkout
  (`front/src/app/(main)/checkout/`, `checkout-context` ou equivalente) foi tocado** — so o cart-context
  foi CONSUMIDO, nao modificado.
- **Commit:** `feat(front): chat-agent seleciona produto e abre o checkout existente (thread M)`

### M7 — Deploy real + validacao humana + QA manual  [dep: M4, M6]  (coordenador + cliente, NAO Haiku)

1. **Habilitar Workers AI no ambiente Cloudflare** (se ainda nao estiver, verificar no dashboard/MCP
   `cloudflare-bindings`) — pre-requisito humano, mesma natureza do "conta Cloudflare" ja resolvido em B9.
2. `npx wrangler deploy` (dentro de `back/`) com o binding `AI` novo.
3. Smoke test em producao: `POST /chat/message` sem token → 401; com token valido e uma mensagem simples
   ("oi") → 200 com resposta de texto (confirma que o binding `AI` funciona de verdade em produção, não
   só no ambiente de teste local).
4. **Checklist de QA manual** (10-15 casos, documentado no relatorio desta tarefa — nao e criterio
   automatizavel):
   - Pedido direto por nome de um produto real do catalogo.
   - Foto legivel de uma embalagem de produto real → agente reconhece e sugere o produto certo.
   - Foto ambigua/ilegivel → agente pede mais informacao (marca/tamanho), nao trava nem alucina um id.
   - Produto que nao existe no catalogo → agente informa que nao achou, sem inventar.
   - Confirmar selecao → cai no checkout com o produto/quantidade certos (validacao ponta a ponta:
     login → chat → selecao → checkout → pedido real em `/minha-conta`, mesmo fluxo de validacao humana
     das threads B/C anteriores).
   - Custo: registrar quantos "neurons" (Workers AI) a sessao de QA consumiu, pra ter uma referencia real
     de custo por conversa (constraint da spec).
5. **Registro:** `feature_list.json` (018 → done, com o resumo da validacao), `progresso.md`,
   `integration-guide.md` ganha uma secao sobre `/chat/message` (mesmo padrao das secoes de
   `/orders`/`/products` ja existentes).

**DoD:** smoke test + checklist de QA + validacao ponta a ponta confirmados; registro escrito.

---

## Coerencia do app entre etapas
Depois de M1-M3, nada no app muda (so codigo novo, nao montado em rota nenhuma ainda). M4 liga
`/chat/message` mas o front ainda nao o chama — sem risco de regressao no catalogo/checkout existentes.
M5 adiciona uma rota nova (`/assistente`) que não é linkada em nenhum menu ainda nesta thread (decisão:
ver "Fora desta thread"). M6 é quem fecha o laço ponta a ponta. Se algo em `orders.ts`/`products.ts`
(rotas) ou no cart-context/checkout quebrar durante qualquer tarefa desta thread, é sinal de que saiu do
escopo — nenhuma tarefa aqui deveria tocar esses arquivos além de M6 CONSUMIR (não modificar) o
cart-context.

## Fora desta thread (fica pra fatias futuras, ja registrado na spec)
Link de `/assistente` em algum menu/CTA visivel do site (decidir em fatia de UX separada, nao inventar
posicionamento agora); checkout conversacional; app nativo/Capacitor; push notification; persistencia de
historico de conversa; chat pro fornecedor; troca de Workers AI por Claude via AI Gateway (so se o QA
manual mostrar necessidade).

## Verificacao por tarefa (D-008) — ordem
1. Dentro de `back/` ou `front/` (conforme a tarefa): `npm test`, depois `npx tsc --noEmit`, depois
   `npm run lint`.
2. Verificacoes especificas da tarefa (casos de teste exatos listados acima, criterios de aceite da spec).
3. Loop de ate 3 tentativas POR PROBLEMA encontrado; apos a 3a falha no mesmo ponto, PARAR e reportar
   (D-008) — nao contornar com um workaround nao documentado.
4. Revisao pela sessao-mae com `git show --stat` + rodar os comandos de novo por conta propria (D-012),
   nunca so o relatorio do executor.
