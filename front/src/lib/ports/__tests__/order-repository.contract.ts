import { describe, it, expect } from 'vitest'
import type { OrderRepository } from '../order-repository'
import { OrderCancelNotAllowedError } from '../order-repository'
import type { CreateOrderRequest } from '@contracts'

/**
 * runOrderRepositoryContract - Reusable contract test suite for OrderRepository implementations.
 *
 * Tests the invariants that ANY conformant implementation must satisfy:
 * - list() returns an empty array when no orders exist
 * - create() makes an order appear in list()
 * - create() sets status to 'aguardando'
 * - cancel() on an 'aguardando' order changes status to 'cancelado'
 * - cancel() on a non-'aguardando' order throws OrderCancelNotAllowedError
 */
export function runOrderRepositoryContract(
  name: string,
  makeRepo: () => OrderRepository
): void {
  describe(`OrderRepository (${name})`, () => {
    // Reusable fixture: minimal valid CreateOrderRequest for testing
    const createMinimalOrder = (): CreateOrderRequest => ({
      product: 'Test Product',
      quantity: 1,
      unit: 'un',
      price: 1000,
      supplierId: 'sup-test',
      supplierName: 'Test Supplier',
      deliveryAddress: {
        logradouro: 'Test Street',
        numero: '123',
        bairro: 'Test District',
        cidade: 'Test City',
        estado: 'SP',
        cep: '12345-678',
      },
      items: [
        {
          productId: 'prod-test',
          productName: 'Test Product',
          unitPrice: 1000,
          quantity: 1,
          unit: 'un',
        },
      ],
    })

    it('list() retorna array vazio quando não há pedidos', async () => {
      const repo = makeRepo()
      const orders = await repo.list()

      expect(Array.isArray(orders)).toBe(true)
      expect(orders.length).toBe(0)
    })

    it('create() faz o pedido aparecer em list()', async () => {
      const repo = makeRepo()
      const request = createMinimalOrder()

      const created = await repo.create(request)
      const orders = await repo.list()

      expect(orders.length).toBe(1)
      expect(orders[0].id).toBe(created.id)
    })

    it('create() define status "aguardando"', async () => {
      const repo = makeRepo()
      const request = createMinimalOrder()

      const created = await repo.create(request)

      expect(created.status).toBe('aguardando')
    })

    it('cancel() em pedido "aguardando" muda o status para "cancelado"', async () => {
      const repo = makeRepo()
      const request = createMinimalOrder()

      const created = await repo.create(request)
      const cancelled = await repo.cancel(created.id)

      expect(cancelled.status).toBe('cancelado')
      expect(cancelled.id).toBe(created.id)
    })

    it('cancel() de um pedido que não está mais "aguardando" lança erro', async () => {
      const repo = makeRepo()
      const request = createMinimalOrder()

      // Create and cancel once (aguardando → cancelado) — succeeds
      const created = await repo.create(request)
      await repo.cancel(created.id)

      // Try to cancel again (cancelado, not aguardando anymore) — should throw
      await expect(repo.cancel(created.id)).rejects.toThrow(
        OrderCancelNotAllowedError
      )
    })
  })
}
