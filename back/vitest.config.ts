import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'

const migrationsPath = fileURLToPath(new URL('./migrations', import.meta.url))

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(migrationsPath)
      return {
        main: './src/index.ts',
        wrangler: {
          configPath: './wrangler.jsonc',
        },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }
    }),
  ],
})
