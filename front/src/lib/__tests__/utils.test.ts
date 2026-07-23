/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { isValidCNPJ } from '../utils'

describe('isValidCNPJ', () => {
  it('should accept a valid CNPJ with punctuation', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
  })

  it('should accept a valid CNPJ with only digits', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true)
  })

  it('should reject a CNPJ with wrong check digits', () => {
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
  })

  it('should reject a CNPJ with repeated digits', () => {
    expect(isValidCNPJ('11111111111111')).toBe(false)
  })

  it('should reject a CNPJ with wrong length', () => {
    expect(isValidCNPJ('123')).toBe(false)
  })
})
