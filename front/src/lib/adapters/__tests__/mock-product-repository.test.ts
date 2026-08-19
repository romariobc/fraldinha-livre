import { describe, it, expect } from 'vitest'
import type { Product } from '@contracts'
import { MockProductRepository } from '../mock-product-repository'
import { ProductForbiddenError } from '@/lib/ports/product-repository'
import { runProductRepositoryContract } from '@/lib/ports/__tests__/product-repository.contract'
import { PRODUCTS } from '@/lib/mock-data/products-mock'

describe('MockProductRepository', () => {
  let idCounter = 0
  const mockIdFactory = () => `product-${++idCounter}`

  it('seed default tem 24 produtos mapeados com priceCents correto e active:true', async () => {
    const repo = new MockProductRepository({
      supplierId: 'sup-001',
      idFactory: mockIdFactory,
    })

    const allProducts = await repo.list()
    const supplierProducts = await repo.listForSupplier()

    expect(allProducts.length).toBe(PRODUCTS.length)
    expect(supplierProducts.length).toBeGreaterThan(0)

    for (const product of allProducts) {
      expect(product.active).toBe(true)
      expect(typeof product.priceCents).toBe('number')
      expect(product.priceCents).toBeGreaterThan(0)
      expect(product.id).toBeDefined()
      expect(product.supplierId).toBeDefined()
    }
  })

  it('create() usa idFactory injetado', async () => {
    const repo = new MockProductRepository({
      supplierId: 'sup-test',
      idFactory: mockIdFactory,
    })
    idCounter = 0 // reset para teste determinístico

    const created = await repo.create({
      name: 'Test Product',
      brand: 'Pampers',
      size: 'P',
      quantity: 10,
      priceCents: 1000,
      slug: 'test-product',
      categoria: 'fraldas-descartaveis',
      descricao: 'Test Description',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: undefined,
    })

    expect(created.id).toBe('product-1')
  })

  it('create() adiciona o produto à lista interna', async () => {
    const repo = new MockProductRepository({
      supplierId: 'sup-test',
      idFactory: mockIdFactory,
    })
    idCounter = 100

    const initialCount = (await repo.listForSupplier()).length

    await repo.create({
      name: 'New Product',
      brand: 'Pampers',
      size: 'M',
      quantity: 20,
      priceCents: 2000,
      slug: 'new-product',
      categoria: 'fraldas-descartaveis',
      descricao: 'New Description',
      atributos: {
        faixaPeso: '5–9 kg',
        genero: 'unissex',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: undefined,
    })

    const afterCount = (await repo.listForSupplier()).length

    expect(afterCount).toBe(initialCount + 1)
  })

  it('múltiplas instâncias de MockProductRepository têm estado isolado', async () => {
    const repo1 = new MockProductRepository({
      supplierId: 'sup-test-1',
      idFactory: () => 'id-1',
    })
    const repo2 = new MockProductRepository({
      supplierId: 'sup-test-2',
      idFactory: () => 'id-2',
    })

    const list1 = await repo1.list()
    const list2 = await repo2.list()

    // Ambos começam com o seed padrão
    expect(list1.length).toBe(PRODUCTS.length)
    expect(list2.length).toBe(PRODUCTS.length)

    // Modificar um não afeta o outro
    const created = await repo1.create({
      name: 'Isolated Product',
      brand: 'Pampers',
      size: 'P',
      quantity: 5,
      priceCents: 500,
      slug: 'isolated-product',
      categoria: 'fraldas-descartaveis',
      descricao: 'Test',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: undefined,
    })

    const list1After = await repo1.list()
    const list2After = await repo2.list()

    expect(list1After.length).toBe(list1.length + 1)
    expect(list2After.length).toBe(list2.length) // repo2 inalterado
    expect(created.supplierId).toBe('sup-test-1')
  })

  // Authorization tests — specific to MockProductRepository with custom seed
  it('update() de um produto de outro fornecedor lança ProductForbiddenError', async () => {
    const otherSupplierProduct: Product = {
      id: 'other-product-1',
      name: 'Other Supplier Product',
      brand: 'Pampers',
      size: 'P',
      quantity: 10,
      priceCents: 1000,
      supplierId: 'other-supplier-id',
      slug: 'other-product',
      categoria: 'fraldas-descartaveis',
      descricao: 'Test',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: undefined,
      active: true,
    }

    const repo = new MockProductRepository({
      supplierId: 'sup-auth-test',
      idFactory: mockIdFactory,
      seed: [otherSupplierProduct],
    })

    await expect(
      repo.update('other-product-1', { name: 'Updated' }),
    ).rejects.toThrow(ProductForbiddenError)
  })

  it('remove() de um produto de outro fornecedor lança ProductForbiddenError', async () => {
    const otherSupplierProduct: Product = {
      id: 'other-product-2',
      name: 'Other Supplier Product',
      brand: 'Pampers',
      size: 'P',
      quantity: 10,
      priceCents: 1000,
      supplierId: 'other-supplier-id',
      slug: 'other-product',
      categoria: 'fraldas-descartaveis',
      descricao: 'Test',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: undefined,
      active: true,
    }

    const repo = new MockProductRepository({
      supplierId: 'sup-auth-test',
      idFactory: mockIdFactory,
      seed: [otherSupplierProduct],
    })

    await expect(repo.remove('other-product-2')).rejects.toThrow(ProductForbiddenError)
  })

  // Contract tests with empty seed
  runProductRepositoryContract(
    'MockProductRepository (empty seed)',
    () =>
      new MockProductRepository({
        supplierId: 'sup-test',
        idFactory: mockIdFactory,
        seed: [],
      }),
  )
})
