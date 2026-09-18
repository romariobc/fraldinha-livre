import { describe, it, expect } from 'vitest'
import {
  ApiErrorCodeSchema,
  ApiErrorResponseSchema,
  ApiErrorSchema,
} from '../error'

describe('ApiError Contracts (OBS-002)', () => {
  it('valida códigos de erro permitidos pela taxonomia', () => {
    const validCodes = [
      'INVALID_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'RESOURCE_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'INSUFFICIENT_STOCK',
      'IDEMPOTENCY_KEY_REQUIRED',
      'PRICE_MISMATCH',
      'SUPPLIER_MISMATCH',
      'TOTAL_MISMATCH',
      'ORDER_NOT_AWAITING',
      'AUTHORIZATION_STATE_CONFLICT',
      'ROLE_CHANGE_NOT_ALLOWED',
      'AUTH_PROVIDER_NOT_CONFIGURED',
      'AUTH_PROVIDER_LOOKUP_FAILED',
      'AUTH_PROVIDER_UPDATE_FAILED',
      'AI_PROVIDER_ERROR',
      'INTERNAL_ERROR',
    ]

    for (const code of validCodes) {
      expect(ApiErrorCodeSchema.parse(code)).toBe(code)
    }
  })

  it('rejeita códigos de erro arbitrários ou inválidos', () => {
    const invalidCodes = ['SOMETHING_WENT_WRONG', 'UNKNOWN_ERROR', '404', 'random_code', '']

    for (const code of invalidCodes) {
      expect(() => ApiErrorCodeSchema.parse(code)).toThrow()
    }
  })

  it('valida payload completo de erro com details opcional', () => {
    const payloadWithDetails = {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Payload inválido enviado pelo cliente.',
        requestId: 'req-test-12345',
        details: [
          {
            path: ['quantity'],
            code: 'too_small',
            message: 'Quantidade deve ser maior que zero',
          },
        ],
      },
    }

    const parsed = ApiErrorResponseSchema.parse(payloadWithDetails)
    expect(parsed.error.code).toBe('INVALID_REQUEST')
    expect(parsed.error.requestId).toBe('req-test-12345')
    expect(Array.isArray(parsed.error.details)).toBe(true)

    const payloadWithoutDetails = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Credenciais ausentes.',
        requestId: 'req-auth-999',
      },
    }

    const parsedWithoutDetails = ApiErrorResponseSchema.parse(payloadWithoutDetails)
    expect(parsedWithoutDetails.error.code).toBe('UNAUTHORIZED')
    expect(parsedWithoutDetails.error.details).toBeUndefined()
  })

  it('rejeita payloads sem requestId ou sem message', () => {
    const missingRequestId = {
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso negado',
      },
    }
    expect(() => ApiErrorResponseSchema.parse(missingRequestId)).toThrow()

    const missingMessage = {
      error: {
        code: 'FORBIDDEN',
        requestId: 'req-123',
      },
    }
    expect(() => ApiErrorResponseSchema.parse(missingMessage)).toThrow()

    const invalidStructure = {
      errorMessage: 'Algum erro',
    }
    expect(() => ApiErrorResponseSchema.parse(invalidStructure)).toThrow()
  })
})
