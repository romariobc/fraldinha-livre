import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { searchProducts, getProduct } from '../src/lib/chat-tools'
import { products } from '../src/schema/products'

describe('searchProducts / getProduct (tools do chat-agent)', () => {
  let despublicadoId: string

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

    const db = drizzle(env.DB)
    despublicadoId = `test-chat-tools-${Date.now()}`
    await db.insert(products).values({
      id: despublicadoId,
      supplierId: 'uid-fornecedor-teste',
      supplierEmail: 'fornecedor@example.com',
      name: 'Fralda Despublicada Teste',
      brand: 'MarcaTeste',
      size: 'M',
      quantity: 10,
      slug: 'fralda-despublicada-teste',
      categoria: 'fraldas-descartaveis',
      descricao: 'Produto de teste, nao deve aparecer nas buscas do chat',
      atributos: { faixaPeso: '5-9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'teste' },
      priceCents: 5000,
      active: false,
    })
  })

  it('searchProducts: termo que bate no nome de um produto real retorna esse produto', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Supersec Pants')

    expect(results.length).toBeGreaterThan(0)
    expect(results.some((p) => p.id === 'p1')).toBe(true)
    expect(results.every((p) => 'name' in p && 'brand' in p && 'priceCents' in p)).toBe(true)
  })

  it('searchProducts: termo que bate na marca retorna produtos dessa marca', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Huggies')

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((p) => p.brand === 'Huggies')).toBe(true)
  })

  it('searchProducts: termo que nao bate em nada retorna array vazio', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'produto-que-nao-existe-xyz123')

    expect(results).toEqual([])
  })

  it('searchProducts: nunca retorna produto despublicado (active=false)', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Fralda Despublicada Teste')

    expect(results).toEqual([])
  })

  it('searchProducts: resultado nao vaza supplierEmail nem supplierId', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, 'Pampers')

    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item).not.toHaveProperty('supplierEmail')
      expect(item).not.toHaveProperty('supplierId')
    }
  })

  it('getProduct: id real retorna o produto com priceCents presente', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, 'p1')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('p1')
    expect(result?.name).toBe('Supersec Pants')
    expect(typeof result?.priceCents).toBe('number')
  })

  it('getProduct: id inexistente retorna null', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, 'produto-fantasma-xyz123')

    expect(result).toBeNull()
  })

  it('getProduct: id de produto despublicado retorna null (nao acessivel pelo chat)', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, despublicadoId)

    expect(result).toBeNull()
  })
})
