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
  }
}
