# M2 — back/: adapter Workers AI para chat-completion com tool-use

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M2, dep: nenhuma)

## Objetivo

Criar um adapter que chama a Workers AI (`env.AI.run()`, modelo `@cf/meta/llama-4-scout-17b-16e-instruct`)
por trás de uma interface genérica (`RunChatCompletion`) que não vaza detalhe de Cloudflare pro resto do
código. Isso é o que permite a tarefa M4 (rota `/chat/message`, futura) testar o loop de tool-use sem
chamar IA de verdade, e trocar de provedor depois (ex. Claude via AI Gateway) sem reescrever quem
consome a interface.

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
- Padrão a copiar exatamente:
  - `back/src/lib/notifications.ts` — como este projeto já faz "função injetável" (ex. `SendEmailFn`
    injetado em `notifySupplierOfNewOrder`, produção usa uma implementação real, teste passa uma fake).
    O adapter desta tarefa segue a mesma ideia: `RunChatCompletion` é o tipo da função injetável,
    `createWorkersAiChatCompletion` é quem produz a implementação real.
  - `back/test/notifications.test.ts` — como um teste de unidade desse tipo de função é escrito (`vi.fn()`
    como fake, `describe`/`it`, `expect(fn).toHaveBeenCalledWith(...)`).
  - `back/src/env.d.ts` — como a interface `Env` é declarada (dentro de `declare global { namespace
    Cloudflare { interface Env { ... } } }`, não uma interface solta). Adicionar o binding novo dentro
    dessa mesma estrutura, não criar uma segunda declaração.
- **Formato real da Workers AI PARA ESTE MODELO ESPECÍFICO, confirmado direto no pacote
  `@cloudflare/workers-types` instalado (`node_modules/@cloudflare/workers-types/index.ts`, tipos
  `Ai_Cf_Meta_Llama_4_Scout_17B_16E_Instruct_Messages`/`_Output`) — fonte mais confiável que a doc
  genérica de function-calling, que mostra outro modelo mais antigo:**
  - `tools` no input de `env.AI.run()` aceita tanto o formato **plano** `{ name, description,
    parameters }` quanto o aninhado `{type, function:{...}}}` (união) — **use o formato plano**, mais
    simples.
  - **No OUTPUT, porém, `response.tool_calls[]` vem SEMPRE aninhado:** cada item é `{ id?, type?,
    function?: { name?, arguments? } }` — o nome e os argumentos ficam dentro de `call.function`, **NÃO**
    em `call.name`/`call.arguments` direto. Há também um `id` por chamada, usado para correlacionar
    quando o resultado da tool volta pro modelo (a mensagem de input aceita `tool_call_id?: string`).
  - O texto final vem em `response.response` (string).
  - **Formato de imagem, também confirmado no mesmo lugar (fora do escopo desta tarefa, mas documentado
    pra depois):** `content` de uma mensagem pode ser um array de partes `{ type, text?, image_url?: {
    url } }`, `url` sendo uma data URI (`data:image/jpeg;base64,...`). Esta tarefa **não implementa
    envio de imagem** — só texto e tools; isso fica para M4 ou um refinamento futuro.

## Tarefas (nesta ordem)

### 1. Criar `back/src/lib/chat-completion.ts`

```ts
export interface ChatCompletionTool {
  name: string
  description: string
  parameters: Record<string, unknown>
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
Os casts (`as AiModels[...]['inputs']`, `as unknown as WorkersAiChatCompletionResponse`) são
necessários porque os overloads do tipo `AiModels[...]` do pacote instalado são mais estritos que este
shape simplificado — isso é esperado, não é sinal de erro; não tente eliminá-los reescrevendo a chamada
de outra forma.

Comentários no arquivo: **não adicione nenhum** — o código já é autoexplicativo. O tipo `Ai` vem dos
tipos gerados pelo `@cloudflare/workers-types`/`wrangler types` (já é uma devDependency do `back/`,
conferir se `Ai` já está disponível globalmente depois do passo 3; se o `tsc` reclamar de `Ai` não
encontrado, é sinal de que o passo 3 (rodar `wrangler types`) precisa acontecer antes deste arquivo
compilar — a ordem dos passos abaixo já resolve isso, só não pule o passo 3).

### 2. Criar `back/test/chat-completion.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { createWorkersAiChatCompletion } from '../src/lib/chat-completion'
import type { ChatCompletionTool } from '../src/lib/chat-completion'

const SAMPLE_TOOLS: ChatCompletionTool[] = [
  {
    name: 'search_products',
    description: 'Busca produtos do catalogo',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]

describe('createWorkersAiChatCompletion', () => {
  it('chama ai.run com o modelo certo e tools no formato plano (sem wrapper)', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'oi', tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    await runChatCompletion([{ role: 'user', content: 'ola' }], SAMPLE_TOOLS)

    expect(run).toHaveBeenCalledWith(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: [{ role: 'user', content: 'ola', tool_call_id: undefined }],
        tools: [
          {
            name: 'search_products',
            description: 'Busca produtos do catalogo',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
          },
        ],
      },
    )
  })

  it('traduz response.response e response.tool_calls (aninhado em function) para o formato canonico', async () => {
    const run = vi.fn().mockResolvedValue({
      response: 'achei um produto',
      tool_calls: [{ id: 'call_1', function: { name: 'search_products', arguments: { query: 'fralda M' } } }],
    })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'fralda M' }], SAMPLE_TOOLS)

    expect(result.text).toBe('achei um produto')
    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'search_products', arguments: { query: 'fralda M' } }])
  })

  it('com tool_calls ausente na resposta, retorna toolCalls vazio (nao quebra)', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'oi' })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.toolCalls).toEqual([])
  })

  it('com response ausente, retorna text null', async () => {
    const run = vi.fn().mockResolvedValue({ tool_calls: [] })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.text).toBeNull()
  })

  it('com item de tool_calls sem function.name (mal formado), ignora esse item', async () => {
    const run = vi.fn().mockResolvedValue({
      response: null,
      tool_calls: [{ id: 'call_1', function: {} }, { id: 'call_2', function: { name: 'search_products', arguments: {} } }],
    })
    const runChatCompletion = createWorkersAiChatCompletion({ run } as unknown as Ai)

    const result = await runChatCompletion([{ role: 'user', content: 'oi' }], [])

    expect(result.toolCalls).toEqual([{ id: 'call_2', name: 'search_products', arguments: {} }])
  })
})
```

### 3. Modificar `back/wrangler.jsonc` — adicionar o binding `AI`

Adicionar, no mesmo nível de `d1_databases`/`vars` (confira o arquivo real antes de editar para manter a
formatação/comentários existentes intactos):
```jsonc
"ai": {
  "binding": "AI"
},
```
Depois de salvar, rodar (dentro de `back/`):
```
npx wrangler types
```
Isso gera/atualiza os tipos do binding (incluindo o tipo global `Ai`) a partir do `wrangler.jsonc` — não
escreva esse tipo à mão. Confira qual arquivo o comando gerou/atualizou (normalmente
`worker-configuration.d.ts` na raiz de `back/`) e garanta que ele está commitado (mesmo padrão dos tipos
gerados que o projeto já versiona — confira se arquivos `.d.ts` gerados por wrangler já existem
versionados no repo antes de decidir; se já existir um, é só atualizar o mesmo arquivo).

### 4. Modificar `back/src/env.d.ts` — adicionar `AI: Ai` à interface `Env`

Dentro do bloco `declare global { namespace Cloudflare { interface Env { ... } } }` já existente,
adicionar uma linha (seguindo o padrão de comentário curto acima de cada campo, como os outros campos já
têm):
```ts
/** Binding da Workers AI — usado pelo chat-agent (thread M, feature 018). */
AI: Ai
```
Não crie uma segunda `interface Env` nem duplique a estrutura — edite a que já existe.

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. `npm test` — todos os testes verdes, incluindo os 5 casos novos de `chat-completion.test.ts`
   (`orders.*`, `products.*`, `cors.*`, `notifications.*` continuam passando sem nenhuma mudança — esta
   tarefa não toca nesses arquivos).
2. `npx tsc --noEmit` — sem erro de tipo (isso confirma que o tipo `Ai` foi resolvido corretamente após
   o passo 3).
3. `npm run lint` — exit 0.

**Loop:** máximo 3 tentativas por problema específico encontrado. Se `Ai` não for encontrado pelo `tsc`
mesmo depois de rodar `wrangler types`, verifique se `back/tsconfig.json` inclui o arquivo de tipos
gerado (`types` ou `include`) — ajuste se necessário, mas não invente um tipo `Ai` manual. Se travar de
verdade na 3ª tentativa, PARE e relate o obstáculo exato.

## Critérios de aceite

- [ ] `back/src/lib/chat-completion.ts` criado, exatamente como especificado no passo 1 (sem comentários
      supérfluos).
- [ ] `back/test/chat-completion.test.ts` com os 5 casos do passo 2, todos verdes.
- [ ] `back/wrangler.jsonc` tem o binding `ai: { binding: "AI" }`.
- [ ] `npx wrangler types` rodado; tipos gerados atualizados e commitados.
- [ ] `back/src/env.d.ts` — `Env` (dentro de `Cloudflare.Env`) tem o campo `AI: Ai`.
- [ ] `npm test` completo do `back/` verde (novos + existentes); `tsc --noEmit` e `lint` exit 0.
- [ ] Nenhum arquivo fora de `back/` modificado (não tocar em `front/`, `packages/contracts/`).
- [ ] `back/src/routes/`, `back/src/schema/` **não foram tocados** nesta tarefa (rota e tools de dados
      são M3/M4).
- [ ] Nenhuma tentativa de implementar envio de foto/imagem nesta tarefa.

## Restrições

- **Não** crie a rota `/chat/message` nem as tools de dados (`search_products`/`get_product`) — isso é
  M3/M4.
- **Não** implemente envio de imagem/foto — formato não confirmado, fica para depois com verificação
  empírica.
- **Não** escreva o tipo `Ai` à mão — só via `wrangler types`.
- **Não** use `any`.
- **Não** modifique `front/` nem `packages/contracts/`.
- Commit em português, Conventional Commits, mensagem:
  `feat(back): adapter Workers AI para chat-completion com tool-use (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados (incluindo o arquivo de tipos gerado por `wrangler types`).
- Saída literal de `npm test`, `tsc --noEmit`, `lint`.
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio, ajuste de mecanismo ou decisão de detalhe tomada (ex.: onde `wrangler types` gerou
  o arquivo de tipos, se precisou ajustar `tsconfig.json`).
