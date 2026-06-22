# Guia de Integração Frontend — Backend Real

> **Versão:** maio/2026 | **Stack:** Next.js 16 + NextAuth 5 + TypeScript

Este guia cobre a migração completa dos mocks locais para o backend real da Fraldinha Livre. Siga a ordem das seções para evitar quebras em cascata.

---

## 1. Configuração de ambiente

Crie o arquivo `.env.local` na raiz do projeto frontend (`E:\ROMARIO PC\fraldinha-livre\.env.local`):

```env
# URL do backend — troque para produção no deploy
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth — deve ser igual ao JWT_SECRET do backend
NEXTAUTH_SECRET=mesmo-valor-que-backend-JWT_SECRET
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (preencher quando configurado)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

> **Importante:** `NEXT_PUBLIC_API_URL` fica exposto ao browser. Nunca coloque segredos nessa variável.
> Em produção, `NEXTAUTH_URL` deve apontar para `https://fraldinha-livre.com`.

---

## 2. Criar o API client

Crie o arquivo `src/lib/api-client.ts`:

```typescript
import { getSession } from 'next-auth/react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Redireciona para login preservando a rota atual
    if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
    throw new Error('Não autenticado')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: await getAuthHeaders(),
  })
  return handleResponse<T>(res)
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  })
  return handleResponse<T>(res)
}
```

> **Uso em Server Components:** use `getServerSession` do NextAuth em vez de `getSession`. O `api-client.ts` acima serve para Client Components e Route Handlers.

---

## 3. Instalar e configurar NextAuth

### 3.1 Instalação

```bash
npm install next-auth@5
```

### 3.2 Criar o handler de autenticação

Crie `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        })

        if (!res.ok) return null

        const data = await res.json()
        // Espera-se: { accessToken, user: { id, name, email, role } }
        return {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          accessToken: data.accessToken,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.accessToken = (user as any).accessToken
      }
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role as string
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})

export { handler as GET, handler as POST }
```

### 3.3 Tipos do NextAuth (TypeScript)

Crie `src/types/next-auth.d.ts`:

```typescript
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    user: {
      id: string
      name: string
      email: string
      role: 'COMPRADOR' | 'FORNECEDOR' | 'ADMIN'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    accessToken: string
  }
}
```

---

## 4. Remover os mocks — tabela completa

| Arquivo mock | Ação | Substituto |
|---|---|---|
| `src/lib/auth-mock.ts` | **DELETAR** após integrar NextAuth | `useSession()` do NextAuth (veja Seção 10) |
| `src/lib/account-mock.ts` | **DELETAR** | `GET /comprador/pedidos`, `/comprador/cotacoes`, `/comprador/historico` |
| `src/lib/products.ts` | **MANTER como fallback** inicialmente, depois deletar | `GET /produtos` com query params |
| `src/lib/supplier-mock.ts` | **DELETAR** | `GET /fornecedor/*` (endpoints detalhados na Seção 5) |

> **Estratégia segura:** remova um mock por vez, testando cada rota antes de partir para o próximo.

---

## 5. Migrar cada página — instruções específicas

### `/catalogo`

**Antes (mock):**
```typescript
import { MOCK_PRODUCTS } from '@/lib/products'
const products = MOCK_PRODUCTS
```

**Depois (API):**
```typescript
// src/app/(main)/catalogo/page.tsx
import { get } from '@/lib/api-client'

const data = await get<{ products: Product[]; total: number }>(
  `/produtos?page=${page}&limit=20&categoria=${categoria}&marca=${marca}`
)
```

- `CatalogFilters` — ao alterar filtro, atualize os query params da URL usando `useRouter().push()`. O componente de página relê os `searchParams` e reexecuta o fetch.
- `ProductCard` — `supplierId` e dados do fornecedor agora vêm no objeto produto retornado pela API. Não precisa lookup separado.

---

### `/minha-conta`

**Antes (mock):**
```typescript
import { MOCK_ORDERS, MOCK_QUOTES } from '@/lib/account-mock'
```

**Depois (API):**
```typescript
// Carregar na montagem do page.tsx (use useEffect ou Server Component)
const [pedidos, cotacoes] = await Promise.all([
  get('/comprador/pedidos'),
  get('/comprador/cotacoes'),
])
```

**Ações específicas:**

| Ação | Chamada API |
|---|---|
| Criar nova cotação | `POST /comprador/cotacoes` com `{ produto, quantidade, prazoDesejado }` |
| Aceitar oferta | `POST /comprador/cotacoes/:id/aceitar` com `{ offerId }` |
| Ver ofertas de um pedido | `GET /comprador/pedidos/:id` — campo `offers[]` com `batchNumber` |
| Histórico | `GET /comprador/historico` |

---

### `/fornecedor/painel`

**Antes (mock):**
```typescript
import { MOCK_MARKET_ORDERS, MOCK_DIRECT_ORDERS } from '@/lib/supplier-mock'
```

**Depois (API):**

| Tab | Chamada API |
|---|---|
| Mercado | `GET /fornecedor/mercado?scope=national` |
| Pedidos Diretos | `GET /fornecedor/diretos` |
| Minhas Ofertas | `GET /fornecedor/ofertas` |
| Histórico | `GET /fornecedor/historico` |
| Perfil | `GET /fornecedor/perfil` |

**Ações específicas:**

| Ação | Chamada API |
|---|---|
| Enviar oferta | `POST /fornecedor/mercado/:id/oferta` com `{ preco, prazo, observacao }` |
| Recusar pedido do mercado | `POST /fornecedor/mercado/:id/recusar` |
| Confirmar pedido direto | `PATCH /fornecedor/diretos/:id` com `{ status: 'confirmado' }` |
| Recusar pedido direto | `PATCH /fornecedor/diretos/:id` com `{ status: 'recusado' }` |
| Atualizar perfil | `PUT /fornecedor/perfil` com os campos do formulário |

---

### `/login` e `/cadastro`

**Login (`/login/page.tsx`):**
```typescript
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

const router = useRouter()
const searchParams = useSearchParams()

async function handleLogin(email: string, password: string) {
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  })

  if (result?.error) {
    // Exibir toast de erro
    return
  }

  const redirect = searchParams.get('redirect') ?? '/minha-conta'
  router.push(redirect)
}
```

**Cadastro (`/cadastro/page.tsx`):**
```typescript
import { post } from '@/lib/api-client'
import { signIn } from 'next-auth/react'

async function handleCadastro(dados: CadastroPayload) {
  await post('/auth/register', dados)
  // Após cadastro, faz login automático
  await signIn('credentials', {
    email: dados.email,
    password: dados.password,
    redirect: false,
  })
  router.push(dados.role === 'COMPRADOR' ? '/minha-conta' : '/fornecedor/painel')
}
```

**Redirecionamento por role:**
```typescript
// Após login, verificar role da sessão
const { data: session } = useSession()
if (session?.user.role === 'FORNECEDOR') {
  router.push('/fornecedor/painel')
} else {
  router.push('/minha-conta')
}
```

---

## 6. Corrigir inconsistências de tipos

Ao consumir a API real, os seguintes campos diferem dos mocks. Corrija nos componentes:

| Campo | Mock (formato atual) | API (formato correto) | Onde corrigir |
|---|---|---|---|
| `Product.price` | `number` em reais (ex: `31.20`) | `priceInCents: number` em centavos (ex: `3120`) | `ProductCard.tsx`, `CatalogFilters.tsx` |
| Formato de usuário | dois formatos distintos | `{ id, name, email, phone, cpf, role }` unificado | `PerfilTab.tsx` (comprador e fornecedor) |
| Endereço | `logradouro`, `bairro` | `street`, `neighborhood` | `PerfilTab.tsx`, formulários de endereço |
| `Offer.supplier` | `string` (nome) | `{ id, companyName, rating }` (objeto) | `OfertaCard.tsx`, `OfertasTab.tsx` |

**Utilitário para preços:** a função `formatPrice` em `src/lib/supplier-mock.ts` já converte centavos. Quando migrar, use-a também no catálogo:

```typescript
// Antes (mock com reais)
<span>{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>

// Depois (API com centavos)
import { formatPrice } from '@/lib/supplier-mock' // ou mova para utils.ts
<span>{formatPrice(product.priceInCents)}</span>
```

---

## 7. Dados de teste disponíveis (do seed)

Use estas credenciais para testar a integração com o backend em desenvolvimento.

### Compradores

| E-mail | Senha | Perfil |
|---|---|---|
| `clinica@teste.com` | `senha123` | Clinica Sao Lucas — CNPJ 66.777.888/0001-99 |
| `revendedora@teste.com` | `senha123` | Revendedora Maria — Curitiba/PR |

### Fornecedores

| E-mail | Senha | Empresa | Marcas |
|---|---|---|---|
| `norte@teste.com` | `senha123` | Distribuidora Norte Ltda | Pampers |
| `sul@teste.com` | `senha123` | Sul Distribuidora | Huggies |
| `centro@teste.com` | `senha123` | Centro-Oeste Higiene | MamyPoko |
| `nordeste@teste.com` | `senha123` | Nordeste Baby Ltda | Turma da Monica |
| `nacional@teste.com` | `senha123` | Nacional Higiene SA | Cremer + Pampers + Huggies |

### Pedidos pré-criados no seed

| Identificador | Tipo | Status | Detalhes |
|---|---|---|---|
| cotacao-1 | `COTACAO` | `OFERTAS_RECEBIDAS` | 500cx Pampers M — 2 ofertas no lote 1 |
| cotacao-2 | `COTACAO` | `AGUARDANDO` | 200cx Huggies G — sem ofertas |
| direto-1 | `COMPRA_DIRETA` | `CONFIRMADO` | 100cx Pampers P — Distribuidora Norte |
| direto-2 | `COMPRA_DIRETA` | `ENTREGUE` | 50cx Cremer M — Nacional Higiene |
| cotacao-3 | `COTACAO` | `CANCELADO` | 300un MamyPoko G |

---

## 8. Ordem sugerida de integração (por prioridade)

Siga esta sequência para minimizar riscos. Cada etapa é independente da seguinte, exceto onde indicado.

```
1. Auth (NextAuth + POST /auth/login + POST /auth/register)
   └── Desbloqueia todo o resto — faça isso primeiro.

2. Catálogo (GET /produtos)
   └── Maior visibilidade pública, mais simples, sem estado de usuário.

3. Minha Conta (área do comprador)
   └── Depende do Auth estar funcionando.

4. Painel do Fornecedor
   └── Depende do Auth + roles funcionando.

5. Perfis e Endereços
   └── Polish — pode ser feito após os fluxos principais estarem estáveis.
```

Para cada etapa:
1. Implemente o `api-client.ts` call
2. Remova o import do mock correspondente
3. Teste manualmente com as credenciais de seed
4. Delete o arquivo mock quando todos os consumidores estiverem migrados

---

## 9. Headers obrigatórios em todas as chamadas autenticadas

O `api-client.ts` da Seção 2 já adiciona esses headers automaticamente. Se fizer qualquer fetch manual fora do client, inclua:

```
Authorization: Bearer <token>
Content-Type: application/json
```

Para obter o token em Server Components:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const session = await getServerSession(authOptions)
const token = session?.accessToken
```

---

## 10. Substituir o flag `IS_LOGGED_IN`

O arquivo `src/lib/auth-mock.ts` exporta `IS_LOGGED_IN = false`. Após integrar o NextAuth, substitua **todas** as referências por:

**Em Client Components:**
```typescript
import { useSession } from 'next-auth/react'

export function MinhaContaPage() {
  const { data: session, status } = useSession()
  const isLoggedIn = status === 'authenticated'

  if (status === 'loading') return <div>Carregando...</div>
  if (!isLoggedIn) redirect('/login')

  // ...
}
```

**Em Server Components / Layouts:**
```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  return <>{children}</>
}
```

**No `Header.tsx` (guarda do carrinho):**
```typescript
// Antes
import { IS_LOGGED_IN } from '@/lib/auth-mock'

// Depois
import { useSession } from 'next-auth/react'
const { status } = useSession()
const IS_LOGGED_IN = status === 'authenticated'
```

Após confirmar que nenhum arquivo importa mais `auth-mock.ts`, delete-o.

---

## Checklist de migração

Use como referência para acompanhar o progresso:

- [ ] `.env.local` criado com todas as variáveis
- [ ] `src/lib/api-client.ts` criado e testado
- [ ] `next-auth@5` instalado
- [ ] `src/app/api/auth/[...nextauth]/route.ts` criado
- [ ] `src/types/next-auth.d.ts` criado
- [ ] Login funcionando com credenciais de seed
- [ ] `IS_LOGGED_IN` substituído por `useSession` em todos os arquivos
- [ ] `src/lib/auth-mock.ts` deletado
- [ ] `/catalogo` consumindo `GET /produtos`
- [ ] `src/lib/products.ts` deletado
- [ ] `/minha-conta` consumindo endpoints do comprador
- [ ] `src/lib/account-mock.ts` deletado
- [ ] `/fornecedor/painel` consumindo endpoints do fornecedor
- [ ] `src/lib/supplier-mock.ts` deletado (exceto utilitários movidos para `utils.ts`)
- [ ] Tipos corrigidos (priceInCents, User, Address, Offer.supplier)
- [ ] Testado com todos os usuários de seed
