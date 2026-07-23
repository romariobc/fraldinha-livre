import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import app from '../src/index'
import { PRODUCTS } from '../../front/src/lib/products'

/**
 * Sensor de drift entre front/src/lib/products.ts (fonte real do catalogo) e o
 * seed do D1 (back/migrations/0002_seed_products.sql, gerado por
 * back/scripts/generate-products-seed.ts). O script de seed copia os valores
 * a mao (nao importa o array em tempo de execucao do Worker) - este teste e o
 * sensor que pega drift se alguem editar um lado sem editar o outro.
 */
describe('Consistencia products.ts (front) x seed do D1 (back)', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('todo produto de front/src/lib/products.ts existe no D1 com o mesmo preco/fornecedor', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const seeded = (await response.json()) as { id: string; priceCents: number; supplierId: string }[]

    const seededById = new Map(seeded.map((p) => [p.id, p]))

    for (const product of PRODUCTS) {
      const match = seededById.get(product.id)
      expect(match, `produto ${product.id} nao encontrado no D1 (drift front->back)`).toBeDefined()
      expect(match!.priceCents, `preco divergente para ${product.id}`).toBe(product.priceInCents)
      expect(match!.supplierId, `fornecedor divergente para ${product.id}`).toBe(product.supplierId)
    }
  })

  it('nao ha produto no D1 que nao exista em front/src/lib/products.ts (drift na outra direcao)', async () => {
    const request = new Request('http://localhost/products')
    const response = await app.fetch(request, env)
    const seeded = (await response.json()) as { id: string }[]

    const realIds = new Set(PRODUCTS.map((p) => p.id))

    for (const row of seeded) {
      expect(realIds.has(row.id), `produto ${row.id} existe no D1 mas nao em products.ts`).toBe(true)
    }
  })
})
