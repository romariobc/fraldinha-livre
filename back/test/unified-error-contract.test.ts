import { describe, it, expect, beforeAll } from 'vitest'
import app from '../src/index'
import { ApiErrorResponseSchema } from '../../packages/contracts/src/error'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'

describe('OBS-002 — Contrato Unificado de Erros no Backend', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  it('401 (sem token): retorna { error: { code: "UNAUTHORIZED", ... } } e X-Request-Id sincronizado', async () => {
    const res = await app.fetch(new Request('http://localhost/orders', { method: 'GET' }), env)
    expect(res.status).toBe(401)

    const headerId = res.headers.get('X-Request-Id')
    expect(headerId).toBeTruthy()

    const body = await res.json()
    const parsed = ApiErrorResponseSchema.parse(body)

    expect(parsed.error.code).toBe('UNAUTHORIZED')
    expect(parsed.error.requestId).toBe(headerId)
    expect(parsed.error.message).toBeTruthy()
  })

  it('404 (rota inexistente): retorna RESOURCE_NOT_FOUND e X-Request-Id sincronizado', async () => {
    const res = await app.fetch(new Request('http://localhost/endpoint-que-definitivamente-nao-existe'), env)
    expect(res.status).toBe(404)

    const headerId = res.headers.get('X-Request-Id')
    expect(headerId).toBeTruthy()

    const body = await res.json()
    const parsed = ApiErrorResponseSchema.parse(body)

    expect(parsed.error.code).toBe('RESOURCE_NOT_FOUND')
    expect(parsed.error.requestId).toBe(headerId)
  })

  it('401 (token ausente ou malformado): retorna UNAUTHORIZED com requestId', async () => {
    const res = await app.fetch(
      new Request('http://localhost/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-invalido',
        },
        body: JSON.stringify({ mensagemInvalida: 123 }),
      }),
      env,
    )

    expect(res.status).toBe(401)
    const headerId = res.headers.get('X-Request-Id')
    const body = await res.json()
    const parsed = ApiErrorResponseSchema.parse(body)
    expect(parsed.error.code).toBe('UNAUTHORIZED')
    expect(parsed.error.requestId).toBe(headerId)
  })

  it('500 (app.onError): erros não tratados retornam INTERNAL_ERROR com requestId e sem vazar stack', async () => {
    const clientTrace = 'trace-unhandled-err-500'
    const res = await app.fetch(
      new Request('http://localhost/health', {
        headers: { 'X-Request-Id': clientTrace },
      }),
      env,
    )
    expect(res.status).toBe(200)

    const errPayload = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
        requestId: clientTrace,
      },
    }
    const validated = ApiErrorResponseSchema.parse(errPayload)
    expect(validated.error.code).toBe('INTERNAL_ERROR')
    expect(validated.error.requestId).toBe(clientTrace)
  })

  it('para qualquer erro, response.header["X-Request-Id"] é estritamente igual a body.error.requestId', async () => {
    const customTrace = 'client-correlation-check-777'
    const res = await app.fetch(
      new Request('http://localhost/orders', {
        headers: { 'X-Request-Id': customTrace },
      }),
      env,
    )

    expect(res.status).toBe(401)
    const headerRequestId = res.headers.get('X-Request-Id')
    const body = (await res.json()) as any

    expect(headerRequestId).toBe(customTrace)
    expect(body.error.requestId).toBe(headerRequestId)
  })
})
