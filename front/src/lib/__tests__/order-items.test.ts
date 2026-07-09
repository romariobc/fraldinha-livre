import { describe, it, expect } from 'vitest'
import type { Address, Order } from '@/lib/account-mock'
import { getOrderItems } from '../order-items'

describe('getOrderItems', () => {
  const testAddress: Address = {
    logradouro: 'Rua Teste',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01234-567',
  }

  it('should return items array if order has items', () => {
    const order: Order = {
      id: 'ord-001',
      type: 'compra-direta',
      product: 'Pampers Supersec M',
      quantity: 32,
      unit: 'un',
      deliveryAddress: testAddress,
      status: 'confirmado',
      createdAt: '2026-05-12T10:00:00Z',
      price: 8700,
      items: [
        {
          productId: 'prod-001',
          productName: 'Pampers Supersec M',
          unitPrice: 8700,
          quantity: 32,
          unit: 'un',
        },
      ],
    }

    const result = getOrderItems(order)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      productId: 'prod-001',
      productName: 'Pampers Supersec M',
      unitPrice: 8700,
      quantity: 32,
      unit: 'un',
    })
  })

  it('should derive single line from legacy fields when items is not present', () => {
    const order: Order = {
      id: 'ord-002',
      type: 'compra-direta',
      product: 'Huggies Supreme G',
      quantity: 28,
      unit: 'un',
      deliveryAddress: testAddress,
      status: 'confirmado',
      createdAt: '2026-05-13T08:30:00Z',
      price: 9200,
    }

    const result = getOrderItems(order)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      productId: 'ord-002-p1',
      productName: 'Huggies Supreme G',
      unitPrice: 9200,
      quantity: 28,
      unit: 'un',
    })
  })

  it('should set unitPrice to 0 when order has no price (quotation)', () => {
    const order: Order = {
      id: 'ord-003',
      type: 'cotacao',
      product: 'Turma da Mônica P',
      quantity: 2,
      unit: 'cx',
      deliveryAddress: testAddress,
      status: 'aguardando',
      createdAt: '2026-05-11T15:00:00Z',
      offers: [],
    }

    const result = getOrderItems(order)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      productId: 'ord-003-p1',
      productName: 'Turma da Mônica P',
      unitPrice: 0,
      quantity: 2,
      unit: 'cx',
    })
  })

  it('should derive from legacy fields even when items is empty array', () => {
    const order: Order = {
      id: 'ord-004',
      type: 'compra-direta',
      product: 'MamyPoko Pants G',
      quantity: 40,
      unit: 'un',
      deliveryAddress: testAddress,
      status: 'entregue',
      createdAt: '2026-04-20T09:00:00Z',
      price: 10500,
      items: [],
    }

    const result = getOrderItems(order)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      productId: 'ord-004-p1',
      productName: 'MamyPoko Pants G',
      unitPrice: 10500,
      quantity: 40,
      unit: 'un',
    })
  })

  it('should not derive when items is present even if empty initially', () => {
    const order: Order = {
      id: 'ord-005',
      type: 'compra-direta',
      product: 'Cremer XG',
      quantity: 20,
      unit: 'un',
      deliveryAddress: testAddress,
      status: 'confirmado',
      createdAt: '2026-04-10T11:00:00Z',
      price: 5000,
      items: [
        {
          productId: 'custom-prod',
          productName: 'Custom Product Name',
          unitPrice: 5000,
          quantity: 20,
          unit: 'un',
        },
      ],
    }

    const result = getOrderItems(order)

    // Should return exactly the items from order.items, not derive
    expect(result).toHaveLength(1)
    expect(result[0].productId).toBe('custom-prod')
    expect(result[0].productName).toBe('Custom Product Name')
  })
})
