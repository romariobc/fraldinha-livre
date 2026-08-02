# M5 — front/: rota /assistente protegida + ChatUI

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M5, dep: M1 — APROVADA)

## Objetivo

Criar a tela `/assistente`: uma rota protegida (exige login, mesmo padrão de `/minha-conta`) com um
componente de chat que manda texto/foto pro backend (`POST /chat/message`, já pronto desde M4) e mostra
a resposta. Esta tarefa **não** faz a interceptação da ação `select_product` (isso é a M6, próxima) —
quando a resposta for uma ação, a UI só mostra uma mensagem informativa por enquanto.

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
- **Este é trabalho de UI transversal — invoque `Skill(ui-system)` antes de escrever qualquer JSX**, se a
  ferramenta de skill estiver disponível no seu ambiente. Se não estiver, os padrões já estão resumidos
  abaixo (extraídos de `.claude/skills/ui-system/SKILL.md` e conferidos contra o código real):
  - Container: sempre `container-fl mx-auto px-4` (nunca a classe `container` padrão do Tailwind).
  - Cards/bolhas: `rounded-card shadow-card` (não invente outro raio/sombra).
  - Títulos/botões/labels: `font-display` (fonte Nunito); texto corrido normal (Inter, sem classe).
  - Cores: `bg-primary`/`text-primary` (#5BBFEA, azul), `bg-primary-light` (#E8F6FD, fundo azul suave),
    `bg-accent`/`hover:bg-accent-dark` (#F5A623/#D4891A, laranja — usar no botão de enviar, é o mesmo
    tom das CTAs de compra), `text-brand-text` (texto principal), `text-brand-muted` (texto secundário).
  - Ícones: `lucide-react` (já é dependência do projeto).
- **Padrão de guarda de rota a copiar EXATAMENTE:** `front/src/app/(main)/minha-conta/page.tsx` — usa
  `useAuth()` (`{ user, loading }` de `@/contexts/auth-context`), um `useEffect` que faz
  `router.push('/login?redirect=/minha-conta')` quando `!loading && !user`, retorna um estado de
  "Carregando..." enquanto `loading`, e `return null` enquanto o redirect está em andamento. Para
  `/assistente`, o redirect é `/login?redirect=/assistente` (mesmo mecanismo, path diferente).
- **Padrão de teste de guarda a copiar EXATAMENTE:** `front/src/app/admin/__tests__/page.test.tsx` —
  como mockar `@/contexts/auth-context` (`vi.mock` retornando `useAuth: vi.fn()`) e `next/navigation`
  (`useRouter` mockado com um `push` espiável), e a forma `authValue(overrides)` de construir o retorno
  de `useAuth()` com todos os campos (`user`, `profile`, `role`, `loading`,
  `signInGoogle`/`signInEmail`/`signUpEmail`/`signOutUser`/`updateProfile`, todos `vi.fn()` por padrão).
- **Padrão de chamada ao backend a copiar EXATAMENTE:** `front/src/lib/api-client.ts` (`apiFetch`, já
  injeta o Bearer token do Firebase automaticamente — nunca monte o header manualmente) e
  `front/src/components/admin/AdminOrdersTab.tsx` + seu teste
  `front/src/components/admin/__tests__/AdminOrdersTab.test.tsx` — como um componente chama `apiFetch`,
  trata `!res.ok` como erro, e como o teste mocka `apiFetch` (`vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn() }))` + um helper `jsonResponse(body, status)`).
- **Tipos do contrato:** importe de `@contracts` (alias configurado em `front/tsconfig.json`, aponta pro
  `packages/contracts` real — **não** use caminho relativo `../../../packages/contracts/...` aqui,
  esse é o padrão usado em `back/`, não em `front/`; e não use `@fraldinha-livre/contracts` por extenso,
  o alias curto `@contracts` é o que os módulos de `src/lib/ports`/`src/lib/adapters` já usam). Tipos
  disponíveis: `ChatMessage` (`{ role: 'user' | 'assistant', content: string }`), `ChatResponse` (union
  de `{type:'text', content}` e `{type:'action', action:'select_product', productId, quantity}`).

## Tarefas (nesta ordem)

### 1. Criar `front/src/components/assistente/ChatUI.tsx`

```tsx
'use client'

import { useRef, useState } from 'react'
import { Send, Paperclip, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type { ChatMessage, ChatResponse } from '@contracts'

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function sendToBackend(messagesForRequest: ChatMessage[], image: string | null) {
    setSending(true)
    setError(null)
    try {
      const res = await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ messages: messagesForRequest, image: image ?? undefined }),
      })
      if (!res.ok) {
        setError('Não foi possível falar com o assistente. Tente de novo.')
        return
      }
      const data = (await res.json()) as ChatResponse
      if (data.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Produto selecionado: ${data.productId} (quantidade ${data.quantity}). O redirecionamento para o checkout ainda não está ligado nesta fatia.`,
          },
        ])
      }
    } catch {
      setError('Não foi possível falar com o assistente. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  function handleSend() {
    if (!input.trim() && !pendingImage) return
    const userMessage: ChatMessage = { role: 'user', content: input.trim() || '(foto anexada)' }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    const image = pendingImage
    setPendingImage(null)
    void sendToBackend(nextMessages, image)
  }

  function handleRetry() {
    void sendToBackend(messages, null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-card shadow-card bg-white flex flex-col h-[70vh] max-h-[640px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-brand-muted text-sm">
            Descreva o que você procura ou mande uma foto do produto.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[80%] rounded-card px-4 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-primary-light text-brand-text ml-auto'
                : 'bg-brand-bg text-brand-text mr-auto'
            }`}
          >
            {message.content}
          </div>
        ))}
        {sending && <p className="text-brand-muted text-sm">Assistente está digitando...</p>}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="font-display font-semibold inline-flex items-center gap-1 text-primary-dark"
            >
              <RotateCcw className="size-4" /> tentar de novo
            </button>
          </div>
        )}
      </div>
      {pendingImage && (
        <div className="px-4 pb-2">
          <img src={pendingImage} alt="Foto anexada" className="h-16 rounded-card" />
        </div>
      )}
      <div className="flex items-center gap-2 border-t p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar foto"
          className="text-brand-muted hover:text-primary-dark"
        >
          <Paperclip className="size-5" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Preciso de fralda tamanho M..."
          className="flex-1 rounded-card border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          aria-label="Enviar"
          className="font-display bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-card p-2"
        >
          <Send className="size-5" />
        </button>
      </div>
    </div>
  )
}
```

Comentários no arquivo: **não adicione nenhum** — o código já é autoexplicativo. **Nota de escopo (não
implemente):** quando `data.type === 'action'`, esta tarefa só mostra uma mensagem de texto informativa
— NÃO adiciona ao carrinho nem navega pro checkout. Isso é a tarefa M6, que vai substituir esse trecho.
**Retry não reenvia a foto** (imagem já foi limpa do estado antes da chamada original) — limitação
conhecida e aceita nesta fatia, não é bug a corrigir aqui.

### 2. Criar `front/src/app/(main)/assistente/page.tsx`

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import ChatUI from '@/components/assistente/ChatUI'

export default function AssistentePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/assistente')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="container-fl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-brand-text mb-4">Assistente de compra</h1>
      <ChatUI />
    </div>
  )
}
```

### 3. Criar `front/src/app/(main)/assistente/__tests__/page.test.tsx`

```tsx
/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { type ReactNode } from 'react'
import AssistentePage from '../page'

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))

let mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))
import { useAuth } from '@/contexts/auth-context'

vi.mock('@/components/assistente/ChatUI', () => ({
  default: () => <div data-testid="chat-ui" />,
}))

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null, profile: null, role: null, loading: false,
    signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn(),
    signOutUser: vi.fn(), updateProfile: vi.fn(),
    ...overrides,
  }
}

describe('AssistentePage — gate de acesso', () => {
  beforeEach(() => { mockPush = vi.fn() })

  it('enquanto loading=true, nao redireciona nem renderiza o chat', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }))
    render(<AssistentePage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByTestId('chat-ui')).not.toBeInTheDocument()
  })

  it('usuario deslogado → redireciona para /login?redirect=/assistente', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: false, user: null }))
    render(<AssistentePage />)
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=/assistente')
  })

  it('usuario logado → renderiza o ChatUI, sem redirecionar', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      loading: false,
      user: { uid: 'uid-comprador', email: 'a@a.com', displayName: 'A' },
    }))
    render(<AssistentePage />)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('chat-ui')).toBeInTheDocument()
  })
})
```

### 4. Criar `front/src/components/assistente/__tests__/ChatUI.test.tsx`

```tsx
/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ChatUI from '../ChatUI'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('ChatUI', () => {
  it('envia mensagem de texto e mostra a resposta do assistente', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'text', content: 'qual tamanho você procura?' }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero uma fralda')
    await user.click(screen.getByLabelText('Enviar'))

    expect(screen.getByText('quero uma fralda')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('qual tamanho você procura?')).toBeInTheDocument())

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.messages).toEqual([{ role: 'user', content: 'quero uma fralda' }])
  })

  it('mostra a acao select_product como mensagem informativa (M6 ainda nao intercepta)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero 2 do p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/produto selecionado: p1/i)).toBeInTheDocument())
  })

  it('em caso de erro de rede, mostra mensagem de erro com retry sem perder o historico', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network fail'))
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'oi')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/não foi possível falar com o assistente/i)).toBeInTheDocument())
    expect(screen.getByText('oi')).toBeInTheDocument()
  })

  it('em caso de resposta HTTP nao-ok (500), mostra erro e o botao de retry chama apiFetch de novo', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'internal' }, 500))
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'oi')
    await user.click(screen.getByLabelText('Enviar'))
    await waitFor(() => expect(screen.getByText(/não foi possível falar com o assistente/i)).toBeInTheDocument())

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ type: 'text', content: 'ola de novo' }))
    await user.click(screen.getByText(/tentar de novo/i))

    await waitFor(() => expect(screen.getByText('ola de novo')).toBeInTheDocument())
    expect(vi.mocked(apiFetch).mock.calls).toHaveLength(2)
  })
})
```

## Testes e verificação (D-008)

Dentro de `front/`, nesta ordem:
1. Se `node_modules` não estiver instalado (verifique com `ls node_modules/.bin/vitest` a partir da
   raiz do worktree), rode `npm install` na raiz e AGUARDE terminar antes de prosseguir.
2. `npm test` — todos os testes verdes, incluindo os 3 casos novos de `page.test.tsx` e os 4 casos
   novos de `ChatUI.test.tsx` (suíte existente continua passando sem nenhuma mudança).
3. `npx tsc --noEmit` — sem erro de tipo.
4. `npm run lint` — exit 0 (front/ TEM eslint configurado, diferente de `back/` — não pule este passo).
5. `npm run build` — build de produção precisa passar (rota nova compilada).

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade na 3ª tentativa,
PARE e relate o obstáculo exato — não invente workaround.

## Critérios de aceite

- [ ] `front/src/components/assistente/ChatUI.tsx` criado, exatamente como especificado no passo 1.
- [ ] `front/src/app/(main)/assistente/page.tsx` criado, exatamente como especificado no passo 2.
- [ ] `front/src/app/(main)/assistente/__tests__/page.test.tsx` com os 3 casos do passo 3, todos verdes.
- [ ] `front/src/components/assistente/__tests__/ChatUI.test.tsx` com os 4 casos do passo 4, todos
      verdes.
- [ ] Deslogado, `/assistente` redireciona para `/login?redirect=/assistente`.
- [ ] `npm test`, `tsc --noEmit`, `lint`, `build` — todos passam.
- [ ] Nenhum arquivo fora de `front/src/components/assistente/` e `front/src/app/(main)/assistente/`
      criado ou modificado (não tocar em `back/`, `packages/contracts/`, nem em outras rotas/componentes
      do front).
- [ ] Nenhuma tentativa de adicionar item ao carrinho ou navegar pro checkout — isso é M6.

## Restrições

- **Não** implemente a interceptação da ação `select_product` (adicionar ao carrinho, navegar pro
  checkout) — isso é a tarefa M6. Quando a resposta for `type: 'action'`, só mostre a mensagem
  informativa especificada no passo 1.
- **Não** monte um link de `/assistente` no Header/menu — decisão registrada como fora desta thread na
  spec (posicionamento de UX fica pra depois).
- **Não** use `any`.
- **Não** modifique `back/` nem `packages/contracts/`.
- **Não** monte o header `Authorization` manualmente — sempre via `apiFetch`.
- Commit em português, Conventional Commits, mensagem:
  `feat(front): rota /assistente protegida + ChatUI (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal de `npm test`, `tsc --noEmit`, `lint`, `build`.
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio, ajuste de mecanismo ou decisão de detalhe tomada (ex.: se `Skill(ui-system)` estava
  disponível ou se seguiu o resumo escrito no prompt).
