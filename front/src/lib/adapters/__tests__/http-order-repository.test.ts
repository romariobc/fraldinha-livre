/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { z } from 'zod'
import { HttpOrderRepository } from '../http-order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError, OrderForbiddenError } from '@/lib/ports/order-repository'
import { runOrderRepositoryContract } from '@/lib/ports/__tests__/order-repository.contract'
import type { Order } from '@contracts'

// Mock firebase auth ANTES de importar http-order-repository
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve('test-token'),
    },
  },
}))

// Mock @contracts para resolver o problema de zod v3 vs v4
vi.mock('@contracts', async () => {
  const actual = await vi.importActual('@contracts')

  // Criar um schema mock que funciona com zod v4 usando z.any()
  const mockOrderSchema = z.any()

  return {
    ...actual,
    OrderSchema: mockOrderSchema,
  }
})

// ============================================================================
// Parte A: Testes específicos de HTTP (fetch mockado simples)
// ============================================================================

describe('HttpOrderRepository - Parte A: comportamento específico de HTTP', () => {
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

      const repo = new HttpOrderRepository()
      await repo.list()

      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })

    it('create() envia Authorization: Bearer <token>', async () => {
      const mockOrder: Order = {
        id: 'ord-1',
        uid: 'uid-1',
        type: 'compra-direta',
        status: 'aguardando',
        createdAt: new Date().toISOString(),
        product: 'Test',
        quantity: 1,
        unit: 'un',
        price: 1000,
        supplierId: 'sup-1',
        supplierName: 'Supplier',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '1',
          bairro: 'Bairro',
          cidade: 'Cidade',
          estado: 'SP',
          cep: '12345-678',
        },
        items: [],
      }

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockOrder), { status: 201 })
      )

      const repo = new HttpOrderRepository()
      await repo.create({
        product: 'Test',
        quantity: 1,
        unit: 'un',
        price: 1000,
        supplierId: 'sup-1',
        supplierName: 'Supplier',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '1',
          bairro: 'Bairro',
          cidade: 'Cidade',
          estado: 'SP',
          cep: '12345-678',
        },
        items: [],
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })

    it('cancel() envia Authorization: Bearer <token>', async () => {
      const mockOrder: Order = {
        id: 'ord-1',
        uid: 'uid-1',
        type: 'compra-direta',
        status: 'cancelado',
        createdAt: new Date().toISOString(),
        product: 'Test',
        quantity: 1,
        unit: 'un',
        price: 1000,
        supplierId: 'sup-1',
        supplierName: 'Supplier',
        deliveryAddress: {
          logradouro: 'Rua A',
          numero: '1',
          bairro: 'Bairro',
          cidade: 'Cidade',
          estado: 'SP',
          cep: '12345-678',
        },
        items: [],
      }

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockOrder), { status: 200 })
      )

      const repo = new HttpOrderRepository()
      await repo.cancel('ord-1')

      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })
  })

  describe('mapeamento de status HTTP para erros', () => {
    it('cancel() com status 404 lança OrderNotFoundError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      )

      const repo = new HttpOrderRepository()
      await expect(repo.cancel('ord-missing')).rejects.toThrow(OrderNotFoundError)
    })

    it('cancel() com status 403 lança OrderForbiddenError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
      )

      const repo = new HttpOrderRepository()
      await expect(repo.cancel('ord-forbidden')).rejects.toThrow(OrderForbiddenError)
    })

    it('cancel() com status 409 lança OrderCancelNotAllowedError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'not allowed' }), { status: 409 })
      )

      const repo = new HttpOrderRepository()
      await expect(repo.cancel('ord-not-allowed')).rejects.toThrow(
        OrderCancelNotAllowedError
      )
    })
  })

  describe('parsing de respostas', () => {
    it('list() com resposta 200 vazia retorna array vazio', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repo = new HttpOrderRepository()
      const orders = await repo.list()

      expect(Array.isArray(orders)).toBe(true)
      expect(orders).toHaveLength(0)
    })
  })
})

// ============================================================================
// Parte B: runOrderRepositoryContract com fetch mockado estateful
// ============================================================================

function createFakeFetch() {
  const fakeDb: Order[] = []
  let counter = 0

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.endsWith('/orders')) {
      return new Response(JSON.stringify(fakeDb), { status: 200 })
    }

    if (method === 'POST' && url.endsWith('/orders')) {
      const body = JSON.parse(init!.body as string)
      counter += 1
      const order: Order = {
        id: `fake-order-${counter}`,
        uid: 'fake-uid',
        type: 'compra-direta',
        status: 'aguardando',
        createdAt: new Date(2026, 0, 1).toISOString(),
        product: body.product ?? 'Test Product',
        quantity: body.quantity ?? 1,
        unit: body.unit ?? 'un',
        price: body.price,
        supplierId: body.supplierId,
        supplierName: body.supplierName,
        deliveryAddress: body.deliveryAddress,
        items: body.items ?? [],
      }
      fakeDb.push(order)
      return new Response(JSON.stringify(order), { status: 201 })
    }

    const cancelMatch = url.match(/\/orders\/([^/]+)\/cancel$/)
    if (method === 'PATCH' && cancelMatch) {
      const order = fakeDb.find((o) => o.id === cancelMatch[1])
      if (!order) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      if (order.status !== 'aguardando') {
        return new Response(JSON.stringify({ error: 'not allowed' }), { status: 409 })
      }
      order.status = 'cancelado'
      return new Response(JSON.stringify(order), { status: 200 })
    }

    throw new Error(`fetch fake nao trata: ${method} ${url}`)
  })
}

describe('HttpOrderRepository - Parte B: Contract test com fetch mockado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  runOrderRepositoryContract('HttpOrderRepository (fetch mockado)', () => {
    vi.stubGlobal('fetch', createFakeFetch())
    return new HttpOrderRepository()
  })
})
