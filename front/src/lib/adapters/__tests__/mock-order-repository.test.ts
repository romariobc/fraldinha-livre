import { describe, it, expect } from 'vitest'
import { MockOrderRepository } from '../mock-order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError } from '@/lib/ports/order-repository'
import { runOrderRepositoryContract } from '@/lib/ports/__tests__/order-repository.contract'
import type { CreateOrderRequest } from '@contracts'
import { INITIAL_ORDERS } from '@/lib/account-mock'

describe('MockOrderRepository', () => {
  const mockNow = () => '2026-07-19T10:00:00Z'
  let idCounter = 0
  const mockIdFactory = () => `order-${++idCounter}`

  it('list() retorna os pedidos do seed com uid correto e items não-vazio', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })
    const orders = await repo.list()

    expect(orders.length).toBe(INITIAL_ORDERS.length)

    for (const order of orders) {
      expect(order.uid).toBe('mock-uid-ana')
      expect(order.items).toBeDefined()
      expect(Array.isArray(order.items)).toBe(true)
      expect(order.items.length).toBeGreaterThan(0)
    }
  })

  it('create() com CreateOrderRequest válido retorna Order com status aguardando', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })
    idCounter = 0 // reset para teste determinístico

    const req: CreateOrderRequest = {
      product: 'Teste Produto',
      quantity: 5,
      unit: 'un',
      price: 1000,
      supplierId: 'sup-test',
      supplierName: 'Fornecedor Teste',
      deliveryAddress: {
        logradouro: 'Rua Teste',
        numero: '123',
        bairro: 'Bairro Teste',
        cidade: 'Cidade Teste',
        estado: 'SP',
        cep: '12345-678',
      },
      items: [{
        productId: 'prod-1',
        productName: 'Teste Produto',
        unitPrice: 1000,
        quantity: 5,
        unit: 'un',
      }],
    }

    const order = await repo.create(req)

    expect(order.id).toBe('order-1')
    expect(order.status).toBe('aguardando')
    expect(order.uid).toBe('mock-uid-ana')
    expect(order.createdAt).toBe(mockNow())
    expect(order.product).toBe(req.product)
    expect(order.quantity).toBe(req.quantity)
  })

  it('create() adiciona o pedido à lista interna', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })
    idCounter = 0

    const initialCount = (await repo.list()).length

    const req: CreateOrderRequest = {
      product: 'Novo Pedido',
      quantity: 2,
      unit: 'cx',
      supplierId: 'sup-x',
      supplierName: 'Fornecedor X',
      deliveryAddress: {
        logradouro: 'Rua X',
        numero: '456',
        bairro: 'Bairro X',
        cidade: 'Cidade X',
        estado: 'RJ',
        cep: '98765-432',
      },
      items: [{
        productId: 'prod-x',
        productName: 'Novo Pedido',
        unitPrice: 500,
        quantity: 2,
        unit: 'cx',
      }],
    }

    await repo.create(req)
    const afterCount = (await repo.list()).length

    expect(afterCount).toBe(initialCount + 1)
  })

  it('cancel() de pedido em aguardando retorna com status cancelado', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })
    idCounter = 0

    // Criar um pedido em aguardando
    const req: CreateOrderRequest = {
      product: 'Cancelável',
      quantity: 1,
      unit: 'un',
      deliveryAddress: {
        logradouro: 'Rua C',
        numero: '789',
        bairro: 'Bairro C',
        cidade: 'Cidade C',
        estado: 'MG',
        cep: '11111-111',
      },
      items: [{
        productId: 'prod-c',
        productName: 'Cancelável',
        unitPrice: 200,
        quantity: 1,
        unit: 'un',
      }],
    }

    const created = await repo.create(req)
    const cancelled = await repo.cancel(created.id)

    expect(cancelled.status).toBe('cancelado')
    expect(cancelled.id).toBe(created.id)
  })

  it('cancel() de pedido com status diferente de aguardando lança OrderCancelNotAllowedError', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })

    // INITIAL_ORDERS tem ord-003 (confirmado), ord-004 (entregue), ord-005 (cancelado)
    const orders = await repo.list()
    const confirmedOrder = orders.find((o) => o.status === 'confirmado')

    expect(confirmedOrder).toBeDefined()
    expect(confirmedOrder!.status).not.toBe('aguardando')

    await expect(repo.cancel(confirmedOrder!.id)).rejects.toThrow(OrderCancelNotAllowedError)
  })

  it('cancel() de orderId inexistente lança OrderNotFoundError', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })

    await expect(repo.cancel('inexistente-xyz')).rejects.toThrow(OrderNotFoundError)
  })

  it('cancel() com OrderNotFoundError tem mensagem descritiva', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })

    try {
      await repo.cancel('test-id-999')
    } catch (error) {
      expect(error).toBeInstanceOf(OrderNotFoundError)
      expect((error as Error).message).toContain('test-id-999')
    }
  })

  it('cancel() com OrderCancelNotAllowedError tem mensagem descritiva', async () => {
    const repo = new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory })

    const orders = await repo.list()
    const entregueOrder = orders.find((o) => o.status === 'entregue')

    expect(entregueOrder).toBeDefined()

    try {
      await repo.cancel(entregueOrder!.id)
    } catch (error) {
      expect(error).toBeInstanceOf(OrderCancelNotAllowedError)
      expect((error as Error).message).toContain(entregueOrder!.id)
      expect((error as Error).message).toContain('entregue')
    }
  })

  it('múltiplas instâncias de MockOrderRepository têm estado isolado', async () => {
    const repo1 = new MockOrderRepository({ now: mockNow, idFactory: () => 'id-1' })
    const repo2 = new MockOrderRepository({ now: mockNow, idFactory: () => 'id-2' })

    const list1 = await repo1.list()
    const list2 = await repo2.list()

    expect(list1.length).toBe(list2.length)
    // Modificar uma não afeta a outra
    const req: CreateOrderRequest = {
      product: 'Teste Isolamento',
      quantity: 1,
      unit: 'un',
      deliveryAddress: {
        logradouro: 'Isolado',
        numero: '999',
        bairro: 'Isolado',
        cidade: 'Isolado',
        estado: 'SP',
        cep: '99999-999',
      },
      items: [{
        productId: 'iso-1',
        productName: 'Isolamento',
        unitPrice: 100,
        quantity: 1,
        unit: 'un',
      }],
    }

    await repo1.create(req)
    const list1After = await repo1.list()
    const list2After = await repo2.list()

    expect(list1After.length).toBe(list1.length + 1)
    expect(list2After.length).toBe(list2.length) // repo2 inalterado
  })

  // Contract tests with empty seed
  runOrderRepositoryContract('MockOrderRepository (empty seed)', () =>
    new MockOrderRepository({ now: mockNow, idFactory: mockIdFactory, seed: [] })
  )
})
