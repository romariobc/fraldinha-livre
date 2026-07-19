import type { D1Database } from '@cloudflare/workers-types'
import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      /** Migrations reais lidas de back/migrations/*.sql (injetadas via vitest.config.ts, teste apenas). */
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}

export {}
