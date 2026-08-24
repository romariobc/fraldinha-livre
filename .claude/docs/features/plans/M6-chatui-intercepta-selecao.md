# M6 — front/: ChatUI intercepta select_product → carrinho + checkout

**Executor:** subagente | **Autor:** sessão-mãe (2026-08-02) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M6, dep: M4 — APROVADA, M5 — APROVADA)

## Objetivo

Fechar o laço do chat-agent: quando `POST /chat/message` responder com a ação estruturada
`select_product`, o `ChatUI` (criado em M5, hoje só mostra uma mensagem informativa nesse caso) passa a
**adicionar o produto ao carrinho de verdade e navegar pro checkout** — o mesmo checkout que já existe
(S5a/S5b), sem reimplementar nada dele. Depois desta tarefa, a feature 018 está funcionalmente completa
(falta só o deploy/QA, M7).

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
- **Este é trabalho de UI transversal — invoque `Skill(ui-system)` se disponível** (mesma orientação de
  M5). Esta tarefa não adiciona JSX novo, só lógica — mas ainda mexe no componente de UI.
- **Padrão a copiar EXATAMENTE — é o mesmo fluxo que "Comprar agora" já usa hoje**, em
  `front/src/app/(main)/produto/[slug]/page.tsx`, função `handleBuyNow`:
  1. Busca o produto na lista já carregada por `useProducts()` (`@/contexts/products-context` — já
     consome o backend real via `ProductRepository`, é a MESMA fonte de dados do catálogo público; não
     crie um fetch novo).
  2. Verifica `isProfileComplete(profile)` (de `@/lib/utils`, `profile` vem de `useAuth()`) — se
     incompleto, `router.push('/minha-conta?tab=perfil&returnTo=/assistente')` (mesmo padrão do
     `returnTo` que a página de produto já usa, só que apontando pra `/assistente` em vez do slug).
     **Esta trava (RN-06) não é invenção desta tarefa — é a mesma regra que "Comprar agora" já aplica;
     pular ela aqui seria abrir um atalho pro checkout sem perfil completo, que o resto do site não
     permite.**
  3. Busca o fornecedor em `STORE_SUPPLIERS` (`@/lib/suppliers`) pelo `supplierId` do produto, monta um
     `CartItem` (`@/lib/domain/cart`) — campos e formato **idênticos** aos que `handleBuyNow` já monta
     (`productId`, `productName` = `` `${product.name} ${product.size}` ``, `supplierId`,
     `supplierName`, `unitPrice` = `product.priceInCents`, `quantity` = a quantidade que veio da ação,
     `unit: 'un'`).
  4. `cart.addItem(cartItem)` (via `useCart()` de `@/contexts/cart-context`) e
     `router.push('/checkout')`.
- **Casos que "Comprar agora" não precisa tratar mas o chat precisa** (o LLM pode errar/alucinar, o
  clique num botão do catálogo não): `productId` que não existe na lista de `useProducts()` (produto
  removido, ou o modelo inventou um id), e a lista de produtos ainda estar carregando
  (`useProducts().loading`). Em ambos os casos: **não** adiciona ao carrinho, **não** navega — só mostra
  uma mensagem de assistente informando o problema (ver código do passo 1).
- **Teste de referência pra copiar o padrão de mock (perfil completo/incompleto, produto real, fornecedor
  real):** `front/src/app/(main)/produto/[slug]/__tests__/page.test.tsx`, casos "Comprar agora" — usa o
  produto real `p1` (`Supersec Pants`, `sup-001` = fornecedor `Distribuidora Sul`, `priceInCents: 1800`)
  de `PRODUCTS` (`@/lib/products`), e um perfil completo com CPF válido de teste `'11144477735'`. Reuse
  esses mesmos dados reais — não invente outro produto/CPF.

## Tarefas (nesta ordem)

### 1. Substituir o conteúdo de `front/src/components/assistente/ChatUI.tsx`

Arquivo inteiro (M5 criou a versão anterior; esta tarefa modifica a lógica de `sendToBackend` e adiciona
os hooks novos — o JSX de renderização, no final do arquivo, **não muda**):

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Paperclip, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useProducts } from '@/contexts/products-context'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { isProfileComplete } from '@/lib/utils'
import type { CartItem } from '@/lib/domain/cart'
import type { ChatMessage, ChatResponse } from '@contracts'

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const cart = useCart()
  const { profile } = useAuth()
  const { products, loading: productsLoading } = useProducts()

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
        return
      }

      if (productsLoading) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Só um instante, ainda estou carregando o catálogo. Tenta de novo.' },
        ])
        return
      }

      const product = products.find((p) => p.id === data.productId)
      if (!product) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Não encontrei esse produto no catálogo agora. Pode tentar de novo?' },
        ])
        return
      }

      if (!isProfileComplete(profile)) {
        router.push('/minha-conta?tab=perfil&returnTo=/assistente')
        return
      }

      const supplier = STORE_SUPPLIERS.find((s) => s.id === product.supplierId)
      const cartItem: CartItem = {
        productId: product.id,
        productName: `${product.name} ${product.size}`,
        supplierId: product.supplierId,
        supplierName: supplier?.name || 'Fornecedor desconhecido',
        unitPrice: product.priceInCents,
        quantity: data.quantity,
        unit: 'un',
      }
      cart.addItem(cartItem)
      router.push('/checkout')
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

Comentários no arquivo: **não adicione nenhum** — o código já é autoexplicativo.

### 2. Substituir o conteúdo de `front/src/components/assistente/__tests__/ChatUI.test.tsx`

O arquivo de M5 mockava só `apiFetch`. Agora o componente também usa `next/navigation`, `useAuth`,
`useCart` e `useProducts` — TODOS precisam de mock, senão os testes existentes quebram. **O caso de
teste de M5 "mostra a ação select_product como mensagem informativa" deixa de fazer sentido** (essa
tarefa muda esse comportamento de propósito) — substitua-o pelos 3 casos novos abaixo. Arquivo inteiro:

```tsx
/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ChatUI from '../ChatUI'
import { PRODUCTS } from '@/lib/products'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

let mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@/contexts/auth-context'

vi.mock('@/contexts/cart-context', () => ({ useCart: vi.fn() }))
import { useCart } from '@/contexts/cart-context'

vi.mock('@/contexts/products-context', () => ({ useProducts: vi.fn() }))
import { useProducts } from '@/contexts/products-context'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

const COMPLETE_PROFILE = {
  role: 'comprador' as const,
  name: 'Test User',
  email: 'test@example.com',
  cpf: '11144477735',
  phone: '11999999999',
  address: {
    logradouro: 'Rua A',
    numero: '123',
    bairro: 'Bairro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01234-567',
  },
}

describe('ChatUI', () => {
  let mockAddItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(apiFetch).mockClear()
    mockPush = vi.fn()
    mockAddItem = vi.fn()

    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
      profile: COMPLETE_PROFILE,
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })
    vi.mocked(useCart).mockReturnValue({
      items: [],
      itemCount: 0,
      subtotal: 0,
      bySupplier: new Map(),
      addItem: mockAddItem,
      removeItem: vi.fn(),
      updateQty: vi.fn(),
      clear: vi.fn(),
    })
    vi.mocked(useProducts).mockReturnValue({ products: PRODUCTS, loading: false, error: null })
  })

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

  it('acao select_product com produto real e perfil completo: adiciona ao carrinho e vai pro checkout', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero 2 do p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() =>
      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: 'Distribuidora Sul',
        unitPrice: 1800,
        quantity: 2,
        unit: 'un',
      }),
    )
    expect(mockPush).toHaveBeenCalledWith('/checkout')
  })

  it('acao select_product com perfil incompleto: redireciona pro perfil, nao adiciona ao carrinho', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
      profile: { ...COMPLETE_PROFILE, cpf: '' },
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 1 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero o p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/minha-conta?tab=perfil&returnTo=/assistente'),
    )
    expect(mockAddItem).not.toHaveBeenCalled()
  })

  it('acao select_product com productId inexistente no catalogo local: mensagem informativa, sem carrinho nem redirect', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'produto-fantasma', quantity: 1 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero o fantasma')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/não encontrei esse produto/i)).toBeInTheDocument())
    expect(mockAddItem).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
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

### 3. Conferir `front/src/app/(main)/assistente/__tests__/page.test.tsx` (criado em M5)

Esse arquivo mocka `ChatUI` inteiro (`vi.mock('@/components/assistente/ChatUI', ...)`), então as
mudanças desta tarefa **não deveriam quebrá-lo**. Rode a suíte completa (passo de testes abaixo) e
confirme que ele continua verde sem precisar de nenhuma alteração. Se quebrar, PARE e relate — não é
esperado, é sinal de algo errado.

## Testes e verificação (D-008)

Dentro de `front/`, nesta ordem:
1. Se `node_modules` não estiver instalado, rode `npm install` na raiz e AGUARDE terminar.
2. `npm test` — todos os testes verdes, incluindo os 6 casos de `ChatUI.test.tsx` (2 herdados de M5,
   modificados/mantidos; 3 novos desta tarefa; o 6º, de retry HTTP 500, herdado sem mudança) e os 3 de
   `page.test.tsx` (sem alteração, deve continuar verde).
3. `npx tsc --noEmit` — sem erro de tipo.
4. `npm run lint` — exit 0 (mesmos 2 warnings pré-existentes de M5 são esperados, não são erro).
5. `npm run build` — build de produção precisa passar.

**Loop:** máximo 3 tentativas por problema específico encontrado. Se travar de verdade na 3ª tentativa,
PARE e relate o obstáculo exato — não invente workaround.

## Critérios de aceite

- [ ] `front/src/components/assistente/ChatUI.tsx` substituído, exatamente como especificado no passo 1.
- [ ] `front/src/components/assistente/__tests__/ChatUI.test.tsx` substituído, exatamente como
      especificado no passo 2 (6 casos).
- [ ] `front/src/app/(main)/assistente/__tests__/page.test.tsx` (de M5) continua verde, sem
      modificação.
- [ ] Ação `select_product` com produto real e perfil completo: `addItem` chamado com os campos certos,
      `router.push('/checkout')` chamado.
- [ ] Ação `select_product` com perfil incompleto: redireciona pro perfil
      (`/minha-conta?tab=perfil&returnTo=/assistente`), **não** adiciona ao carrinho.
- [ ] Ação `select_product` com `productId` que não existe na lista local: mensagem informativa,
      **não** adiciona ao carrinho, **não** navega.
- [ ] `npm test`, `tsc --noEmit`, `lint`, `build` — todos passam.
- [ ] Nenhum arquivo de checkout (`front/src/app/(main)/checkout/`, contexto de checkout se existir)
      **tocado** — só consumido via `router.push('/checkout')`.
- [ ] `back/`, `packages/contracts/` **não tocados**.

## Restrições

- **Não** modifique o checkout em si — só navega pra ele.
- **Não** invente outro produto/CPF de teste — use `p1`/`Distribuidora Sul`/`'11144477735'`, os mesmos
  já usados em `produto/[slug]/__tests__/page.test.tsx`.
- **Não** pule a checagem de perfil completo (RN-06) — é a mesma regra que "Comprar agora" já aplica.
- **Não** use `any`.
- **Não** modifique `back/` nem `packages/contracts/`.
- Commit em português, Conventional Commits, mensagem:
  `feat(front): chat-agent seleciona produto e abre o checkout existente (thread M)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal de `npm test`, `tsc --noEmit`, `lint`, `build`.
- Hash do commit (`git log -1 --oneline`).
- Confirmação do `git rev-parse --show-toplevel` do Passo 0 (colar a saída literal).
- Qualquer bloqueio, ajuste de mecanismo ou decisão de detalhe tomada.
