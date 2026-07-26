/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HttpProductRepository } from '../http-product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import { runProductRepositoryContract } from '@/lib/ports/__tests__/product-repository.contract'
import type { Product } from '@contracts'

// Mock firebase auth ANTES de importar http-product-repository
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve('test-token'),
    },
  },
}))

// ============================================================================
// Parte A: Testes específicos de HTTP (fetch mockado simples)
// ============================================================================

describe('HttpProductRepository - Parte A: comportamento específico de HTTP', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('header Authorization', () => {
    it('list() envia Authorization: Bearer <token>', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repo = new HttpProductRepository()
      await repo.list()

      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })

    it('create() envia Authorization: Bearer <token>', async () => {
      const mockProduct: Product = {
        id: 'prod-1',
        supplierId: 'sup-1',
        active: true,
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
      }

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockProduct), { status: 201 })
      )

      const repo = new HttpProductRepository()
      await repo.create({
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

      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })
  })

  describe('mapeamento de status HTTP para erros', () => {
    it('update() com status 404 lança ProductNotFoundError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      )

      const repo = new HttpProductRepository()
      await expect(repo.update('prod-missing', { active: false })).rejects.toThrow(ProductNotFoundError)
    })

    it('update() com status 403 lança ProductForbiddenError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
      )

      const repo = new HttpProductRepository()
      await expect(repo.update('prod-forbidden', { active: false })).rejects.toThrow(ProductForbiddenError)
    })

    it('remove() com status 404 lança ProductNotFoundError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      )

      const repo = new HttpProductRepository()
      await expect(repo.remove('prod-missing')).rejects.toThrow(ProductNotFoundError)
    })

    it('remove() com status 403 lança ProductForbiddenError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
      )

      const repo = new HttpProductRepository()
      await expect(repo.remove('prod-forbidden')).rejects.toThrow(ProductForbiddenError)
    })
  })

  describe('parsing de respostas', () => {
    it('list() com resposta 200 vazia retorna array vazio', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repo = new HttpProductRepository()
      const products = await repo.list()

      expect(Array.isArray(products)).toBe(true)
      expect(products).toHaveLength(0)
    })
  })
})

// ============================================================================
// Parte B: runProductRepositoryContract com fetch mockado estateful
// ============================================================================

function createFakeFetch() {
  const fakeDb: Product[] = []
  let counter = 0

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.includes('/products') && url.includes('scope=fornecedor')) {
      return new Response(JSON.stringify(fakeDb), { status: 200 })
    }

    if (method === 'GET' && url.endsWith('/products')) {
      return new Response(JSON.stringify(fakeDb.filter((p) => p.active)), { status: 200 })
    }

    if (method === 'POST' && url.endsWith('/products')) {
      const body = JSON.parse(init!.body as string)
      counter += 1
      const product: Product = {
        id: `fake-product-${counter}`,
        supplierId: 'fake-supplier',
        active: true,
        name: body.name,
        brand: body.brand,
        size: body.size,
        quantity: body.quantity,
        priceCents: body.priceCents,
        slug: body.slug,
        categoria: body.categoria,
        descricao: body.descricao,
        atributos: body.atributos,
        badge: body.badge,
      }
      fakeDb.push(product)
      return new Response(JSON.stringify(product), { status: 201 })
    }

    const idMatch = url.match(/\/products\/([^/?]+)$/)
    if (method === 'PUT' && idMatch) {
      const product = fakeDb.find((p) => p.id === idMatch[1])
      if (!product) return new Response(JSON.stringify({ error: 'product not found' }), { status: 404 })
      const body = JSON.parse(init!.body as string)
      Object.assign(product, body)
      return new Response(JSON.stringify(product), { status: 200 })
    }

    if (method === 'DELETE' && idMatch) {
      const index = fakeDb.findIndex((p) => p.id === idMatch[1])
      if (index === -1) return new Response(JSON.stringify({ error: 'product not found' }), { status: 404 })
      fakeDb.splice(index, 1)
      return new Response(null, { status: 204 })
    }

    throw new Error(`fetch fake nao trata: ${method} ${url}`)
  })
}

describe('HttpProductRepository - Parte B: Contract test com fetch mockado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  runProductRepositoryContract('HttpProductRepository (fetch mockado)', () => {
    vi.stubGlobal('fetch', createFakeFetch())
    return new HttpProductRepository()
  })
})
