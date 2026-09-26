import { describe, it, expect } from 'vitest'
import {
  PaymentMethodSchema,
  SimulatedPaymentOutcomeSchema,
  SimulatedPaymentRequestSchema,
  SimulatedPaymentResultSchema,
  OrderSchema,
  CreateOrderRequestSchema,
} from '../index'

describe('PaymentMethodSchema', () => {
  it('aceita pix e card', () => {
    expect(PaymentMethodSchema.safeParse('pix').success).toBe(true)
    expect(PaymentMethodSchema.safeParse('card').success).toBe(true)
  })

  it('rejeita metodos invalidos', () => {
    expect(PaymentMethodSchema.safeParse('dinheiro').success).toBe(false)
    expect(PaymentMethodSchema.safeParse('').success).toBe(false)
  })
})

describe('SimulatedPaymentOutcomeSchema', () => {
  it('aceita approved, declined e pending', () => {
    expect(SimulatedPaymentOutcomeSchema.safeParse('approved').success).toBe(true)
    expect(SimulatedPaymentOutcomeSchema.safeParse('declined').success).toBe(true)
    expect(SimulatedPaymentOutcomeSchema.safeParse('pending').success).toBe(true)
  })

  it('rejeita status desconhecido', () => {
    expect(SimulatedPaymentOutcomeSchema.safeParse('failed').success).toBe(false)
  })
})

describe('SimulatedPaymentRequestSchema', () => {
  it('valida request com valores default', () => {
    const res = SimulatedPaymentRequestSchema.safeParse({
      amount: 5000,
      method: 'pix',
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.simulationOutcome).toBe('approved')
      expect(res.data.amount).toBe(5000)
      expect(res.data.method).toBe('pix')
    }
  })

  it('valida request com simulationOutcome explicito', () => {
    const res = SimulatedPaymentRequestSchema.safeParse({
      amount: 10000,
      method: 'card',
      simulationOutcome: 'declined',
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.simulationOutcome).toBe('declined')
    }
  })

  it('rejeita amount negativo', () => {
    const res = SimulatedPaymentRequestSchema.safeParse({
      amount: -10,
      method: 'pix',
    })
    expect(res.success).toBe(false)
  })
})

describe('SimulatedPaymentResultSchema', () => {
  it('valida resultado aprovado com paidAt', () => {
    const res = SimulatedPaymentResultSchema.safeParse({
      status: 'approved',
      transactionId: 'txn-12345',
      paidAt: '2026-09-26T20:00:00Z',
    })
    expect(res.success).toBe(true)
  })

  it('valida resultado recusado com motivo', () => {
    const res = SimulatedPaymentResultSchema.safeParse({
      status: 'declined',
      transactionId: 'txn-12346',
      refusalReason: 'Transação simulada não autorizada.',
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.refusalReason).toBe('Transação simulada não autorizada.')
    }
  })

  it('rejeita resultado sem transactionId', () => {
    const res = SimulatedPaymentResultSchema.safeParse({
      status: 'approved',
      transactionId: '',
    })
    expect(res.success).toBe(false)
  })
})

describe('OrderSchema com metadados de pagamento', () => {
  const baseOrder = {
    id: 'ord-123',
    uid: 'user-456',
    type: 'compra-direta' as const,
    status: 'aguardando' as const,
    product: 'Fralda Tamanho M',
    quantity: 2,
    unit: 'cx' as const,
    price: 5000,
    deliveryAddress: {
      logradouro: 'Rua X',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'SP',
      cep: '01000-000',
    },
    createdAt: '2026-09-26T20:00:00Z',
    items: [
      {
        productId: 'prod-123',
        productName: 'Fralda Tamanho M',
        unitPrice: 2500,
        quantity: 2,
        unit: 'cx' as const,
      },
    ],
  }

  it('valida order com campos de pagamento opcionais presentes', () => {
    const orderWithPayment = {
      ...baseOrder,
      paymentMethod: 'pix' as const,
      paymentTransactionId: 'txn-sim-001',
      paymentStatus: 'approved' as const,
    }
    const res = OrderSchema.safeParse(orderWithPayment)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.paymentMethod).toBe('pix')
      expect(res.data.paymentTransactionId).toBe('txn-sim-001')
      expect(res.data.paymentStatus).toBe('approved')
    }
  })

  it('valida order sem campos de pagamento (retrocompatibilidade)', () => {
    const res = OrderSchema.safeParse(baseOrder)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.paymentMethod).toBeUndefined()
    }
  })
})

describe('CreateOrderRequestSchema com metadados de pagamento', () => {
  const baseRequest = {
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
    items: [
      {
        productId: 'prod-123',
        productName: 'Fralda Tamanho M',
        unitPrice: 2500,
        quantity: 2,
        unit: 'cx' as const,
      },
    ],
  }

  it('valida request com pagamento simulado aprovado', () => {
    const reqWithPayment = {
      ...baseRequest,
      paymentMethod: 'card' as const,
      paymentTransactionId: 'txn-sim-card-1',
      paymentStatus: 'approved' as const,
    }
    const res = CreateOrderRequestSchema.safeParse(reqWithPayment)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.paymentMethod).toBe('card')
      expect(res.data.paymentTransactionId).toBe('txn-sim-card-1')
      expect(res.data.paymentStatus).toBe('approved')
    }
  })
})
