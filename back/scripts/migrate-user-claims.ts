/**
 * Script de Migração Administrativa de Custom Claims (AUTH-001)
 *
 * Mapeia usuários legados que possuem `role: 'comprador' | 'fornecedor'`
 * no Firestore para os devidos Firebase Custom Claims assinados.
 *
 * Características de Segurança & Governança:
 * 1. Allowlist estrita: APENAS 'comprador' e 'fornecedor' são migrados.
 * 2. Prevenção de escalada: 'admin' ou strings arbitrárias são expressamente rejeitadas e auditadas.
 * 3. Idempotência: Se o usuário já possui o claim correspondente, pula sem re-gravar.
 * 4. Detecção de conflito: Se já possui uma role diferente no claim, bloqueia e audita.
 * 5. Auditabilidade: Gera relatório consolidado de auditoria.
 *
 * Execução:
 * npx tsx scripts/migrate-user-claims.ts [--dry-run] [--input=users.json]
 */

import {
  setCustomClaimsViaGoogleApi,
  lookupUserViaGoogleApi,
} from '../src/lib/claims-provisioner'
import { AllowedProvisionRoles, type AllowedProvisionRole } from '../../packages/contracts/src/auth'

export interface UserToMigrate {
  uid: string
  role: string
  email?: string
}

export interface MigrationReportItem {
  uid: string
  email?: string
  requestedRole: string
  status: 'PROVISIONED' | 'ALREADY_PROVISIONED' | 'REJECTED_UNALLOWED_ROLE' | 'CONFLICT_BLOCKED' | 'ERROR'
  reason?: string
}

export interface MigrationSummary {
  total: number
  provisioned: number
  alreadyProvisioned: number
  rejectedUnallowed: number
  conflicts: number
  errors: number
  details: MigrationReportItem[]
}

export async function runMigration(
  users: UserToMigrate[],
  config: {
    projectId: string
    clientEmail: string
    privateKey: string
    dryRun?: boolean
  },
  deps?: {
    lookupClaims?: typeof lookupUserViaGoogleApi
    provisionClaims?: typeof setCustomClaimsViaGoogleApi
  }
): Promise<MigrationSummary> {
  const lookupClaims = deps?.lookupClaims ?? lookupUserViaGoogleApi
  const provisionClaims = deps?.provisionClaims ?? setCustomClaimsViaGoogleApi

  const summary: MigrationSummary = {
    total: users.length,
    provisioned: 0,
    alreadyProvisioned: 0,
    rejectedUnallowed: 0,
    conflicts: 0,
    errors: 0,
    details: [],
  }

  for (const user of users) {
    // 1. Validação de Allowlist estrita (rejeita admin e desconhecidos)
    if (!AllowedProvisionRoles.includes(user.role as AllowedProvisionRole)) {
      summary.rejectedUnallowed++
      summary.details.push({
        uid: user.uid,
        email: user.email,
        requestedRole: user.role,
        status: 'REJECTED_UNALLOWED_ROLE',
        reason: `Role '${user.role}' não é permitida para provisionamento automático.`,
      })
      continue
    }

    const validRole = user.role as AllowedProvisionRole

    try {
      // 2. Consulta claims existentes no Google Identity
      const existingUser = await lookupClaims(user.uid, {
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      })
      const existingClaims = existingUser?.customAttributes

      const existingRole = (existingClaims?.role as string | undefined) ||
        (existingClaims?.fornecedor === true ? 'fornecedor' : undefined) ||
        (existingClaims?.comprador === true ? 'comprador' : undefined) ||
        (existingClaims?.admin === true ? 'admin' : undefined)

      // 3. Checagem de Idempotência
      if (existingRole === validRole) {
        summary.alreadyProvisioned++
        summary.details.push({
          uid: user.uid,
          email: user.email,
          requestedRole: validRole,
          status: 'ALREADY_PROVISIONED',
          reason: `Usuário já possui claim role=${validRole}.`,
        })
        continue
      }

      // 4. Bloqueio de Conflito de Role
      if (existingRole && existingRole !== validRole) {
        summary.conflicts++
        summary.details.push({
          uid: user.uid,
          email: user.email,
          requestedRole: validRole,
          status: 'CONFLICT_BLOCKED',
          reason: `Usuário já possui claim diferente ('${existingRole}'). Mutação bloqueada.`,
        })
        continue
      }

      // 5. Dry Run ou Provisionamento Real
      if (config.dryRun) {
        summary.provisioned++
        summary.details.push({
          uid: user.uid,
          email: user.email,
          requestedRole: validRole,
          status: 'PROVISIONED',
          reason: '[DRY-RUN] Claim seria provisionado com sucesso.',
        })
      } else {
        await provisionClaims(
          user.uid,
          {
            role: validRole,
            [validRole]: true,
          },
          {
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey,
          }
        )

        summary.provisioned++
        summary.details.push({
          uid: user.uid,
          email: user.email,
          requestedRole: validRole,
          status: 'PROVISIONED',
          reason: 'Custom Claim provisionado com sucesso no Firebase Auth.',
        })
      }
    } catch (err) {
      summary.errors++
      summary.details.push({
        uid: user.uid,
        email: user.email,
        requestedRole: validRole,
        status: 'ERROR',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}

declare const require: any
declare const module: any

// Execução direta via CLI
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  const isDryRun = process.argv.includes('--dry-run')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Erro: As variáveis de ambiente FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY são obrigatórias.')
    console.error('Exemplo de uso:')
    console.error('  FIREBASE_PROJECT_ID=xyz FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... npx tsx scripts/migrate-user-claims.ts [--dry-run]')
    process.exit(1)
  }

  console.log(`Iniciando migração de claims (dryRun: ${isDryRun})...`)
  // Em execução real, este script pode carregar um JSON de usuários ou exportação do Firestore.
  console.log('Script pronto para ser alimentado com a lista de usuários.')
}
