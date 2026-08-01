# H-011 — Notificação por e-mail ao fornecedor (novo pedido direto)

**Executor:** sessão Haiku | **Autor:** sessão-mãe (2026-07-30) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-fornecedor-notificacao-email.md` (aprovada 2026-07-30)

## Objetivo

Quando um comprador finaliza uma compra direta (`POST /orders`), o backend passa a
avisar o fornecedor por e-mail — atrás de uma flag `NOTIFICATIONS_ENABLED`
(desligada por padrão, já que o projeto ainda não tem domínio próprio verificado no
Resend). Falha no envio nunca bloqueia a criação do pedido.

## Contexto mínimo

- Stack: Cloudflare Workers + Hono + Drizzle ORM + D1 (SQLite). Sem framework de
  e-mail hoje — integração nova via `fetch` direto na API REST do Resend.
- Worktree: confirme com `git rev-parse --show-toplevel` (Passo 0 abaixo) — **este
  trabalho é só em `back/`**, não toque em `front/` nem `packages/contracts/`.
- `back/src/routes/orders.ts` já valida itens/preço/fornecedor no `POST /orders`
  antes de gravar (RN-P2/P2b/P2c da feature 006) — a query que busca os produtos
  ali é o ponto de extensão (RN-04 da spec).
- `back/src/middleware/auth.ts` hoje só extrai `uid` do token Firebase. O claim
  `email` já vem de graça no JWT (Firebase sempre inclui, quando o provider
  fornece) — não requer chamada extra.
- Produtos semeados (`sup-001`, `sup-002`, ... — ver `back/migrations/0002_seed_products.sql`)
  **não são contas Firebase reais** — não têm e-mail pra capturar. A coluna nova
  fica `NULL` pra eles; a notificação deve pular silenciosamente (sem erro) quando
  `supplier_email` for `null`/vazio.
- D-031 (`.claude/docs/decisoes.md`) registra um bug real de migration D1/SQLite
  anterior (literais gravados em colunas novas) — **sempre inspecionar o SQL
  gerado pelo `drizzle-kit generate` antes de aplicar**, não confiar cegamente.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```bash
git rev-parse --show-toplevel
```
O resultado tem que ser o worktree especificado pela sessão-mãe ao disparar este
prompt, NUNCA o repo principal (`E:\Labdev\Projetos\fraldinha-livre` sem
`.claude\worktrees\...`). Se não bater, PARAR e relatar antes de continuar.

## Tarefas (nesta ordem)

### Tarefa 1 — Middleware de auth carrega o claim `email`

**Arquivo:** `back/src/env.d.ts`

Adicionar `email` opcional em `AppContext['Variables']`:

```typescript
export interface AppContext {
  Variables: {
    uid: string
    email?: string
  }
}
```

**Arquivo:** `back/src/middleware/auth.ts`

Alterar o tipo `VerifyTokenFn` e as duas implementações (`createAuthMiddleware`,
`verifyFirebaseIdToken`) pra também carregar `email`:

```typescript
export type VerifyTokenFn = (token: string) => Promise<{ uid: string; email?: string } | null>

export const createAuthMiddleware = (verifyToken: VerifyTokenFn) => {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const token = authHeader.slice(7)

    const verified = await verifyToken(token)
    if (!verified) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    c.set('uid', verified.uid)
    if (verified.email) {
      c.set('email', verified.email)
    }
    await next()
  }
}

export const verifyFirebaseIdToken = async (
  token: string,
  projectId: string,
): Promise<{ uid: string; email?: string } | null> => {
  try {
    const verified = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })

    const uid = (verified.payload.uid || verified.payload.sub) as string
    if (!uid) {
      return null
    }

    const email = typeof verified.payload.email === 'string' ? verified.payload.email : undefined

    return { uid, email }
  } catch {
    return null
  }
}
```

Não mude mais nada nesse arquivo — o resto (JWKS, comentários) fica igual.

- [ ] **Passo 1.1:** Aplicar as duas mudanças acima.
- [ ] **Passo 1.2:** `cd back && npx tsc --noEmit` — deve sair limpo (exit 0). Se
  algum outro arquivo que usa `VerifyTokenFn`/`createAuthMiddleware` quebrar por
  causa do novo campo opcional, é bug seu — `email` é opcional, não deveria
  quebrar nada existente.

### Tarefa 2 — Coluna `supplier_email` em `products` (schema + migration)

**Arquivo:** `back/src/schema/products.ts`

Adicionar a coluna (nullable, sem default — segue o mesmo padrão de `badge`):

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  priceCents: integer('price_cents').notNull(),
  supplierId: text('supplier_id').notNull(),
  name: text('name').notNull().default(''),
  brand: text('brand').notNull().default(''),
  size: text('size').notNull().default(''),
  quantity: integer('quantity').notNull().default(0),
  slug: text('slug').notNull().default(''),
  categoria: text('categoria').notNull().default(''),
  descricao: text('descricao').notNull().default(''),
  atributos: text('atributos', { mode: 'json' }).notNull().default('{}'),
  badge: text('badge'),
  supplierEmail: text('supplier_email'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})
```

- [ ] **Passo 2.1:** Aplicar a mudança acima em `back/src/schema/products.ts`.
- [ ] **Passo 2.2:** Gerar a migration:
  ```bash
  cd back && npm run db:generate
  ```
  Isso cria um novo arquivo em `back/migrations/000N_<nome-aleatorio>.sql` (N =
  próximo número livre; hoje o último é `0004_backfill_products_seed.sql`, então
  espera-se `0005_...sql`).
- [ ] **Passo 2.3: OBRIGATÓRIO — inspecionar o SQL gerado antes de continuar.**
  Abra o arquivo `back/migrations/0005_*.sql` gerado e confirme que contém **só**:
  ```sql
  ALTER TABLE `products` ADD `supplier_email` text;
  ```
  (uma única linha `ALTER TABLE ... ADD COLUMN`, sem `PRAGMA foreign_keys`, sem
  `CREATE TABLE __new_products`, sem `INSERT INTO __new_products SELECT`). Uma
  coluna nova nullable sem default é suportada nativamente pelo `ALTER TABLE` do
  SQLite — o drizzle-kit só recorre à estratégia de recriar a tabela (como
  aconteceu no `0003_products_full.sql`) quando há mudança mais complexa. Se o
  arquivo gerado vier no formato "recriar tabela", **PARE** e relate — não é o
  esperado pra essa mudança, pode ser sintoma de schema.ts com outra diferença não
  intencional.
- [ ] **Passo 2.4:** Rodar a suíte de testes do back pra aplicar a migration no D1
  de teste e confirmar que nada quebrou:
  ```bash
  cd back && npm test
  ```
  Esperado: todos os testes existentes continuam verdes (a coluna nova é nullable,
  não deveria afetar nenhum insert/select existente).
- [ ] **Passo 2.5:** Commit:
  ```bash
  git add back/src/schema/products.ts back/migrations/0005_*.sql back/migrations/meta/
  git commit -m "feat(back): adiciona coluna supplier_email em products (H-011)"
  ```

### Tarefa 3 — Capturar `supplier_email` na criação do produto

**Arquivo:** `back/src/routes/products.ts`

No handler `productsPostHandler`, capturar o e-mail de `c.get('email')` (setado
pelo middleware na Tarefa 1) e gravar junto com o resto do insert:

```typescript
export const productsPostHandler = async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
  const uid = c.get('uid')
  if (!uid) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const supplierEmail = c.get('email')

  try {
    const body = await c.req.json()
    const createRequest = CreateProductRequestSchema.parse(body)

    const db = drizzle(c.env.DB)
    const id = generateUUID()

    await db.insert(products).values({
      id,
      supplierId: uid,
      supplierEmail,
      active: true,
      priceCents: createRequest.priceCents,
      name: createRequest.name,
      brand: createRequest.brand,
      size: createRequest.size,
      quantity: createRequest.quantity,
      slug: createRequest.slug,
      categoria: createRequest.categoria,
      descricao: createRequest.descricao,
      atributos: createRequest.atributos,
      badge: createRequest.badge,
    })

    const savedRows = await db.select().from(products).where(eq(products.id, id)).all()
    const saved = savedRows[0]
    const validated = ProductSchema.parse({
      ...saved,
      badge: saved.badge ?? undefined,
    })
    return c.json(validated, 201)
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError') || (error && typeof error === 'object' && 'issues' in error)) {
      const err = error as ZodError
      return c.json({ error: 'invalid request', details: err.errors }, 400)
    }
    throw error
  }
}
```

Só essa função muda. `ProductSchema.parse()` já descarta chaves desconhecidas por
padrão (não é `.strict()`) — `supplier_email` **não** aparece na resposta pro
cliente, e **não** deve ser adicionado ao `ProductSchema` em
`packages/contracts/src/product.ts`. Não toque nesse arquivo de contrato — é
propositalmente fora de escopo (a resposta pública de produto não deve expor
e-mail de fornecedor pra quem está comprando).

- [ ] **Passo 3.1:** Aplicar a mudança acima.
- [ ] **Passo 3.2:** Escrever o teste (novo `it` dentro do describe existente de
  criação em `back/test/products.crud.test.ts` — adicionar ao lado dos outros
  testes de `POST /products`, usando o mesmo `createTestApp()`/`fakeVerify` já
  definidos no arquivo):

  ```typescript
  it('POST /products grava supplier_email a partir do claim email do token', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/products', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-uid-fornecedor-teste',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Produto Com Email',
        brand: 'Marca Teste',
        size: 'M',
        quantity: 10,
        priceCents: 1500,
        slug: 'produto-com-email',
        categoria: 'teste',
        descricao: 'Descrição',
        atributos: { faixaPeso: 'P', genero: 'unissex', absorcao: 'A', tecnologia: 'T' },
      }),
    })
    const response = await app.fetch(request, env)
    expect(response.status).toBe(201)
    const body = (await response.json()) as { id: string }

    const db = drizzle(env.DB)
    const rows = await db.select().from(products).where(eq(products.id, body.id)).all()
    expect(rows[0].supplierEmail).toBe('fornecedor-teste@example.com')
  })
  ```

  Isso exige que `fakeVerify` em `createTestApp()` (dentro de
  `back/test/products.crud.test.ts`) passe a retornar `email` também. Localize a
  função `fakeVerify` nesse arquivo e ajuste:
  ```typescript
  const fakeVerify = async (token: string) => {
    if (token === 'token-uid-fornecedor-teste') {
      return { uid: 'uid-fornecedor-teste', email: 'fornecedor-teste@example.com' }
    }
    return null
  }
  ```
  (Se o arquivo já tiver mais entradas de token nesse `fakeVerify`, mantenha as
  outras como estão — só adicione `email` na entrada de
  `token-uid-fornecedor-teste`.)

- [ ] **Passo 3.3:** `cd back && npm test -- products.crud` — confirmar que o teste
  novo passa e os existentes continuam verdes.
- [ ] **Passo 3.4:** Commit:
  ```bash
  git add back/src/routes/products.ts back/test/products.crud.test.ts
  git commit -m "feat(back): captura supplier_email na criacao do produto (H-011)"
  ```

### Tarefa 4 — Módulo de notificação + flag + secret

**Arquivo novo:** `back/src/lib/notifications.ts`

```typescript
export interface OrderNotificationItem {
  productName: string
  quantity: number
  unit: string
}

export interface OrderNotificationParams {
  supplierEmail: string | null | undefined
  orderId: string
  items: OrderNotificationItem[]
  totalCents: number
}

/** Injetável — testes passam uma versão fake, produção usa `sendViaResend`. */
export type SendEmailFn = (params: { to: string; subject: string; html: string; text: string }) => Promise<void>

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildOrderEmail(params: OrderNotificationParams): { subject: string; html: string; text: string } {
  const itemsText = params.items.map((item) => `- ${item.productName} × ${item.quantity} ${item.unit}`).join('\n')
  const itemsHtml = params.items.map((item) => `<li>${item.productName} × ${item.quantity} ${item.unit}</li>`).join('')
  const total = formatBRL(params.totalCents)

  return {
    subject: 'Novo pedido recebido — Fraldinha Livre',
    text: `Você recebeu um novo pedido (#${params.orderId}):\n\n${itemsText}\n\nTotal: ${total}\n\nVeja os detalhes no seu painel: https://fraldinha-livre-frontend.romariobc.workers.dev/fornecedor/painel`,
    html: `<p>Você recebeu um novo pedido (#${params.orderId}):</p><ul>${itemsHtml}</ul><p><strong>Total:</strong> ${total}</p><p><a href="https://fraldinha-livre-frontend.romariobc.workers.dev/fornecedor/painel">Ver no painel</a></p>`,
  }
}

/**
 * Notifica o fornecedor de um novo pedido — best-effort (RN-02 da spec).
 * Nunca lança: falha de envio é logada e engolida, o pedido já foi gravado antes
 * desta função ser chamada.
 */
export async function notifySupplierOfNewOrder(
  params: OrderNotificationParams,
  options: { notificationsEnabled: boolean; sendEmail: SendEmailFn },
): Promise<void> {
  if (!params.supplierEmail) {
    // Produto sem e-mail cadastrado (ex.: fornecedor semeado sem conta Firebase real) — sem erro, só não notifica.
    return
  }

  const { subject, html, text } = buildOrderEmail(params)

  if (!options.notificationsEnabled) {
    console.log(`[notifications] enviaria para ${params.supplierEmail}: ${subject}`)
    return
  }

  try {
    await options.sendEmail({ to: params.supplierEmail, subject, html, text })
  } catch (error) {
    console.error('[notifications] falha ao enviar e-mail de novo pedido:', error)
  }
}

/** Implementação real via API REST do Resend. Remetente de teste até haver domínio verificado (ver spec). */
export async function sendViaResend(
  params: { to: string; subject: string; html: string; text: string },
  apiKey: string,
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend respondeu ${response.status}: ${body}`)
  }
}
```

**Arquivo:** `back/src/env.d.ts`

Adicionar os dois bindings novos na interface `Cloudflare.Env`:

```typescript
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      /** Migrations reais lidas de back/migrations/*.sql (injetadas via vitest.config.ts, teste apenas). */
      TEST_MIGRATIONS: D1Migration[]
      /** Firebase project ID para verificação de tokens. */
      FIREBASE_PROJECT_ID: string
      /** Liga o envio real de e-mail via Resend. Desligada ate haver dominio verificado (D-037b/spec). */
      NOTIFICATIONS_ENABLED: string
      /** Secret — nunca commitar. `wrangler secret put RESEND_API_KEY`. */
      RESEND_API_KEY: string
    }
  }
}
```

**Arquivo:** `back/wrangler.jsonc`

Adicionar `NOTIFICATIONS_ENABLED` em `vars` (mesmo objeto onde já está
`FIREBASE_PROJECT_ID`):

```jsonc
  "vars": {
    "FIREBASE_PROJECT_ID": "fraldinha-livre",
    "NOTIFICATIONS_ENABLED": "false"
  }
```

Não adicionar `RESEND_API_KEY` no `wrangler.jsonc` — secrets não vão em `vars`
(vão via `wrangler secret put`, fora do controle de versão). Deixe um comentário
no `wrangler.jsonc` logo acima do bloco `vars` documentando isso:
```jsonc
  // RESEND_API_KEY e' secret (wrangler secret put RESEND_API_KEY), nunca commitado aqui.
```

- [ ] **Passo 4.1:** Criar `back/src/lib/notifications.ts` com o conteúdo acima.
- [ ] **Passo 4.2:** Aplicar as mudanças em `back/src/env.d.ts` e
  `back/wrangler.jsonc`.
- [ ] **Passo 4.3:** Escrever `back/test/notifications.test.ts`:

  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { notifySupplierOfNewOrder } from '../src/lib/notifications'

  describe('notifySupplierOfNewOrder', () => {
    const baseParams = {
      supplierEmail: 'fornecedor@example.com',
      orderId: 'order-1',
      items: [{ productName: 'Fralda P', quantity: 2, unit: 'pct' }],
      totalCents: 3600,
    }

    it('sem supplier_email: nao chama sendEmail, nao lanca', async () => {
      const sendEmail = vi.fn()
      await notifySupplierOfNewOrder(
        { ...baseParams, supplierEmail: null },
        { notificationsEnabled: true, sendEmail },
      )
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('flag desligada: nao chama sendEmail', async () => {
      const sendEmail = vi.fn()
      await notifySupplierOfNewOrder(baseParams, { notificationsEnabled: false, sendEmail })
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('flag ligada: chama sendEmail com o destinatario e assunto certos', async () => {
      const sendEmail = vi.fn().mockResolvedValue(undefined)
      await notifySupplierOfNewOrder(baseParams, { notificationsEnabled: true, sendEmail })
      expect(sendEmail).toHaveBeenCalledOnce()
      const callArgs = sendEmail.mock.calls[0][0]
      expect(callArgs.to).toBe('fornecedor@example.com')
      expect(callArgs.subject).toBe('Novo pedido recebido — Fraldinha Livre')
      expect(callArgs.text).toContain('Fralda P')
      expect(callArgs.text).toContain('order-1')
    })

    it('sendEmail rejeita: nao lanca (best-effort, RN-02)', async () => {
      const sendEmail = vi.fn().mockRejectedValue(new Error('network fail'))
      await expect(
        notifySupplierOfNewOrder(baseParams, { notificationsEnabled: true, sendEmail }),
      ).resolves.toBeUndefined()
    })
  })
  ```

- [ ] **Passo 4.4:** `cd back && npm test -- notifications` — os 4 testes acima
  passam.
- [ ] **Passo 4.5:** Commit:
  ```bash
  git add back/src/lib/notifications.ts back/src/env.d.ts back/wrangler.jsonc back/test/notifications.test.ts
  git commit -m "feat(back): modulo de notificacao por email atras de flag (H-011)"
  ```

### Tarefa 5 — Disparar a notificação no `POST /orders`

**Arquivo:** `back/src/routes/orders.ts`

1. Importar o módulo novo no topo do arquivo (junto dos outros imports):
   ```typescript
   import { notifySupplierOfNewOrder, sendViaResend } from '../lib/notifications'
   ```

2. Dentro de `ordersPostHandler`, a query que já busca os produtos pra validar
   (linha com `db.select().from(products).where(inArray(products.id, productIds)).all()`)
   já traz todas as colunas — `productRows` já tem `supplierEmail` disponível, sem
   mudar a query. Depois do `await db.batch([orderInsert, ...itemInserts])`
   (logo antes de buscar `savedOrderList`), adicionar a chamada de notificação:

   ```typescript
       // Grava tudo num único batch (atomicidade RN-03)
       await db.batch([orderInsert, ...itemInserts])

       // Notifica o fornecedor (best-effort — nunca afeta a resposta, RN-02 da spec H-011)
       const notificationItems = createRequest.items.map((item) => ({
         productName: item.productName,
         quantity: item.quantity,
         unit: item.unit,
       }))
       await notifySupplierOfNewOrder(
         {
           supplierEmail: productRows[0]?.supplierEmail,
           orderId,
           items: notificationItems,
           // `?? 0` e' so pro TS (createRequest.price ja foi validado como definido
           // no early-return acima) — nunca e' 0 de verdade nesse ponto do fluxo.
           totalCents: createRequest.price ?? 0,
         },
         {
           notificationsEnabled: c.env.NOTIFICATIONS_ENABLED === 'true',
           sendEmail: (emailParams) => sendViaResend(emailParams, c.env.RESEND_API_KEY),
         },
       )

       // Busca a order e items para retornar
       const savedOrderList = await db.select().from(orders).where(eq(orders.id, orderId)).all()
   ```

   `productRows[0]?.supplierEmail` funciona porque RN-P2c já garante que todos os
   itens do pedido pertencem ao mesmo `createRequest.supplierId` (validado no loop
   logo acima, "fornecedor divergente para produto") — um pedido tem sempre um
   único fornecedor.

- [ ] **Passo 5.1:** Aplicar a mudança acima.
- [ ] **Passo 5.2:** Escrever os testes novos em
  `back/test/orders.mutations.test.ts` (ao lado dos testes existentes de
  `POST /orders`, reaproveitando o `createTestApp()`/fixtures de produto já
  presentes no arquivo — ajuste os nomes de variável abaixo se o arquivo usar
  nomes diferentes de fixture):

  ```typescript
  it('POST /orders com NOTIFICATIONS_ENABLED=false: nao chama Resend, pedido cria normalmente', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-comprador-a', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'Fralda A',
        quantity: 1,
        unit: 'un',
        price: 1000,
        supplierId: 'uid-fornecedor-a',
        supplierName: 'Fornecedor A',
        deliveryAddress: {
          logradouro: 'Rua A', numero: '1', bairro: 'Centro',
          cidade: 'Sao Paulo', estado: 'SP', cep: '01000-000',
        },
        items: [{ productId: 'prod-fornecedor-a-1', productName: 'Fralda A', unitPrice: 1000, quantity: 1, unit: 'un' }],
      }),
    })
    // env.NOTIFICATIONS_ENABLED nao setado nesse teste => vazio => !== 'true' => desligado
    const response = await app.fetch(request, env)
    expect(response.status).toBe(201)
  })
  ```

  Esse teste confirma o caminho default (flag desligada em teste, igual produção
  hoje) sem precisar mockar `fetch` — já que com a flag desligada
  `sendViaResend` nunca é chamado. Ajuste `prod-fornecedor-a-1`/`uid-fornecedor-a`
  pros IDs de fixture reais já usados no `beforeAll` desse arquivo de teste (
  confira o que já existe em `orders.scope-fornecedor.test.ts`/
  `orders.mutations.test.ts` pro padrão de fixtures de produto usado — reaproveite
  em vez de recriar).

- [ ] **Passo 5.3:** `cd back && npm test` — suíte completa, todos os arquivos.
  Se algum teste existente de `POST /orders` quebrar por causa da chamada nova a
  `notifySupplierOfNewOrder`, é porque a fixture de produto usada nesse teste não
  tem `supplierEmail` — isso é esperado e correto (fica `undefined`, a função
  retorna sem fazer nada, RN-02) — se quebrar mesmo assim, o bug está em outro
  lugar, investigue antes de mudar o `notifications.ts`.
- [ ] **Passo 5.4:** Commit:
  ```bash
  git add back/src/routes/orders.ts back/test/orders.mutations.test.ts
  git commit -m "feat(back): dispara notificacao de novo pedido no POST /orders (H-011)"
  ```

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório final, nesta ordem:

1. `cd back && npm test` — suíte completa, todos os arquivos verdes (incluindo os
   novos: `notifications.test.ts`, os `it`s novos em `products.crud.test.ts` e
   `orders.mutations.test.ts`).
2. `cd back && npx tsc --noEmit` — exit 0.
3. Confirmar que `packages/contracts/src/product.ts` **não foi tocado** (`git diff --stat packages/contracts` deve estar vazio).
4. Confirmar que nenhum arquivo em `front/` foi tocado (`git diff --stat front` deve estar vazio).
5. `grep -n "supplier_email" back/migrations/*.sql` — confirma que a migration
   gerada na Tarefa 2 existe e contém a coluna.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3
TENTATIVAS. Após a 3ª falha: PARE. Não improvise, não mude a abordagem por conta
própria (por exemplo, não decida sozinho migrar pra outro provedor de e-mail se o
Resend der problema em teste — isso é decisão de arquitetura, reporte e pare).

## Critérios de aceite

- [ ] `products.supplier_email` existe no schema e na migration; produtos criados
  via `POST /products` autenticado gravam o e-mail do token.
- [ ] `POST /orders` com a flag desligada (default): pedido cria normalmente, zero
  chamada de rede ao Resend.
- [ ] `POST /orders` com a flag ligada (só em teste, via mock): função de envio é
  chamada com destinatário/assunto/corpo corretos quando há `supplier_email`; não
  é chamada quando `supplier_email` é nulo; nunca lança mesmo se o envio falhar.
- [ ] `packages/contracts/src/product.ts` intocado — `supplier_email` nunca
  aparece numa resposta pública de produto.
- [ ] Suíte completa do back verde, `tsc` limpo.
- [ ] `RESEND_API_KEY` nunca aparece em nenhum arquivo commitado (nem
  `wrangler.jsonc`, nem testes, nem comentários).

## Restrições

- **Não toque em `front/` nem `packages/contracts/`** — escopo é só `back/`.
- **Não decida sozinho trocar o provedor de e-mail, o formato da flag, ou a
  estrutura de `notifySupplierOfNewOrder`** — isso é decisão de arquitetura já
  fechada na spec/neste prompt.
- **Não escreva o valor de `RESEND_API_KEY` em nenhum arquivo** — é secret, fica
  fora do repo (`wrangler secret put`, feito manualmente pela sessão-mãe/cliente
  depois, fora deste prompt).
- **Não ligue `NOTIFICATIONS_ENABLED=true` em `wrangler.jsonc`** — fica `"false"`
  por padrão nesta entrega (spec RN-05); ativar é decisão separada, depois que
  houver domínio verificado.
- Commits em pt-BR (Conventional Commits), um por tarefa concluída (ver passos
  "Commit" em cada tarefa acima) — não esperar até o fim pra commitar tudo junto.

## Relatório esperado

- Lista de arquivos alterados/criados por tarefa.
- Resultado de cada comando da seção "Testes e verificação" (colar a saída
  relevante, não só "passou").
- Nome exato do arquivo de migration gerado na Tarefa 2 (`back/migrations/0005_*.sql`
  ou o número que de fato saiu) e confirmação de que foi inspecionado (Passo 2.3).
- Qualquer desvio do prompt (mesmo pequeno) e por quê.
- Pendências explícitas: `wrangler secret put RESEND_API_KEY` ainda precisa ser
  rodado manualmente antes de qualquer ativação real (fora do escopo deste
  prompt).
