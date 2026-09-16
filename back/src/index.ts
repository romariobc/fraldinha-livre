import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthMiddleware, verifyFirebaseIdToken, requireAnyRole } from './middleware/auth'
import { ordersGetHandler, ordersPostHandler, ordersCancelHandler, ordersReportHandler } from './routes/orders'
import { productsGetHandler, productsPostHandler, productsPutHandler, productsDeleteHandler } from './routes/products'
import { createChatHandler } from './routes/chat'
import { createAuthClaimHandler } from './routes/auth'
import { createWorkersAiChatCompletion } from './lib/chat-completion'
import { resolveRequestId, logger } from './lib/logger'
import type { Env, AppContext } from './env'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

// Auth e por Bearer token (sem cookies). CORS aceita: localhost (dev), o
// Worker de producao do front, e as preview URLs do Workers Builds (prefixo
// dinamico de branch/versao antes do nome do Worker). Estar na mesma conta
// Cloudflare NAO elimina CORS — os dois Workers tem hostnames diferentes,
// toda chamada do navegador continua cross-origin (D-029, correcao registrada).
const ALLOWED_ORIGIN =
  /^(https?:\/\/localhost(:\d+)?|https:\/\/([a-z0-9-]+-)?fraldinha-livre-frontend\.romariobc\.workers\.dev)$/

app.use(
  '*',
  cors({
    origin: (origin) => (ALLOWED_ORIGIN.test(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
  }),
)

// Middleware de Request ID & Lifecycle Logging (OBS-001B):
// 1. Extrai ou gera X-Request-Id sanitizado e injeta no contexto.
// 2. Garante que X-Request-Id esteja presente em todas as respostas.
// 3. Emite log estruturado de conclusão da requisição com latência.
app.use('*', async (c, next) => {
  const incomingId = c.req.header('x-request-id') || c.req.header('X-Request-Id')
  const requestId = resolveRequestId(incomingId)
  c.set('requestId', requestId)
  c.header('X-Request-Id', requestId)

  const start = performance.now()
  await next()
  const durationMs = Math.round(performance.now() - start)

  if (!c.res.headers.has('X-Request-Id')) {
    c.res.headers.set('X-Request-Id', requestId)
  }

  const status = c.res.status
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  logger[level](c, 'http.request.completed', {
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
  })
})

app.onError((err, c) => {
  const requestId = c.get('requestId') || resolveRequestId()
  logger.error(requestId, 'http.request.unhandled_error', {
    method: c.req.method,
    path: c.req.path,
    error: err instanceof Error ? err.message : String(err),
  })
  c.res.headers.set('X-Request-Id', requestId)
  return c.text('Internal Server Error', 500)
})

app.get('/health', (c) => c.json({ ok: true }))

// Middleware para /products: GET sem scope=fornecedor nem scope=admin eh publico; qualquer outro metodo
// (POST) ou GET com scope=fornecedor ou scope=admin exige auth.
app.use('/products', async (c, next) => {
  const scope = c.req.query('scope')
  const isPublicGet = c.req.method === 'GET' && scope !== 'fornecedor' && scope !== 'admin'
  if (isPublicGet) {
    return next()
  }
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/products', productsGetHandler)
app.post('/products', requireAnyRole(['fornecedor']), productsPostHandler)

// /products/:id (PUT/DELETE) sempre autenticado - checagem de dono feita no handler (403 vs 404).
app.use('/products/:id', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
app.put('/products/:id', requireAnyRole(['fornecedor']), productsPutHandler)
app.delete('/products/:id', requireAnyRole(['fornecedor']), productsDeleteHandler)

// Middleware de autenticação para /orders/*
app.use('/orders/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/orders', ordersGetHandler)
app.post('/orders', requireAnyRole(['comprador']), ordersPostHandler)
app.patch('/orders/:id/cancel', requireAnyRole(['comprador']), ordersCancelHandler)
app.post('/orders/:id/report', requireAnyRole(['fornecedor']), ordersReportHandler)

app.use('/chat/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.post('/chat/message', (c) => createChatHandler(createWorkersAiChatCompletion(c.env.AI))(c))

app.use('/auth/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
app.post('/auth/claim', (c) => createAuthClaimHandler()(c))

export default app
