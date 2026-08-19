import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import app from '../src/index'
import { ProductListSchema } from '../../packages/contracts/src/product'

describe('Endpoint /products test', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('GET /products retorna lista de produtos validada pelo Zod Schema', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    
    expect(response.status).toBe(200)
    
    const json = await response.json()
    const parsed = ProductListSchema.safeParse(json)
    
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      console.error('Validation errors:', parsed.error)
    }
  })
})
