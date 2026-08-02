import { describe, it, expect } from 'vitest'
import { ChatRequestSchema, ChatResponseSchema } from '../index'

describe('ChatRequestSchema', () => {
  it('aceita uma mensagem de usuario sem foto', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'preciso de fralda tamanho M' }],
    })
    expect(result.success).toBe(true)
  })

  it('aceita com foto (data URL base64)', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'essa aqui' }],
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita messages vazio', () => {
    const result = ChatRequestSchema.safeParse({ messages: [] })
    expect(result.success).toBe(false)
  })

  it('rejeita role fora de user/assistant', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'system', content: 'oi' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita content vazio', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: '' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('ChatResponseSchema', () => {
  it('faz parse de uma resposta de texto', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'text',
      content: 'qual marca voce prefere?',
    })
    expect(result.success).toBe(true)
  })

  it('faz parse de uma acao select_product', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita quantity zero ou negativo', () => {
    const zero = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 0,
    })
    const negativo = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: -1,
    })
    expect(zero.success).toBe(false)
    expect(negativo.success).toBe(false)
  })

  it('rejeita quantity nao inteiro', () => {
    const result = ChatResponseSchema.safeParse({
      type: 'action',
      action: 'select_product',
      productId: 'p1',
      quantity: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita type fora de text/action', () => {
    const result = ChatResponseSchema.safeParse({ type: 'oops', content: 'x' })
    expect(result.success).toBe(false)
  })
})
