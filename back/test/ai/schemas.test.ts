import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  SearchProductsArgsSchema,
  GetProductArgsSchema,
  SelectProductArgsSchema,
} from '../../src/lib/ai/tools/schemas'

describe('SearchProductsArgsSchema', () => {
  it('aceita objeto vazio (todos os campos opcionais)', () => {
    expect(() => SearchProductsArgsSchema.parse({})).not.toThrow()
  })

  it('aceita todos os campos preenchidos', () => {
    const result = SearchProductsArgsSchema.parse({
      query: 'fralda G',
      brand: 'Pampers',
      size: 'G',
      categoria: 'fraldas-descartaveis',
    })
    expect(result).toEqual({ query: 'fralda G', brand: 'Pampers', size: 'G', categoria: 'fraldas-descartaveis' })
  })

  it('rejeita query com mais de 200 caracteres', () => {
    expect(() =>
      SearchProductsArgsSchema.parse({ query: 'a'.repeat(201) }),
    ).toThrow(ZodError)
  })

  it('rejeita brand com mais de 100 caracteres', () => {
    expect(() =>
      SearchProductsArgsSchema.parse({ brand: 'b'.repeat(101) }),
    ).toThrow(ZodError)
  })

  it('rejeita size com mais de 20 caracteres', () => {
    expect(() =>
      SearchProductsArgsSchema.parse({ size: 's'.repeat(21) }),
    ).toThrow(ZodError)
  })

  it('ignora campos extras desconhecidos (strip)', () => {
    const result = SearchProductsArgsSchema.parse({ query: 'pampers', injectedField: 'malicious' })
    expect(result).not.toHaveProperty('injectedField')
  })
})

describe('GetProductArgsSchema', () => {
  it('aceita productId alfanumérico com hífen e underscore', () => {
    expect(() => GetProductArgsSchema.parse({ productId: 'p1' })).not.toThrow()
    expect(() => GetProductArgsSchema.parse({ productId: 'prod_123-abc' })).not.toThrow()
  })

  it('rejeita productId vazio', () => {
    expect(() => GetProductArgsSchema.parse({ productId: '' })).toThrow(ZodError)
  })

  it('rejeita productId com caracteres especiais (injeção)', () => {
    expect(() => GetProductArgsSchema.parse({ productId: "p1'; DROP TABLE products;--" })).toThrow(ZodError)
    expect(() => GetProductArgsSchema.parse({ productId: '../etc/passwd' })).toThrow(ZodError)
    expect(() => GetProductArgsSchema.parse({ productId: '<script>alert(1)</script>' })).toThrow(ZodError)
  })

  it('rejeita productId com mais de 50 caracteres', () => {
    expect(() =>
      GetProductArgsSchema.parse({ productId: 'a'.repeat(51) }),
    ).toThrow(ZodError)
  })

  it('rejeita ausência de productId', () => {
    expect(() => GetProductArgsSchema.parse({})).toThrow(ZodError)
  })
})

describe('SelectProductArgsSchema', () => {
  it('aceita pedido válido mínimo (productId + quantity)', () => {
    const result = SelectProductArgsSchema.parse({ productId: 'p3', quantity: 2 })
    expect(result).toMatchObject({ productId: 'p3', quantity: 2 })
  })

  it('aceita quantity = 1 (mínimo)', () => {
    expect(() => SelectProductArgsSchema.parse({ productId: 'p1', quantity: 1 })).not.toThrow()
  })

  it('aceita quantity = 50 (máximo aprovado em task-1)', () => {
    expect(() => SelectProductArgsSchema.parse({ productId: 'p1', quantity: 50 })).not.toThrow()
  })

  it('rejeita quantity = 0 (mínimo violado)', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 0 }),
    ).toThrow(ZodError)
  })

  it('rejeita quantity = 51 (ataque de exaustão de estoque)', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 51 }),
    ).toThrow(ZodError)
  })

  it('rejeita quantity = 999999 (ataque extremo)', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 999999 }),
    ).toThrow(ZodError)
  })

  it('rejeita quantity negativa', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: -1 }),
    ).toThrow(ZodError)
  })

  it('rejeita quantity não inteira', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 1.5 }),
    ).toThrow(ZodError)
  })

  it('rejeita paymentMethod fora do enum ["pix", "cartao"]', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 1, paymentMethod: 'boleto' }),
    ).toThrow(ZodError)
  })

  it('aceita paymentMethod "pix"', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 1, paymentMethod: 'pix' }),
    ).not.toThrow()
  })

  it('aceita paymentMethod "cartao"', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: 'p1', quantity: 1, paymentMethod: 'cartao' }),
    ).not.toThrow()
  })

  it('rejeita productId com caracteres especiais', () => {
    expect(() =>
      SelectProductArgsSchema.parse({ productId: '../escape', quantity: 1 }),
    ).toThrow(ZodError)
  })

  it('aceita pedido completo com endereço e pagamento', () => {
    const result = SelectProductArgsSchema.parse({
      productId: 'p3',
      quantity: 3,
      paymentMethod: 'pix',
      address: {
        logradouro: 'Rua das Flores',
        numero: '42',
        complemento: 'Apto 10',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
      },
    })
    expect(result.address?.logradouro).toBe('Rua das Flores')
    expect(result.address?.complemento).toBe('Apto 10')
  })

  it('rejeita address com campos obrigatórios faltando', () => {
    expect(() =>
      SelectProductArgsSchema.parse({
        productId: 'p1',
        quantity: 1,
        address: { logradouro: 'Rua X', numero: '1' }, // faltam bairro, cidade, estado, cep
      }),
    ).toThrow(ZodError)
  })
})
