import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import app from '../src/index'

describe('GET /products', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('retorna 200 sem Authorization (rota publica)', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    expect(response.status).toBe(200)
  })

  it('retorna os 24 produtos com o shape esperado', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const body = (await response.json()) as unknown

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(24)
    const firstProduct = (body as unknown[])[0] as Record<string, unknown>
    expect(firstProduct).toHaveProperty('id')
    expect(firstProduct).toHaveProperty('priceCents')
    expect(firstProduct).toHaveProperty('supplierId')
    expect(typeof firstProduct.priceCents).toBe('number')
  })
})
