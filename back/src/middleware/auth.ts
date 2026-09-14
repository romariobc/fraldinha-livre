import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Context, Next } from 'hono'
import type { Env, AppContext } from '../env'

/**
 * JWKS público do Firebase — criado UMA VEZ no escopo do módulo (não a cada chamada).
 * O jose mantém cache interno de chaves nessa instância; recriar por request perderia
 * o cache e refaria fetch ao Google em toda autenticação.
 */
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

/**
 * Resultado da verificação testável de JWT — contém uid e claims customizadas.
 */
export type VerifyTokenResult = {
  uid: string
  email?: string
  role?: 'comprador' | 'fornecedor' | 'admin' | string
  claims?: Record<string, unknown>
}

/**
 * Verificador testável de JWT — recebe um token e retorna VerifyTokenResult ou null se inválido.
 */
export type VerifyTokenFn = (token: string) => Promise<VerifyTokenResult | null>

/**
 * Middleware de autenticação por Firebase ID Token, testável por injeção de verificador.
 * Lê Authorization: Bearer <token>, verifica e coloca uid, role e claims no contexto.
 */
export const createAuthMiddleware = (verifyToken: VerifyTokenFn) => {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>, next: Next) => {
    const authHeader = c.req.header('Authorization')

    // Sem header ou sem prefixo Bearer → 401
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const token = authHeader.slice(7) // Remove "Bearer "

    const verified = await verifyToken(token)
    if (!verified) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    c.set('uid', verified.uid)
    if (verified.email) {
      c.set('email', verified.email)
    }
    if (verified.role) {
      c.set('role', verified.role)
    }
    if (verified.claims) {
      c.set('claims', verified.claims)
    }
    await next()
  }
}

/**
 * Verificador real de Firebase ID Token contra o JWKS público.
 * Valida assinatura, issuer, audience e extrai o uid e Custom Claims.
 */
export const verifyFirebaseIdToken = async (
  token: string,
  projectId: string,
): Promise<VerifyTokenResult | null> => {
  try {
    // Verifica assinatura, issuer, audience e expiration (JWKS reutilizado do escopo do módulo)
    const verified = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })

    // uid pode estar em 'sub' ou 'uid' — Firebase coloca em ambos
    const uid = (verified.payload.uid || verified.payload.sub) as string
    if (!uid) {
      return null
    }

    const email = typeof verified.payload.email === 'string' ? verified.payload.email : undefined

    const claims = verified.payload as Record<string, unknown>
    let role: string | undefined = undefined
    if (typeof claims.role === 'string') {
      role = claims.role
    } else if (claims.admin === true) {
      role = 'admin'
    } else if (claims.fornecedor === true) {
      role = 'fornecedor'
    } else if (claims.comprador === true) {
      role = 'comprador'
    }

    return { uid, email, role, claims }
  } catch {
    // Token inválido, expirado, forjado, etc. → não esconder em try/catch silencioso
    // se quisermos debug, adicionar logging aqui (não fazer nesta tarefa)
    return null
  }
}
