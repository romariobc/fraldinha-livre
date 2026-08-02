# H-012 — Painel administrativo da plataforma (read-only, admin único)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-08-02) | **Status:** aguardando execucao
**Spec:** `.claude/docs/design/specs/spec-painel-admin.md` (aprovada 2026-08-02)

## Objetivo

Entregar a feature 012 do backlog na fatia acordada com o cliente: um painel
`/admin` somente leitura, acessivel só pelo UID fixo do admin, com 3 abas
(Usuarios, Pedidos, Produtos). Sem intervencao em disputas, sem acoes de
gestao, sem multiplos admins — tudo isso fica fora de escopo (ver spec).

## Contexto minimo

- Stack: `back/` = Hono + D1 + Drizzle (Cloudflare Workers); `front/` =
  Next.js App Router; `packages/contracts/` = schemas Zod compartilhados.
- Repo consolidado: front e back estao juntos na `main`, sem worktrees
  separados nesta fase (diferente de threads anteriores B/C).
- **UID fixo do admin:** `KOQclmb5eshfkufioK03ayRh6Fi2` (conta
  `romariobc@gmail.com`). Usa-se esse literal nas 3 pontas (backend, front,
  regra do Firestore) — nao e segredo, e so um identificador.
- Usuarios vivem só no Firestore (`users/{uid}`), nunca no D1. Pedidos e
  produtos vivem no D1, com rotas ja existentes filtradas por uid do dono.
- **Antes de tocar em qualquer componente/pagina do front (Tarefas 5-8),
  invocar `Skill(ui-system)` primeiro — regra do `AGENTS.md` da raiz do
  projeto ("Any UI component or layout work").**
- **NAO fazer deploy da regra nova do Firestore** (`firestore.rules`) —
  so validar sintaxe (Tarefa 9). Deploy de regra de producao e acao
  compartilhada/dificil de reverter; fica para a sessao-mae decidir com o
  cliente, fora deste prompt.

## Passo 0 — OBRIGATORIO antes de qualquer arquivo

Confirmar o diretorio de trabalho:
```bash
git rev-parse --show-toplevel
```
O resultado tem que ser `E:/Labdev/Projetos/fraldinha-livre` (repo principal,
branch `main`), NUNCA um worktree (`.claude/worktrees/...`). Se nao bater,
PARAR e relatar antes de continuar.

## Tarefas (nesta ordem)

### Tarefa 1 — Backend: var `ADMIN_UID`

1. `back/src/env.d.ts` — adicionar ao `interface Env`:
   ```ts
   /** UID fixo do admin unico da plataforma (feature 012, sem sistema de papeis multiplos). */
   ADMIN_UID: string
   ```
2. `back/wrangler.jsonc` — adicionar ao objeto `vars`:
   ```jsonc
   "vars": {
     "FIREBASE_PROJECT_ID": "fraldinha-livre",
     "NOTIFICATIONS_ENABLED": "false",
     "ADMIN_UID": "KOQclmb5eshfkufioK03ayRh6Fi2"
   }
   ```
   (Os testes usam o mesmo `wrangler.jsonc` via `cloudflareTest` — nao precisa
   de nenhuma config extra em `vitest.config.ts`.)
3. Commit: `git add back/src/env.d.ts back/wrangler.jsonc && git commit -m "feat(back): adiciona var ADMIN_UID (feature 012)"`

### Tarefa 2 — Backend: `GET /orders?scope=admin`

**Arquivo:** `back/src/routes/orders.ts` (modifica `ordersGetHandler`)
**Teste:** `back/test/orders.scope-admin.test.ts` (novo)

- [ ] Passo 1: escrever o teste falho primeiro, em
  `back/test/orders.scope-admin.test.ts`:
  ```ts
  import { describe, it, expect, beforeAll } from 'vitest'
  import { Hono } from 'hono'
  import { env } from 'cloudflare:workers'
  import { applyD1Migrations } from 'cloudflare:test'
  import { createAuthMiddleware } from '../src/middleware/auth'
  import { ordersGetHandler } from '../src/routes/orders'
  import type { Env, AppContext } from '../src/env'
  import type { Order } from '../../packages/contracts/src/order'

  describe('GET /orders?scope=admin', () => {
    beforeAll(async () => {
      await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    })

    const createTestApp = () => {
      const fakeVerify = async (token: string) => {
        if (token === 'token-admin') return { uid: env.ADMIN_UID }
        if (token === 'token-fornecedor-a') return { uid: 'uid-fornecedor-a' }
        return null
      }
      const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
      testApp.use('*', createAuthMiddleware(fakeVerify))
      testApp.get('/orders', ordersGetHandler)
      return testApp
    }

    it('GET /orders?scope=admin com uid nao-admin → 403', async () => {
      const app = createTestApp()
      const request = new Request('http://localhost/orders?scope=admin', {
        headers: { Authorization: 'Bearer token-fornecedor-a' },
      })
      const response = await app.fetch(request, env)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'forbidden' })
    })

    it('GET /orders?scope=admin sem token → 401', async () => {
      const app = createTestApp()
      const request = new Request('http://localhost/orders?scope=admin')
      const response = await app.fetch(request, env)
      expect(response.status).toBe(401)
    })

    it('GET /orders?scope=admin com uid admin → retorna TODOS os pedidos, de qualquer uid', async () => {
      const app = createTestApp()
      const addressJson = JSON.stringify({
        logradouro: 'Rua A', numero: '123', bairro: 'Centro',
        cidade: 'São Paulo', estado: 'SP', cep: '01000-000',
      })
      await env.DB.prepare(`
        INSERT INTO orders (id, uid, type, status, product, quantity, unit, delivery_address, created_at)
        VALUES ('order-admin-teste-1', 'uid-comprador-x', 'compra-direta', 'aguardando', 'Fralda X', 10, 'un', ?, datetime('now'))
      `).bind(addressJson).run()

      const request = new Request('http://localhost/orders?scope=admin', {
        headers: { Authorization: 'Bearer token-admin' },
      })
      const response = await app.fetch(request, env)
      expect(response.status).toBe(200)
      const body = (await response.json()) as unknown as Order[]
      expect(Array.isArray(body)).toBe(true)
      expect(body.some((o) => o.id === 'order-admin-teste-1')).toBe(true)
    })
  })
  ```
- [ ] Passo 2: rodar `cd back && npx vitest run test/orders.scope-admin.test.ts`
  — esperado FALHAR (403/200 nao batem, `scope=admin` ainda cai no `else` do
  handler que filtra por `uid`).
- [ ] Passo 3: implementar em `back/src/routes/orders.ts`, dentro de
  `ordersGetHandler`, adicionar um branch `else if` ANTES do `else` existente
  (que trata o caso "sem scope" / comprador):
  ```ts
  } else if (scope === 'admin') {
    if (uid !== c.env.ADMIN_UID) {
      return c.json({ error: 'forbidden' }, 403)
    }
    userOrders = await db.select().from(orders).all()
  } else {
  ```
  (o `if (scope === 'fornecedor') { ... }` que já existe continua como o
  primeiro branch, inalterado.)
- [ ] Passo 4: rodar `cd back && npx vitest run test/orders.scope-admin.test.ts`
  — esperado PASSAR. Rodar a suite inteira (`npx vitest run`) para confirmar
  que nada quebrou (regressão de `scope=fornecedor` e sem scope).
- [ ] Passo 5: commit
  ```bash
  git add back/src/routes/orders.ts back/test/orders.scope-admin.test.ts
  git commit -m "feat(back): GET /orders?scope=admin retorna todos os pedidos (feature 012)"
  ```

### Tarefa 3 — Backend: `GET /products?scope=admin` + fix do middleware

**Arquivos:**
- Modifica: `back/src/routes/products.ts` (`productsGetHandler`)
- Modifica: `back/src/index.ts:31-40` (middleware de `/products`)
- Teste: `back/test/products.scope-admin.test.ts` (novo)

**Achado importante:** o middleware atual de `/products` em `back/src/index.ts`
define `isPublicGet` como `method === 'GET' && scope !== 'fornecedor'` — ou
seja, `scope=admin` cairia como **público, sem exigir auth**. Isso tem que
ser corrigido junto, senão o `c.get('uid')` no handler vem `undefined` e
qualquer um acessa a lista completa sem token.

- [ ] Passo 1: escrever o teste falho primeiro, em
  `back/test/products.scope-admin.test.ts` (mesmo padrão de
  `back/test/products.get.test.ts`, reaproveitando `createTestApp` com
  `fakeVerify` mapeando `token-admin` → `env.ADMIN_UID` e
  `token-fornecedor-teste` → outro uid):
  ```ts
  import { describe, it, expect, beforeAll } from 'vitest'
  import { Hono } from 'hono'
  import { drizzle } from 'drizzle-orm/d1'
  import { env } from 'cloudflare:workers'
  import { applyD1Migrations } from 'cloudflare:test'
  import { createAuthMiddleware } from '../src/middleware/auth'
  import { productsGetHandler } from '../src/routes/products'
  import { products } from '../src/schema/products'
  import type { Env, AppContext } from '../src/env'

  describe('GET /products?scope=admin', () => {
    beforeAll(async () => {
      await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
      const db = drizzle(env.DB)
      await db.insert(products).values({
        id: 'produto-admin-teste',
        supplierId: 'uid-fornecedor-teste',
        name: 'Produto Admin Teste',
        brand: 'Marca Teste',
        size: 'M',
        quantity: 10,
        slug: 'produto-admin-teste',
        categoria: 'teste',
        descricao: 'Descricao',
        atributos: { faixaPeso: '5-9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'teste' },
        priceCents: 5000,
        active: false,
      })
    })

    const createTestApp = () => {
      const fakeVerify = async (token: string) => {
        if (token === 'token-admin') return { uid: env.ADMIN_UID }
        if (token === 'token-fornecedor-teste') return { uid: 'uid-fornecedor-teste' }
        return null
      }
      const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
      testApp.use('/products', async (c, next) => {
        const scope = c.req.query('scope')
        const isPublicGet = c.req.method === 'GET' && scope !== 'fornecedor' && scope !== 'admin'
        if (isPublicGet) return next()
        return createAuthMiddleware(fakeVerify)(c, next)
      })
      testApp.get('/products', productsGetHandler)
      return testApp
    }

    it('GET /products?scope=admin sem token → 401', async () => {
      const app = createTestApp()
      const request = new Request('http://localhost/products?scope=admin')
      const response = await app.fetch(request, env)
      expect(response.status).toBe(401)
    })

    it('GET /products?scope=admin com uid nao-admin → 403', async () => {
      const app = createTestApp()
      const request = new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-fornecedor-teste' },
      })
      const response = await app.fetch(request, env)
      expect(response.status).toBe(403)
    })

    it('GET /products?scope=admin com uid admin → retorna produtos ativos e inativos de qualquer fornecedor', async () => {
      const app = createTestApp()
      const request = new Request('http://localhost/products?scope=admin', {
        headers: { Authorization: 'Bearer token-admin' },
      })
      const response = await app.fetch(request, env)
      expect(response.status).toBe(200)
      const body = (await response.json()) as unknown[]
      const ids = body.map((p) => (p as Record<string, unknown>).id)
      expect(ids).toContain('produto-admin-teste')
    })
  })
  ```
- [ ] Passo 2: rodar `cd back && npx vitest run test/products.scope-admin.test.ts`
  — esperado FALHAR.
- [ ] Passo 3a: em `back/src/index.ts`, trocar a linha do `isPublicGet`
  (linha ~32) de:
  ```ts
  const isPublicGet = c.req.method === 'GET' && c.req.query('scope') !== 'fornecedor'
  ```
  para:
  ```ts
  const scope = c.req.query('scope')
  const isPublicGet = c.req.method === 'GET' && scope !== 'fornecedor' && scope !== 'admin'
  ```
- [ ] Passo 3b: em `back/src/routes/products.ts`, dentro de
  `productsGetHandler`, adicionar branch ANTES do `if (scope === 'fornecedor')`
  existente (ou como `else if` logo depois dele — a ordem entre os dois não
  importa, só que ambos venham antes do fallback público):
  ```ts
  if (scope === 'admin') {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    if (uid !== c.env.ADMIN_UID) {
      return c.json({ error: 'forbidden' }, 403)
    }
    const rows = await db.select().from(products).all()
    return c.json(rows.map(normalizeBadge))
  }

  if (scope === 'fornecedor') {
    // ... código existente, inalterado
  ```
- [ ] Passo 4: rodar `cd back && npx vitest run test/products.scope-admin.test.ts`
  — esperado PASSAR. Rodar a suite inteira (`npx vitest run`) — confirmar
  que `products.get.test.ts` e `products.crud.test.ts` continuam verdes (a
  mudança do middleware não pode afetar `scope=fornecedor` nem o GET público).
- [ ] Passo 5: commit
  ```bash
  git add back/src/index.ts back/src/routes/products.ts back/test/products.scope-admin.test.ts
  git commit -m "feat(back): GET /products?scope=admin retorna todos os produtos (feature 012)"
  ```

### Tarefa 4 — Backend: rodar suite completa + tsc

- [ ] `cd back && npx vitest run` — esperado 100% verde (contar total e
  comparar com o número reportado antes desta tarefa, ex.: "63/63" viravam
  "69/69" ou o que for — reportar o número exato).
- [ ] `cd back && npx tsc --noEmit` — esperado 0 erros.
- Sem commit nesta tarefa (é só verificação; se algo falhar, voltar pra
  Tarefa 2/3 e corrigir).

### Tarefa 5 — Frontend: var `NEXT_PUBLIC_ADMIN_UID`

**IMPORTANTE:** invocar `Skill(ui-system)` antes desta tarefa (regra do
`AGENTS.md`) — mesmo sendo só uma env var, ela é consumida por componentes
que virão nas próximas tarefas.

1. `front/.env.production` — adicionar ao final:
   ```
   # UID fixo do admin da plataforma (feature 012) — nao e segredo, so um identificador.
   NEXT_PUBLIC_ADMIN_UID=KOQclmb5eshfkufioK03ayRh6Fi2
   ```
2. `front/.env.local` (gitignored, NÃO commitar — se não existir a linha,
   adicionar; se `.env.local` não existir no ambiente de execução, pular
   este passo e registrar no relatório final que falta adicionar
   manualmente antes de testar localmente):
   ```
   NEXT_PUBLIC_ADMIN_UID=KOQclmb5eshfkufioK03ayRh6Fi2
   ```
3. Commit (só o `.env.production`, `.env.local` é gitignored):
   ```bash
   git add front/.env.production
   git commit -m "feat(front): adiciona var NEXT_PUBLIC_ADMIN_UID (feature 012)"
   ```

### Tarefa 6 — Frontend: página `/admin` com gate de acesso

**Arquivo:** `front/src/app/admin/page.tsx` (novo, fora do route group
`(main)` — sem `MarketProvider`/`CartProvider`, só precisa do `AuthProvider`
global do `layout.tsx` raiz)
**Teste:** `front/src/app/admin/__tests__/page.test.tsx` (novo)

- [ ] Passo 1: escrever o teste falho primeiro. Seguir o padrão de mocks já
  usado em `front/src/app/(main)/checkout/__tests__/page.test.tsx` (mock de
  `@/lib/firebase`, `firebase/auth`, `next/navigation`, `@/contexts/auth-context`):
  ```tsx
  /// <reference types="vitest/globals" />
  import { render, screen } from '@testing-library/react'
  import { vi } from 'vitest'
  import { type ReactNode } from 'react'
  import AdminPage from '../page'

  vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
  vi.mock('firebase/firestore', () => ({
    collection: vi.fn(), getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  }))

  let mockPush = vi.fn()
  vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

  vi.mock('@/contexts/auth-context', () => ({
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  }))
  import { useAuth } from '@/contexts/auth-context'

  function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
    return {
      user: null, profile: null, role: null, loading: false,
      signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn(),
      signOutUser: vi.fn(), updateProfile: vi.fn(),
      ...overrides,
    }
  }

  describe('AdminPage — gate de acesso', () => {
    beforeEach(() => { mockPush = vi.fn() })

    it('enquanto loading=true, nao redireciona nem renderiza conteudo', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }))
      render(<AdminPage />)
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('usuario deslogado → redireciona para /', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ loading: false, user: null }))
      render(<AdminPage />)
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('usuario logado mas nao-admin → redireciona para /', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({
        loading: false,
        user: { uid: 'uid-qualquer', email: 'a@a.com', displayName: 'A' },
      }))
      render(<AdminPage />)
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('usuario logado com UID admin → renderiza as 3 abas, sem redirecionar', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({
        loading: false,
        user: { uid: process.env.NEXT_PUBLIC_ADMIN_UID!, email: 'admin@a.com', displayName: 'Admin' },
      }))
      render(<AdminPage />)
      expect(mockPush).not.toHaveBeenCalled()
      expect(screen.getByText('Usuários')).toBeInTheDocument()
      expect(screen.getByText('Pedidos')).toBeInTheDocument()
      expect(screen.getByText('Produtos')).toBeInTheDocument()
    })
  })
  ```
- [ ] Passo 2: rodar
  `cd front && npx vitest run src/app/admin/__tests__/page.test.tsx` —
  esperado FALHAR (`../page` ainda não existe).
- [ ] Passo 3: implementar `front/src/app/admin/page.tsx`:
  ```tsx
  'use client'

  import { useEffect, useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
  import { useAuth } from '@/contexts/auth-context'
  import AdminUsersTab from '@/components/admin/AdminUsersTab'
  import AdminOrdersTab from '@/components/admin/AdminOrdersTab'
  import AdminProductsTab from '@/components/admin/AdminProductsTab'

  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID

  type TabKey = 'usuarios' | 'pedidos' | 'produtos'

  export default function AdminPage() {
    const router = useRouter()
    const { user, loading } = useAuth()
    const [activeTab, setActiveTab] = useState<TabKey>('usuarios')

    useEffect(() => {
      if (loading) return
      if (!user || user.uid !== ADMIN_UID) {
        router.push('/')
      }
    }, [loading, user, router])

    if (loading || !user || user.uid !== ADMIN_UID) {
      return null
    }

    return (
      <div className="container-fl py-8">
        <h1 className="font-display font-black text-2xl mb-6">Painel Administrativo</h1>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
          </TabsList>
          <TabsContent value="usuarios"><AdminUsersTab /></TabsContent>
          <TabsContent value="pedidos"><AdminOrdersTab /></TabsContent>
          <TabsContent value="produtos"><AdminProductsTab /></TabsContent>
        </Tabs>
      </div>
    )
  }
  ```
  (`AdminUsersTab`/`AdminOrdersTab`/`AdminProductsTab` são criados nas
  Tarefas 7-9 — até lá o `import` falha; escrever essas 3 tarefas ANTES de
  rodar o teste do Passo 4 abaixo, ou criar stubs mínimos que só retornam
  `null` para o teste desta tarefa passar isoladamente, e substituir os
  stubs de verdade nas Tarefas 7-9.)
- [ ] Passo 4: rodar
  `cd front && npx vitest run src/app/admin/__tests__/page.test.tsx` —
  esperado PASSAR.
- [ ] Passo 5: commit
  ```bash
  git add front/src/app/admin/page.tsx front/src/app/admin/__tests__/page.test.tsx
  git commit -m "feat(front): pagina /admin com gate de acesso por UID fixo (feature 012)"
  ```

### Tarefa 7 — Frontend: aba Usuários (Firestore)

**Arquivo:** `front/src/components/admin/AdminUsersTab.tsx` (novo)
**Teste:** `front/src/components/admin/__tests__/AdminUsersTab.test.tsx` (novo)

- [ ] Passo 1: teste falho, mockando `firebase/firestore`:
  ```tsx
  /// <reference types="vitest/globals" />
  import { render, screen, waitFor } from '@testing-library/react'
  import { vi } from 'vitest'
  import AdminUsersTab from '../AdminUsersTab'

  vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
  vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({
      docs: [
        { id: 'uid-1', data: () => ({ role: 'comprador', name: 'Ana', email: 'ana@a.com' }) },
        { id: 'uid-2', data: () => ({ role: 'fornecedor', name: 'João', email: 'joao@a.com' }) },
      ],
    }),
  }))

  describe('AdminUsersTab', () => {
    it('renderiza os usuarios retornados do Firestore', async () => {
      render(<AdminUsersTab />)
      await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
      expect(screen.getByText('João')).toBeInTheDocument()
      expect(screen.getByText('comprador')).toBeInTheDocument()
      expect(screen.getByText('fornecedor')).toBeInTheDocument()
    })

    it('mostra erro se a query do Firestore falhar (ex.: permission-denied)', async () => {
      const { getDocs } = await import('firebase/firestore')
      vi.mocked(getDocs).mockRejectedValueOnce(new Error('permission-denied'))
      render(<AdminUsersTab />)
      await waitFor(() => expect(screen.getByText(/erro ao carregar usu/i)).toBeInTheDocument())
    })
  })
  ```
- [ ] Passo 2: rodar
  `cd front && npx vitest run src/components/admin/__tests__/AdminUsersTab.test.tsx`
  — esperado FALHAR.
- [ ] Passo 3: implementar `front/src/components/admin/AdminUsersTab.tsx`:
  ```tsx
  'use client'

  import { useEffect, useState } from 'react'
  import { collection, getDocs } from 'firebase/firestore'
  import { db } from '@/lib/firebase'
  import type { UserProfile } from '@/contexts/auth-context'

  interface UserRow extends UserProfile {
    uid: string
  }

  export default function AdminUsersTab() {
    const [users, setUsers] = useState<UserRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      getDocs(collection(db, 'users'))
        .then((snapshot) => {
          setUsers(snapshot.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) })))
        })
        .catch(() => setError('Erro ao carregar usuários.'))
    }, [])

    if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
    if (!users) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Nome</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Papel</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid} className="border-b">
              <td className="py-2">{u.name}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  ```
- [ ] Passo 4: rodar o teste — esperado PASSAR.
- [ ] Passo 5: commit
  ```bash
  git add front/src/components/admin/AdminUsersTab.tsx front/src/components/admin/__tests__/AdminUsersTab.test.tsx
  git commit -m "feat(front): aba Usuarios do painel admin, le Firestore direto (feature 012)"
  ```

### Tarefa 8 — Frontend: aba Pedidos (backend `scope=admin`)

**Arquivo:** `front/src/components/admin/AdminOrdersTab.tsx` (novo)
**Teste:** `front/src/components/admin/__tests__/AdminOrdersTab.test.tsx` (novo)

- [ ] Passo 1: teste falho, mockando `@/lib/api-client`:
  ```tsx
  /// <reference types="vitest/globals" />
  import { render, screen, waitFor } from '@testing-library/react'
  import { vi } from 'vitest'
  import AdminOrdersTab from '../AdminOrdersTab'

  vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
  import { apiFetch } from '@/lib/api-client'

  function jsonResponse(body: unknown, status = 200) {
    return { ok: status < 400, status, json: async () => body } as Response
  }

  describe('AdminOrdersTab', () => {
    it('renderiza os pedidos retornados de GET /orders?scope=admin', async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        jsonResponse([
          { id: 'order-1', uid: 'uid-x', status: 'aguardando', product: 'Fralda A', price: 5000 },
        ]),
      )
      render(<AdminOrdersTab />)
      await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())
      expect(apiFetch).toHaveBeenCalledWith('/orders?scope=admin')
    })

    it('mostra erro se a resposta nao for ok (ex.: 403)', async () => {
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
      render(<AdminOrdersTab />)
      await waitFor(() => expect(screen.getByText(/erro ao carregar pedidos/i)).toBeInTheDocument())
    })
  })
  ```
- [ ] Passo 2: rodar o teste — esperado FALHAR.
- [ ] Passo 3: implementar `front/src/components/admin/AdminOrdersTab.tsx`:
  ```tsx
  'use client'

  import { useEffect, useState } from 'react'
  import { apiFetch } from '@/lib/api-client'
  import type { Order } from '../../../../packages/contracts/src/order'

  export default function AdminOrdersTab() {
    const [orders, setOrders] = useState<Order[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      apiFetch('/orders?scope=admin')
        .then(async (res) => {
          if (!res.ok) throw new Error('nao ok')
          setOrders((await res.json()) as Order[])
        })
        .catch(() => setError('Erro ao carregar pedidos.'))
    }, [])

    if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
    if (!orders) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">ID</th>
            <th className="py-2">Comprador</th>
            <th className="py-2">Produto</th>
            <th className="py-2">Status</th>
            <th className="py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="py-2">{o.id}</td>
              <td className="py-2">{o.uid}</td>
              <td className="py-2">{o.product}</td>
              <td className="py-2">{o.status}</td>
              <td className="py-2">{o.price != null ? `R$ ${(o.price / 100).toFixed(2)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  ```
  Ajustar o caminho do import de `Order` se o path relativo não bater com a
  localização real de `packages/contracts/src/order.ts` a partir de
  `front/src/components/admin/` — conferir com os imports já existentes em
  `front/src/lib/` que também consomem `packages/contracts` (regra
  [[feedback-zod-versao-packages-contracts]]: **nunca** importar `zod`
  direto no front, só os tipos/schemas já prontos de `@contracts`).
- [ ] Passo 4: rodar o teste — esperado PASSAR.
- [ ] Passo 5: commit
  ```bash
  git add front/src/components/admin/AdminOrdersTab.tsx front/src/components/admin/__tests__/AdminOrdersTab.test.tsx
  git commit -m "feat(front): aba Pedidos do painel admin, consome GET /orders?scope=admin (feature 012)"
  ```

### Tarefa 9 — Frontend: aba Produtos (backend `scope=admin`)

**Arquivo:** `front/src/components/admin/AdminProductsTab.tsx` (novo)
**Teste:** `front/src/components/admin/__tests__/AdminProductsTab.test.tsx` (novo)

Mesmo padrão exato da Tarefa 8, trocando `/orders?scope=admin` por
`/products?scope=admin` e o tipo `Order` por `Product`
(`packages/contracts/src/product.ts`). Colunas da tabela: nome, marca,
fornecedor (`supplierId`), preço (`priceCents`), ativo (`active`).

- [ ] Passo 1: teste falho (mesmo padrão da Tarefa 8, adaptado pra produtos).
- [ ] Passo 2: rodar o teste — esperado FALHAR.
- [ ] Passo 3: implementar `front/src/components/admin/AdminProductsTab.tsx`
  seguindo a mesma estrutura de `AdminOrdersTab.tsx` (fetch em `useEffect`,
  estados `loading`/`error`/dados, tabela).
- [ ] Passo 4: rodar o teste — esperado PASSAR.
- [ ] Passo 5: commit
  ```bash
  git add front/src/components/admin/AdminProductsTab.tsx front/src/components/admin/__tests__/AdminProductsTab.test.tsx
  git commit -m "feat(front): aba Produtos do painel admin, consome GET /products?scope=admin (feature 012)"
  ```

### Tarefa 10 — Firestore: regra nova pro admin ler todos os usuários

**Arquivo:** `firestore.rules` (raiz do repo)

- [ ] Passo 1: editar a regra `match /users/{uid}` pra liberar leitura
  também pro UID admin:
  ```
  match /users/{uid} {
    allow read:   if request.auth != null
                  && (request.auth.uid == uid || request.auth.uid == 'KOQclmb5eshfkufioK03ayRh6Fi2');
    allow create: if request.auth != null && request.auth.uid == uid;
    allow update: if request.auth != null && request.auth.uid == uid
                  && request.resource.data.role == resource.data.role;
    allow delete: if false;
  }
  ```
  (Só a linha `allow read` muda — `create`/`update`/`delete` continuam
  exatamente como estavam, RN-04/D-013 não é afetada.)
- [ ] Passo 2: validar a sintaxe da regra com a ferramenta MCP do Firebase
  (`mcp__firebase__firebase_validate_security_rules`, `type: "firestore"`,
  `source_file: "firestore.rules"`). Reportar o resultado no relatório
  final. **NÃO** rodar `firebase deploy --only firestore:rules` nem
  qualquer comando de deploy — essa regra só é aplicada em produção depois
  de revisão humana (é infraestrutura compartilhada, fora do escopo deste
  prompt).
- [ ] Passo 3: commit
  ```bash
  git add firestore.rules
  git commit -m "feat: libera leitura de todos os usuarios pro UID admin fixo (feature 012)"
  ```

### Tarefa 11 — Verificação final completa

Executar ANTES do relatório, nesta ordem:
1. `cd back && npx vitest run` — 100% verde, reportar contagem exata.
2. `cd back && npx tsc --noEmit` — 0 erros.
3. `cd front && npm run lint` — 0 erros.
4. `cd front && npx tsc --noEmit` — 0 erros.
5. `cd front && npx vitest run` — 100% verde, reportar contagem exata (comparar
   com o total anterior a esta tarefa).
6. `cd front && npm run build` — build de produção sem erros.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3
TENTATIVAS por item. Após a 3ª falha: PARE. Não improvise, não mude a
abordagem por conta própria. Relate o que falhou, o que tentou em cada
tentativa e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `GET /orders?scope=admin` com UID admin retorna todos os pedidos de
  qualquer comprador; com UID não-admin retorna 403; sem token retorna 401.
- [ ] `GET /products?scope=admin` com UID admin retorna todos os produtos
  (ativos e inativos) de qualquer fornecedor; com UID não-admin retorna 403;
  sem token retorna 401.
- [ ] `GET /products` sem scope (rota pública) continua funcionando sem auth
  — a mudança do middleware não pode quebrar isso (regressão coberta pelos
  testes existentes de `products.get.test.ts`).
- [ ] `GET /products?scope=fornecedor` continua funcionando como antes
  (regressão coberta por `products.get.test.ts`).
- [ ] `/admin` no front: usuário deslogado ou com UID diferente do admin é
  redirecionado para `/`; usuário com o UID admin vê as 3 abas.
- [ ] Aba Usuários lê a coleção `users` do Firestore e lista nome/email/papel.
- [ ] Aba Pedidos consome `GET /orders?scope=admin` e lista id/comprador/
  produto/status/total.
- [ ] Aba Produtos consome `GET /products?scope=admin` e lista nome/marca/
  fornecedor/preço/ativo.
- [ ] `firestore.rules` tem a regra nova, validada por sintaxe (MCP), **não**
  deployada.
- [ ] Nenhuma ação de escrita/gestão foi implementada (RN-05 da spec) —
  as 3 abas são só leitura.
- [ ] Todas as verificações da Tarefa 11 passam.

## Restrições

- **Não** implementar nada de "intervir em disputas" — fora de escopo (spec,
  seção "Fora de escopo").
- **Não** criar um papel `admin` novo em `UserRole` nem qualquer fluxo de
  promoção/convite de admins — é UID único hardcoded.
- **Não** adicionar paginação, filtros ou busca nas 3 tabelas — YAGNI nesta
  fatia.
- **Não** fazer deploy de `firestore.rules` para produção — só validar
  sintaxe (Tarefa 10, Passo 2).
- **Não** tocar em `front/src/components/ui/`, `tailwind.config.ts`, ou
  layout compartilhado (`front/src/app/layout.tsx`,
  `front/src/components/Header.tsx`) — se algo nessas áreas parecer
  necessário, PARE e reporte em vez de decidir sozinho (regra
  `risk-zone-protocol` do `AGENTS.md`).
- Commits em português (Conventional Commits), um por tarefa, nunca um
  commit gigante no final.

## Relatório esperado

- Lista de arquivos criados/modificados (backend e frontend).
- Resultado de cada verificação da Tarefa 11 (comandos + saída resumida).
- Contagem de testes antes/depois (back e front).
- Confirmação explícita de que `front/.env.local` recebeu
  `NEXT_PUBLIC_ADMIN_UID` (ou nota de que precisa ser adicionado manualmente,
  se o arquivo não existia no ambiente de execução).
- Resultado da validação de sintaxe do `firestore.rules` (Tarefa 10, Passo 2).
- Qualquer desvio do prompt e por quê.
