import { describe, it, expect } from 'vitest'
import { contractOrderToDirectOrder, orderToDirectOrder } from '../order-adapters'
import type { Order } from '@contracts'

export const apiOrder: Order = {
  id: 'qa-real-items', uid: 'buyer', type: 'compra-direta', status: 'aguardando',
  product: 'Compra com dois produtos', quantity: 3, unit: 'un', price: 8000,
  supplierId: 'supplier', createdAt: '2026-10-04T10:00:00Z', paymentStatus: 'approved',
  deliveryAddress: { logradouro: 'Rua QA Real', numero: '123', complemento: 'Apto 4',
    bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000000' },
  items: [
    { productId: 'p1', productName: 'Produto um', unitPrice: 2500, quantity: 2, unit: 'un' },
    { productId: 'p2', productName: 'Produto dois', unitPrice: 3000, quantity: 1, unit: 'un' },
  ],
}

describe('Dados do pedido enviados ao fornecedor', () => {
  it('preserva endereço, linhas e pagamento aprovado no pedido da API', () => {
    expect(contractOrderToDirectOrder(apiOrder)).toMatchObject({
      deliveryAddress: apiOrder.deliveryAddress, items: apiOrder.items, paymentStatus: 'confirmado',
    })
  })
  it('preserva os mesmos dados no pedido criado pelo checkout', () => {
    expect(orderToDirectOrder(apiOrder)).toMatchObject({
      deliveryAddress: apiOrder.deliveryAddress, items: apiOrder.items, paymentStatus: 'confirmado',
    })
  })
})
