import { describe, it, expect } from 'vitest'
import {
  ProductSchema,
  ProductAtributosSchema,
  CreateProductRequestSchema,
} from '../index'

describe('ProductSchema', () => {
  it('parses um produto real de front/src/lib/products.ts (p1 com active: true)', () => {
    const validProduct = {
      id: 'p1',
      name: 'Supersec Pants',
      brand: 'Pampers',
      size: 'P',
      quantity: 36,
      priceCents: 1800,
      supplierId: 'sup-001',
      slug: 'pampers-supersec-pants-p',
      categoria: 'fraldas-descartaveis',
      descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas. Ideal para bebês em fase de mobilidade.',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex' as const,
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: 'Mais vendido',
      active: true,
    }
    const result = ProductSchema.safeParse(validProduct)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('p1')
      expect(result.data.name).toBe('Supersec Pants')
      expect(result.data.priceCents).toBe(1800)
      expect(result.data.active).toBe(true)
    }
  })

  it('rejeita priceCents negativo', () => {
    const invalidProduct = {
      id: 'p1',
      name: 'Supersec Pants',
      brand: 'Pampers',
      size: 'P',
      quantity: 36,
      priceCents: -100,
      supplierId: 'sup-001',
      slug: 'pampers-supersec-pants-p',
      categoria: 'fraldas-descartaveis',
      descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas. Ideal para bebês em fase de mobilidade.',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex' as const,
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      active: true,
    }
    const result = ProductSchema.safeParse(invalidProduct)
    expect(result.success).toBe(false)
  })

  it('rejeita atributos.genero diferente de unissex', () => {
    const invalidProduct = {
      id: 'p1',
      name: 'Supersec Pants',
      brand: 'Pampers',
      size: 'P',
      quantity: 36,
      priceCents: 1800,
      supplierId: 'sup-001',
      slug: 'pampers-supersec-pants-p',
      categoria: 'fraldas-descartaveis',
      descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas. Ideal para bebês em fase de mobilidade.',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'masculino',
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      active: true,
    }
    const result = ProductSchema.safeParse(invalidProduct)
    expect(result.success).toBe(false)
  })
})

describe('CreateProductRequestSchema', () => {
  it('ignora e descarta campos id/supplierId/active extras (nao falha no parse)', () => {
    const requestWithExtraFields = {
      name: 'Supersec Pants',
      brand: 'Pampers',
      size: 'P',
      quantity: 36,
      priceCents: 1800,
      slug: 'pampers-supersec-pants-p',
      categoria: 'fraldas-descartaveis',
      descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas. Ideal para bebês em fase de mobilidade.',
      atributos: {
        faixaPeso: '3–6 kg',
        genero: 'unissex' as const,
        absorcao: 'ate 12 horas',
        tecnologia: 'camada seca antivazamento',
      },
      badge: 'Mais vendido',
      // Campos que o cliente nao deve enviar (mas podem vir no body por engano)
      id: 'p1-fake',
      supplierId: 'sup-999',
      active: true,
    }
    const result = CreateProductRequestSchema.safeParse(requestWithExtraFields)
    expect(result.success).toBe(true)
    if (result.success) {
      // O resultado nao deve conter os campos extras descartados
      expect(result.data).not.toHaveProperty('id')
      expect(result.data).not.toHaveProperty('supplierId')
      expect(result.data).not.toHaveProperty('active')
    }
  })
})
