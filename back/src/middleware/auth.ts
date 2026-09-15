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
    const role = resolveEffectiveRole(claims)

    return { uid, email, role, claims }
  } catch {
    // Token inválido, expirado, forjado, etc. → não esconder em try/catch silencioso
    // se quisermos debug, adicionar logging aqui (não fazer nesta tarefa)
    return null
  }
}

/**
 * Extrai e normaliza o papel a partir de um conjunto de claims customizados.
 * Suporta:
 * - claims.role === 'admin' | 'fornecedor' | 'comprador' (ou string arbitrária)
 * - claims.admin === true
 * - claims.fornecedor === true
 * - claims.comprador === true
 */
export function resolveEffectiveRole(claims?: Record<string, unknown> | null): string | undefined {
  if (!claims) return undefined

  const assertedRoles = new Set<string>()

  if (claims.admin === true || claims.role === 'admin') {
    assertedRoles.add('admin')
  }
  if (claims.fornecedor === true || claims.role === 'fornecedor') {
    assertedRoles.add('fornecedor')
  }
  if (claims.comprador === true || claims.role === 'comprador') {
    assertedRoles.add('comprador')
  }

  // Se mais de um papel for afirmado simultaneamente, estado inválido/contraditório (fail-closed)
  if (assertedRoles.size > 1) {
    return 'conflict'
  }

  if (assertedRoles.size === 1) {
    return Array.from(assertedRoles)[0]
  }

  // Se nenhum papel padrão foi afirmado, mas claims.role for uma string arbitrária
  if (typeof claims.role === 'string') {
    return claims.role
  }

  return undefined
}

/**
 * Extrai e resolve o papel efetivo do usuário a partir do contexto Hono.
 * Avalia role injetada, Custom Claims e o fallback de ADMIN_UID legado.
 * Opera de forma fail-closed: claims contraditórios resultam em 'conflict' (acesso negado).
 */
export function getUserRole(c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>): string | undefined {
  const uid = c.get('uid')
  const role = c.get('role')
  const claims = c.get('claims')

  const resolved = resolveEffectiveRole(claims)
  if (resolved === 'conflict') {
    return 'conflict'
  }

  // Detecta contradição entre role explicitamente injetada e claims resolvidos
  if (role && resolved && role !== resolved) {
    return 'conflict'
  }

  if (resolved === 'admin' || role === 'admin' || (Boolean(c.env?.ADMIN_UID) && uid === c.env.ADMIN_UID)) {
    if (resolved && resolved !== 'admin') {
      return 'conflict'
    }
    return 'admin'
  }

  return resolved || role
}

/**
 * Valida se o usuário autenticado possui pelo menos um dos papéis permitidos.
 * Nega permissão imediatamente se o papel efetivo for 'conflict' (claims contraditórios).
 */
export function hasAnyRole(
  c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>,
  allowedRoles: string[],
): boolean {
  const effectiveRole = getUserRole(c)
  return Boolean(effectiveRole && effectiveRole !== 'conflict' && allowedRoles.includes(effectiveRole))
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

