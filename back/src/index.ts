import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthMiddleware, verifyFirebaseIdToken } from './middleware/auth'
import { ordersGetHandler, ordersPostHandler, ordersCancelHandler } from './routes/orders'
import { productsGetHandler } from './routes/products'
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

app.get('/products', productsGetHandler)

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

export default app
