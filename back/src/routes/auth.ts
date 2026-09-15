import type { Context } from 'hono'
import { ZodError } from 'zod'
import {
  ProvisionRoleRequestSchema,
  ProvisionRoleResponse,
} from '../../../packages/contracts/src/auth'
import { getUserRole } from '../middleware/auth'
import {
  setCustomClaimsViaGoogleApi,
  lookupUserViaGoogleApi,
  type ProvisionClaimsFn,
  type LookupClaimsFn,
} from '../lib/claims-provisioner'
import type { Env, AppContext } from '../env'

export type { ProvisionClaimsFn, LookupClaimsFn }

export interface AuthClaimHandlerOptions {
  provisionClaims?: ProvisionClaimsFn
  lookupClaims?: LookupClaimsFn
}

/**
 * Cria o handler HTTP para POST /auth/claim.
 *
 * Responsabilidades:
 * 1. Garantir que o usuário está autenticado via token JWT (401 se ausente).
 * 2. Validar o payload estritamente contra ProvisionRoleRequestSchema (apenas 'comprador' | 'fornecedor', 400 se admin ou arbitrário).
 * 3. Idempotência: se o usuário já possui o mesmo papel, retorna 200 sem erro.
 * 4. Segurança: se o usuário tentar alterar de um papel para outro, bloqueia com 409 Conflict.
 * 5. Provisiona os claims no Firebase Authentication via Google Identity Toolkit API.
 */
export function createAuthClaimHandler(options?: AuthClaimHandlerOptions) {
  return async (c: Context<{ Bindings: Env; Variables: AppContext['Variables'] }>) => {
    const uid = c.get('uid')
    if (!uid) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    try {
      const body = await c.req.json().catch(() => null)
      const parsed = ProvisionRoleRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'invalid request', details: parsed.error.errors }, 400)
      }

      const requestedRole = parsed.data.role

      // 1. Verifica papel já presente no token do usuário
      const currentRole = getUserRole(c)
      if (currentRole) {
        if (currentRole === requestedRole) {
          const response: ProvisionRoleResponse = {
            success: true,
            role: requestedRole,
            alreadyProvisioned: true,
          }
          return c.json(response, 200)
        }
        return c.json({ error: 'role change not allowed' }, 409)
      }

      // 2. Resolve as funções de provisionamento/lookup (injetadas para teste ou padrão de produção)
      let lookupFn: LookupClaimsFn | undefined = options?.lookupClaims
      let provisionFn: ProvisionClaimsFn | undefined = options?.provisionClaims

      const hasServiceAccount = Boolean(
        c.env?.FIREBASE_CLIENT_EMAIL && c.env?.FIREBASE_PRIVATE_KEY && c.env?.FIREBASE_PROJECT_ID,
      )

      if (!provisionFn && hasServiceAccount) {
        const creds = {
          clientEmail: c.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: c.env.FIREBASE_PRIVATE_KEY!,
          projectId: c.env.FIREBASE_PROJECT_ID!,
        }
        provisionFn = (targetUid, claims) => setCustomClaimsViaGoogleApi(targetUid, claims, creds)
        if (!lookupFn) {
          lookupFn = (targetUid) => lookupUserViaGoogleApi(targetUid, creds)
        }
      }

      if (!provisionFn) {
        console.error('[auth-claim] Service Account do Firebase não configurada no ambiente.')
        return c.json({ error: 'claims provisioner not configured' }, 500)
      }

      // 3. Se houver lookup configurado, verifica se o usuário já possui claims no Identity Toolkit
      if (lookupFn) {
        try {
          const existingUser = await lookupFn(uid)
          const existingAttributes = existingUser?.customAttributes
          if (existingAttributes) {
            const existingRole = existingAttributes.role
            if (existingRole === requestedRole) {
              const response: ProvisionRoleResponse = {
                success: true,
                role: requestedRole,
                alreadyProvisioned: true,
              }
              return c.json(response, 200)
            }
            if (existingRole && existingRole !== requestedRole) {
              return c.json({ error: 'role change not allowed' }, 409)
            }
          }
        } catch (lookupErr) {
          console.warn('[auth-claim] Falha não impeditiva no lookup prévio:', lookupErr)
        }
      }

      // 4. Executa o provisionamento atômico do claim
      await provisionFn(uid, {
        role: requestedRole,
        [requestedRole]: true,
      })

      const response: ProvisionRoleResponse = {
        success: true,
        role: requestedRole,
        alreadyProvisioned: false,
      }
      return c.json(response, 200)
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({ error: 'invalid request', details: error.errors }, 400)
      }
      console.error('[auth-claim] Falha ao provisionar claims:', error)
      return c.json({ error: 'failed to provision claims' }, 502)
    }
  }
}
