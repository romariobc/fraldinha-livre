import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthMiddleware, verifyFirebaseIdToken } from './middleware/auth'
import { ordersGetHandler, ordersPostHandler, ordersCancelHandler, ordersReportHandler } from './routes/orders'
import { productsGetHandler, productsPostHandler, productsPutHandler, productsDeleteHandler } from './routes/products'
import { createChatHandler } from './routes/chat'
import { createWorkersAiChatCompletion } from './lib/chat-completion'
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
    allowHeaders: ['Authorization', 'Content-Type'],
  }),
)

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
app.post('/products', productsPostHandler)

// /products/:id (PUT/DELETE) sempre autenticado - checagem de dono feita no handler (403 vs 404).
app.use('/products/:id', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
app.put('/products/:id', productsPutHandler)
app.delete('/products/:id', productsDeleteHandler)

// Middleware de autenticação para /orders/*
app.use('/orders/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/orders', ordersGetHandler)
app.post('/orders', ordersPostHandler)
app.patch('/orders/:id/cancel', ordersCancelHandler)
app.post('/orders/:id/report', ordersReportHandler)

app.use('/chat/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.post('/chat/message', (c) => createChatHandler(createWorkersAiChatCompletion(c.env.AI))(c))

export default app
