import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { searchProducts, getProduct } from '../src/lib/ai/tools/handlers'
import { products } from '../src/schema/products'

describe('searchProducts / getProduct (lib/ai/tools/handlers)', () => {
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

  it('searchProducts: query livre que bate no nome de um produto real retorna esse produto', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { query: 'Supersec Pants' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.some((p) => p.id === 'p1')).toBe(true)
    expect(results.every((p) => 'name' in p && 'brand' in p && 'priceCents' in p)).toBe(true)
  })

  it('searchProducts: query livre que bate na marca retorna produtos dessa marca', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { query: 'Huggies' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((p) => p.brand === 'Huggies')).toBe(true)
  })

  it('searchProducts: query livre que nao bate em nada retorna array vazio', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { query: 'produto-que-nao-existe-xyz123' })

    expect(results).toEqual([])
  })

  it('searchProducts: nunca retorna produto despublicado (active=false)', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { query: 'Fralda Despublicada Teste' })

    expect(results).toEqual([])
  })

  it('searchProducts: resultado nao vaza supplierEmail nem supplierId', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { query: 'Pampers' })

    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item).not.toHaveProperty('supplierEmail')
      expect(item).not.toHaveProperty('supplierId')
    }
  })

  // Achado real de producao (2026-08-03): o assistente perguntou o tamanho,
  // o comprador respondeu "G", e a busca por query="Pampers tamanho G" (frase
  // composta) voltou vazia mesmo o produto p3 (Pampers, Supersec Pants, G)
  // existindo e ativo. Reproduzido contra o banco real antes deste fix.
  it('searchProducts: brand+size como campos SEPARADOS acha o produto que query livre composta nao achava', async () => {
    const db = drizzle(env.DB)

    const buscaComposta = await searchProducts(db, { query: 'Pampers tamanho G' })
    expect(buscaComposta).toEqual([]) // reproduz o bug: frase composta nao bate em nenhum campo

    const buscaEstruturada = await searchProducts(db, { brand: 'Pampers', size: 'G' })
    // length exato (nao so "contem p3"): descarta falso-positivo de uma
    // implementacao que ignore brand/size e devolva o catalogo inteiro.
    expect(buscaEstruturada).toHaveLength(1)
    expect(buscaEstruturada[0].id).toBe('p3')
  })

  it('searchProducts: size e EXATO, "G" nao pode casar com "GG" nem "XXG"', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, { size: 'G' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((p) => p.size === 'G')).toBe(true)
  })

  it('searchProducts: sem nenhum campo preenchido, retorna vazio (nao devolve o catalogo inteiro)', async () => {
    const db = drizzle(env.DB)
    const results = await searchProducts(db, {})

    expect(results).toEqual([])
  })

  it('getProduct: id real retorna o produto com priceCents presente', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, { productId: 'p1' })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('p1')
    expect(result?.name).toBe('Supersec Pants')
    expect(typeof result?.priceCents).toBe('number')
  })

  it('getProduct: id inexistente retorna null', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, { productId: 'produto-fantasma-xyz123' })

    expect(result).toBeNull()
  })

  it('getProduct: id de produto despublicado retorna null (nao acessivel pelo chat)', async () => {
    const db = drizzle(env.DB)
    const result = await getProduct(db, { productId: despublicadoId })

    expect(result).toBeNull()
  })
})
