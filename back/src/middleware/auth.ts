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

/**
 * Extrai e resolve o papel efetivo do usuário a partir do contexto Hono.
 * Avalia role injetada, Custom Claims e o fallback de ADMIN_UID legado.
 */
export function getUserRole(c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>): string | undefined {
  const uid = c.get('uid')
  const role = c.get('role')
  const claims = c.get('claims')

  if (role === 'admin' || claims?.admin === true || (Boolean(c.env?.ADMIN_UID) && uid === c.env.ADMIN_UID)) {
    return 'admin'
  }
  if (role === 'fornecedor' || claims?.fornecedor === true) {
    return 'fornecedor'
  }
  if (role === 'comprador' || claims?.comprador === true) {
    return 'comprador'
  }
  return role
}

/**
 * Valida se o usuário autenticado possui pelo menos um dos papéis permitidos.
 */
export function hasAnyRole(
  c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>,
  allowedRoles: string[],
): boolean {
  const effectiveRole = getUserRole(c)
  return Boolean(effectiveRole && allowedRoles.includes(effectiveRole))
}

/**
 * Middleware centralizado de autorização por papel (RBAC).
 * Retorna 401 se não autenticado e 403 se autenticado porém sem papel permitido.
 */
export const requireAnyRole = (allowedRoles: string[]) => {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>, next: Next) => {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    if (!hasAnyRole(c, allowedRoles)) {
      return c.json({ error: 'forbidden' }, 403)
    }
    await next()
  }
}

/**
 * Middleware para exigir um único papel específico.
 */
export const requireRole = (role: string) => requireAnyRole([role])

