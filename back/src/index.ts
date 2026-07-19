import { Hono } from 'hono'
import { createAuthMiddleware, verifyFirebaseIdToken } from './middleware/auth'
import { ordersGetHandler } from './routes/orders'
import type { Env, AppContext } from './env'

const app = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

app.get('/health', (c) => c.json({ ok: true }))

// Middleware de autenticação para /orders/*
app.use('/orders/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})

app.get('/orders', ordersGetHandler)

export default app
