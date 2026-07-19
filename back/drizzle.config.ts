import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/orders.ts',
  out: './migrations',
  dialect: 'sqlite',
})
