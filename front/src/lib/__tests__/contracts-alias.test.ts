import { describe, it, expect } from 'vitest'
import { AddressSchema } from '@contracts'

describe('alias @contracts resolve a partir do front', () => {
  it('importa e valida um endereco', () => {
    const result = AddressSchema.safeParse({
      logradouro: 'Rua X', numero: '1', bairro: 'Centro',
      cidade: 'Sao Paulo', estado: 'SP', cep: '01000-000',
    })
    expect(result.success).toBe(true)
  })
})
