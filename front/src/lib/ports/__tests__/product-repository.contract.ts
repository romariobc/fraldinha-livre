import { describe, it, expect } from 'vitest'
import type { ProductRepository } from '../product-repository'
import { ProductNotFoundError } from '../product-repository'

const defaultTestProduct = {
  name: 'Test Product',
  brand: 'Pampers' as const,
  size: 'P' as const,
  quantity: 10,
  priceCents: 1000,
  slug: 'test-product',
  categoria: 'fraldas-descartaveis' as const,
  descricao: 'Test Description',
  atributos: {
    faixaPeso: '3–6 kg',
    genero: 'unissex' as const,
    absorcao: 'ate 12 horas',
    tecnologia: 'camada seca antivazamento',
  },
  badge: undefined,
}

export function runProductRepositoryContract(
  name: string,
  makeRepo: () => ProductRepository,
) {
  describe(`ProductRepository contract — ${name}`, () => {
    it('list() retorna array vazio quando não há produtos (seed vazio)', async () => {
      const repo = makeRepo()
      const products = await repo.list()
      expect(products).toEqual([])
    })

    it('create() com active:true faz o produto aparecer em list() e listForSupplier()', async () => {
      const repo = makeRepo()
      const created = await repo.create(defaultTestProduct)

      const list = await repo.list()
      const listForSupplier = await repo.listForSupplier()

      expect(list).toContainEqual(created)
      expect(listForSupplier).toContainEqual(created)
      expect(created.active).toBe(true)
    })

    it('update(id, { active: false }) faz o produto desaparecer de list() mas continuar em listForSupplier()', async () => {
      const repo = makeRepo()
      const created = await repo.create(defaultTestProduct)

      const updated = await repo.update(created.id, { active: false })
      expect(updated.active).toBe(false)

      const list = await repo.list()
      const listForSupplier = await repo.listForSupplier()

      expect(list).not.toContainEqual(updated)
      expect(listForSupplier).toContainEqual(updated)
    })

    it('update(id, { active: true }) faz reaparecer em list()', async () => {
      const repo = makeRepo()
      const created = await repo.create(defaultTestProduct)

      await repo.update(created.id, { active: false })
      const updated = await repo.update(created.id, { active: true })
      expect(updated.active).toBe(true)

      const list = await repo.list()
      expect(list).toContainEqual(updated)
    })

    it('remove(id) faz o produto desaparecer de list() e listForSupplier()', async () => {
      const repo = makeRepo()
      const created = await repo.create(defaultTestProduct)

      await repo.remove(created.id)

      const list = await repo.list()
      const listForSupplier = await repo.listForSupplier()

      expect(list).not.toContainEqual(created)
      expect(listForSupplier).not.toContainEqual(created)
    })

    it('update() de um id inexistente lança ProductNotFoundError', async () => {
      const repo = makeRepo()
      await expect(
        repo.update('nonexistent-id', { name: 'Updated' }),
      ).rejects.toThrow(ProductNotFoundError)
    })

    it('remove() de um id inexistente lança ProductNotFoundError', async () => {
      const repo = makeRepo()
      await expect(repo.remove('nonexistent-id')).rejects.toThrow(ProductNotFoundError)
    })
  })
}
