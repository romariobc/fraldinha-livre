import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthMiddleware, verifyFirebaseIdToken } from './middleware/auth'
import { ordersGetHandler, ordersPostHandler, ordersCancelHandler } from './routes/orders'
import type { Env, AppContext } from './env'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

// Auth e por Bearer token (sem cookies) — CORS restrito a localhost (dev).
// Quando o front ganhar dominio proprio, adicionar a origem de producao aqui.
const ALLOWED_ORIGIN = /^https?:\/\/localhost(:\d+)?$/

app.use(
  '*',
  cors({
    origin: (origin) => (ALLOWED_ORIGIN.test(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  }),
)

app.get('/health', (c) => c.json({ ok: true }))

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
