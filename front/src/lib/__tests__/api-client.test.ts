import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError, isApiError } from '../api-client'

describe('apiFetch (OBS-001B + OBS-002)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('Request ID (OBS-001B)', () => {
    it('injeta X-Request-Id automaticamente na requisição', async () => {
      await apiFetch('/test-endpoint')

      expect(globalThis.fetch).toHaveBeenCalledOnce()
      const [, init] = (globalThis.fetch as any).mock.calls[0]
      const headers = init.headers as Headers

      expect(headers.has('X-Request-Id')).toBe(true)
      const requestId = headers.get('X-Request-Id')
      expect(requestId).toBeTruthy()
      expect(requestId!.length).toBeGreaterThan(5)
    })

    it('preserva X-Request-Id se já tiver sido fornecido no init', async () => {
      const customId = 'custom-trace-uuid-123'
      await apiFetch('/test-endpoint', {
        headers: {
          'X-Request-Id': customId,
        },
      })

      const [, init] = (globalThis.fetch as any).mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('X-Request-Id')).toBe(customId)
    })
  })

  describe('Contrato Unificado de Erros (OBS-002)', () => {
    it('parseia erro padronizado da API e lança ApiError com code, status, message, requestId e details', async () => {
      const errorPayload = {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Estoque insuficiente para finalizar o pedido.',
          requestId: 'trace-req-409-xyz',
          details: [{ productId: 'prod-123', requested: 5, available: 2 }],
        },
      }

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(errorPayload), {
          status: 409,
          headers: { 'X-Request-Id': 'trace-req-409-xyz', 'Content-Type': 'application/json' },
        })
      )

      try {
        await apiFetch('/orders')
        expect.unreachable('Deveria ter lançado ApiError')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.name).toBe('ApiError')
        expect(apiErr.code).toBe('INSUFFICIENT_STOCK')
        expect(apiErr.status).toBe(409)
        expect(apiErr.message).toBe('Estoque insuficiente para finalizar o pedido.')
        expect(apiErr.requestId).toBe('trace-req-409-xyz')
        expect(apiErr.details).toEqual([{ productId: 'prod-123', requested: 5, available: 2 }])
      }
    })

    it('parseia erro de validação INVALID_REQUEST (400) com details das issues', async () => {
      const errorPayload = {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Requisição inválida.',
          requestId: 'trace-val-400',
          details: [{ path: ['price'], code: 'too_small', message: 'Preço deve ser positivo' }],
        },
      }

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(errorPayload), {
          status: 400,
          headers: { 'X-Request-Id': 'trace-val-400', 'Content-Type': 'application/json' },
        })
      )

      await expect(apiFetch('/orders')).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        status: 400,
        message: 'Requisição inválida.',
        requestId: 'trace-val-400',
      })
    })

    it('aplica fallback seguro quando o backend ou proxy retornar HTML 502 sem quebrar a aplicação', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<html><body>502 Bad Gateway - Cloudflare</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'X-Request-Id': 'cf-edge-error-999', 'Content-Type': 'text/html' },
        })
      )

      try {
        await apiFetch('/external-service')
        expect.unreachable('Deveria ter lançado ApiError')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.code).toBe('INTERNAL_ERROR')
        expect(apiErr.status).toBe(502)
        expect(apiErr.message).toContain('Bad Gateway')
        expect(apiErr.requestId).toBe('cf-edge-error-999')
      }
    })

    it('aplica fallback seguro quando backend legar retornar { error: "mensagem" } antiga', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'X-Request-Id': 'legacy-auth-trace' },
        })
      )

      try {
        await apiFetch('/protected')
        expect.unreachable('Deveria ter lançado ApiError')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.code).toBe('UNAUTHORIZED')
        expect(apiErr.status).toBe(401)
        expect(apiErr.message).toBe('unauthorized')
        expect(apiErr.requestId).toBe('legacy-auth-trace')
      }
    })

    it('isApiError type guard identifica instâncias reais e objetos com formato de ApiError', () => {
      const realError = new ApiError({
        code: 'INSUFFICIENT_STOCK',
        status: 409,
        message: 'Sem estoque',
        requestId: 'req-test-guard',
      })
      const regularError = new Error('Erro genérico')
      const fakeError = { name: 'ApiError', code: 'FORBIDDEN' }
      const primitive = 'string error'

      expect(isApiError(realError)).toBe(true)
      expect(isApiError(fakeError)).toBe(true)
      expect(isApiError(regularError)).toBe(false)
      expect(isApiError(primitive)).toBe(false)
      expect(isApiError(null)).toBe(false)
    })
  })
})
