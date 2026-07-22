import { describe, it, expect } from 'vitest'
import {
  AddressSchema,
  OrderItemSchema,
  OrderSchema,
  CreateOrderRequestSchema,
} from '../index'

describe('AddressSchema', () => {
  it('parses um endereco valido completamente', () => {
    const validAddress = {
      logradouro: 'Rua X',
      numero: '123',
      complemento: 'Apto 10',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'SP',
      cep: '01000-000',
    }
    const result = AddressSchema.safeParse(validAddress)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.logradouro).toBe('Rua X')
      expect(result.data.estado).toBe('SP')
    }
  })

  it('rejeita estado com mais de 2 caracteres', () => {
    const invalidAddress = {
      logradouro: 'Rua X',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'SPP',
      cep: '01000-000',
    }
    const result = AddressSchema.safeParse(invalidAddress)
    expect(result.success).toBe(false)
  })

  it('rejeita estado com menos de 2 caracteres', () => {
    const invalidAddress = {
      logradouro: 'Rua X',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'S',
      cep: '01000-000',
    }
    const result = AddressSchema.safeParse(invalidAddress)
    expect(result.success).toBe(false)
  })
})

describe('OrderItemSchema', () => {
  it('parses um item de pedido valido', () => {
    const validItem = {
      productId: 'prod-123',
      productName: 'Fralda Tamanho M',
      unitPrice: 2500, // 25 reais em centavos
      quantity: 2,
      unit: 'cx',
    }
    const result = OrderItemSchema.safeParse(validItem)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitPrice).toBe(2500)
      expect(result.data.quantity).toBe(2)
    }
  })

  it('rejeita unitPrice negativo', () => {
    const invalidItem = {
      productId: 'prod-123',
      productName: 'Fralda Tamanho M',
      unitPrice: -100,
      quantity: 2,
      unit: 'cx',
    }
    const result = OrderItemSchema.safeParse(invalidItem)
    expect(result.success).toBe(false)
  })

  it('rejeita quantity zero', () => {
    const invalidItem = {
      productId: 'prod-123',
      productName: 'Fralda Tamanho M',
      unitPrice: 2500,
      quantity: 0,
      unit: 'cx',
    }
    const result = OrderItemSchema.safeParse(invalidItem)
    expect(result.success).toBe(false)
  })

  it('rejeita quantity negativo', () => {
    const invalidItem = {
      productId: 'prod-123',
      productName: 'Fralda Tamanho M',
      unitPrice: 2500,
      quantity: -1,
      unit: 'cx',
    }
    const result = OrderItemSchema.safeParse(invalidItem)
    expect(result.success).toBe(false)
  })
})

describe('OrderSchema', () => {
  it('parses um pedido completo e valido', () => {
    const validOrder = {
      id: 'order-123',
      uid: 'user-456',
      type: 'compra-direta' as const,
      status: 'aguardando' as const,
      product: 'Fralda Tamanho M',
      quantity: 2,
      unit: 'cx' as const,
      price: 5000,
      supplierId: 'supplier-789',
      supplierName: 'Distribuidora A',
      deliveryAddress: {
        logradouro: 'Rua X',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      createdAt: '2026-07-19T10:00:00Z',
      items: [
        {
          productId: 'prod-123',
          productName: 'Fralda Tamanho M',
          unitPrice: 2500,
          quantity: 2,
          unit: 'cx',
        },
      ],
    }
    const result = OrderSchema.safeParse(validOrder)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('order-123')
      expect(result.data.items.length).toBe(1)
    }
  })
})

describe('CreateOrderRequestSchema', () => {
  it('parses um request valido', () => {
    const validRequest = {
      product: 'Fralda Tamanho M',
      quantity: 2,
      unit: 'cx',
      price: 5000,
      supplierId: 'supplier-789',
      supplierName: 'Distribuidora A',
      deliveryAddress: {
        logradouro: 'Rua X',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      items: [
        {
          productId: 'prod-123',
          productName: 'Fralda Tamanho M',
          unitPrice: 2500,
          quantity: 2,
          unit: 'cx',
        },
      ],
    }
    const result = CreateOrderRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it('rejeita items vazio', () => {
    const invalidRequest = {
      product: 'Fralda Tamanho M',
      quantity: 2,
      unit: 'cx',
      deliveryAddress: {
        logradouro: 'Rua X',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      items: [],
    }
    const result = CreateOrderRequestSchema.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })

  it('ignora e descarta campos id/uid/status/createdAt enviados pelo cliente (RN-03)', () => {
    const requestWithExtraFields = {
      product: 'Fralda Tamanho M',
      quantity: 2,
      unit: 'cx',
      deliveryAddress: {
        logradouro: 'Rua X',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      items: [
        {
          productId: 'prod-123',
          productName: 'Fralda Tamanho M',
          unitPrice: 2500,
          quantity: 2,
          unit: 'cx',
        },
      ],
      // Campos que o cliente nao deve enviar
      id: 'order-fake-123',
      uid: 'user-fake-456',
      status: 'aceito',
      createdAt: '2020-01-01T00:00:00Z',
    }
    const result = CreateOrderRequestSchema.safeParse(requestWithExtraFields)
    expect(result.success).toBe(true)
    if (result.success) {
      // O resultado nao deve conter os campos extras descartados
      expect('id' in result.data).toBe(false)
      expect('uid' in result.data).toBe(false)
      expect('status' in result.data).toBe(false)
      expect('createdAt' in result.data).toBe(false)
    }
  })
})
