import type { D1Database } from '@cloudflare/workers-types'
import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      /** Migrations reais lidas de back/migrations/*.sql (injetadas via vitest.config.ts, teste apenas). */
      TEST_MIGRATIONS: D1Migration[]
      /** Firebase project ID para verificação de tokens. */
      FIREBASE_PROJECT_ID: string
      /** Liga o envio real de e-mail via Resend. Desligada ate haver dominio verificado (D-037b/spec). */
      NOTIFICATIONS_ENABLED: string
      /** Secret — nunca commitar. `wrangler secret put RESEND_API_KEY`. */
      RESEND_API_KEY: string
      /** UID fixo do admin unico da plataforma (feature 012, sem sistema de papeis multiplos). */
      ADMIN_UID: string
      /** Binding da Workers AI — usado pelo chat-agent (thread M, feature 018). */
      AI: Ai
    }
  }
}

export type Env = Cloudflare.Env

/**
 * Tipo de contexto com variáveis customizadas.
 * Usado para tipar c.set() e c.get() corretamente.
 */
export interface AppContext {
  Variables: {
    uid: string
    email?: string
  }
}
