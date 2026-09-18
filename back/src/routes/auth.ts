import type { Context } from 'hono'
import { ZodError } from 'zod'
import {
  ProvisionRoleRequestSchema,
  ProvisionRoleResponse,
} from '../../../packages/contracts/src/auth'
import { getUserRole, resolveEffectiveRole } from '../middleware/auth'
import {
  setCustomClaimsViaGoogleApi,
  lookupUserViaGoogleApi,
  type ProvisionClaimsFn,
  type LookupClaimsFn,
} from '../lib/claims-provisioner'
import { logger } from '../lib/logger'
import { respondError, respondZodError } from '../lib/errors'
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
      return respondError(c, 'UNAUTHORIZED', 401, 'Não autenticado.')
    }

    try {
      const body = await c.req.json().catch(() => null)
      const parsed = ProvisionRoleRequestSchema.safeParse(body)
      if (!parsed.success) {
        return respondZodError(c, parsed.error)
      }

      const requestedRole = parsed.data.role

      // 1. Verifica papel já presente no token do usuário
      const currentRole = getUserRole(c)
      if (currentRole === 'conflict') {
        return respondError(c, 'AUTHORIZATION_STATE_CONFLICT', 409, 'Estado de autorização conflitante.')
      }
      if (currentRole) {
        if (currentRole === requestedRole) {
          const response: ProvisionRoleResponse = {
            success: true,
            role: requestedRole,
            alreadyProvisioned: true,
          }
          return c.json(response, 200)
        }
        return respondError(c, 'ROLE_CHANGE_NOT_ALLOWED', 409, 'Alteração de perfil não permitida.')
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
        logger.error(c, 'auth.claim.provisioner_not_configured')
        return respondError(c, 'AUTH_PROVIDER_NOT_CONFIGURED', 500, 'Provedor de autenticação não configurado.')
      }

      // 3. Se houver lookup configurado, verifica se o usuário já possui claims no Identity Toolkit (Fail-closed)
      let existingAttributes: Record<string, unknown> | undefined = undefined
      if (lookupFn) {
        try {
          const existingUser = await lookupFn(uid)
          existingAttributes = existingUser?.customAttributes
        } catch {
          logger.error(c, 'auth.claim.lookup.failed')
          return respondError(c, 'AUTH_PROVIDER_LOOKUP_FAILED', 502, 'Falha ao consultar estado de autorização no provedor.')
        }

        if (existingAttributes) {
          const existingRole = resolveEffectiveRole(existingAttributes)
          if (existingRole === 'conflict') {
            return respondError(c, 'AUTHORIZATION_STATE_CONFLICT', 409, 'Estado de autorização conflitante.')
          }
          if (existingRole === requestedRole) {
            const response: ProvisionRoleResponse = {
              success: true,
              role: requestedRole,
              alreadyProvisioned: true,
            }
            logger.info(c, 'auth.claim.provisioned', { role: requestedRole, alreadyProvisioned: true })
            return c.json(response, 200)
          }
          if (existingRole && existingRole !== requestedRole) {
            return respondError(c, 'ROLE_CHANGE_NOT_ALLOWED', 409, 'Alteração de perfil não permitida.')
          }
        }
      }

      // 4. Preservação de claims legítimos preexistentes
      // Remove chaves de papel anteriores para manter a política de papel exclusivo
      const {
        role: _r,
        comprador: _c,
        fornecedor: _f,
        admin: _a,
        ...preservedClaims
      } = existingAttributes ?? {}

      const newClaims = {
        ...preservedClaims,
        role: requestedRole,
        [requestedRole]: true,
      }

      // 5. Executa o provisionamento atômico do claim
      await provisionFn(uid, newClaims)

      const response: ProvisionRoleResponse = {
        success: true,
        role: requestedRole,
        alreadyProvisioned: false,
      }
      logger.info(c, 'auth.claim.provisioned', { role: requestedRole, alreadyProvisioned: false })
      return c.json(response, 200)
    } catch (error) {
      if (error instanceof ZodError) {
        return respondZodError(c, error)
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(c, 'auth.claim.provision.failed', { error: errorMessage })
      return respondError(c, 'AUTH_PROVIDER_UPDATE_FAILED', 502, 'Falha ao provisionar permissões no provedor.')
    }
  }
}
