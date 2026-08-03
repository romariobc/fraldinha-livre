import { describe, it, expect } from 'vitest'
import { ChatRequestSchema, ChatResponseSchema, SUPPORTED_CHAT_IMAGE_TYPES } from '../index'

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

  it('aceita png e webp como data URI', () => {
    for (const image of ['data:image/png;base64,iVBORw0KGgo=', 'data:image/webp;base64,UklGRg==']) {
      const result = ChatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'essa aqui' }],
        image,
      })
      expect(result.success).toBe(true)
    }
  })

  // O modelo nao aceita URL http; se o schema deixasse passar, a foto seria
  // descartada em silencio no meio do caminho em vez de dar erro.
  it('rejeita URL http como imagem (falha alto, nao silenciosamente)', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'essa aqui' }],
      image: 'https://exemplo.com/foto.jpg',
    })
    expect(result.success).toBe(false)
  })

  // Sensor da derivacao: se alguem acrescentar um tipo na lista e o regex nao
  // acompanhar (ou vice-versa), este teste quebra antes de virar falha silenciosa.
  it('todo tipo de SUPPORTED_CHAT_IMAGE_TYPES e aceito pelo schema', () => {
    for (const type of SUPPORTED_CHAT_IMAGE_TYPES) {
      const result = ChatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'essa aqui' }],
        image: `data:image/${type};base64,AAAA`,
      })
      expect(result.success, `tipo ${type} deveria ser aceito`).toBe(true)
    }
  })

  it('rejeita data URI que nao e imagem', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'essa aqui' }],
      image: 'data:application/pdf;base64,JVBERi0=',
    })
    expect(result.success).toBe(false)
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
