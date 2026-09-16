import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'
import { sanitizeRequestId, resolveRequestId, logger } from '../src/lib/logger'

describe('OBS-001B — Request ID e Structured Logging', () => {
  describe('1. Sanitização e Resolução de Request ID', () => {
    it('preserva ID válido alfanumérico com hífens e underscores', () => {
      const validId = 'req-client-123_abc.test'
      expect(sanitizeRequestId(validId)).toBe(validId)
      expect(resolveRequestId(validId)).toBe(validId)
    })

    it('rejeita ID com caracteres de injeção, espaços ou newlines e gera novo UUID', () => {
      const invalidIds = [
        'req-id\r\nInjected-Header: evil',
        'req id with spaces',
        'req<script>alert(1)</script>',
        'a'.repeat(65), // excede limite de 64 chars
        '',
      ]

      for (const invalid of invalidIds) {
        expect(sanitizeRequestId(invalid)).toBeNull()
        const resolved = resolveRequestId(invalid)
        expect(resolved).not.toBe(invalid)
        // Deve ser um UUID v4 válido gerado nativamente
        expect(resolved).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      }
    })

    it('gera novo UUID quando nenhum header for enviado', () => {
      const resolved = resolveRequestId(null)
      expect(resolved).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })
  })

  describe('2. Header X-Request-Id nas Respostas HTTP', () => {
    it('retorna X-Request-Id gerado em resposta 200 pública (GET /health)', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const headerId = res.headers.get('X-Request-Id')
      expect(headerId).toBeTruthy()
      expect(headerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('preserva o X-Request-Id válido enviado pelo cliente', async () => {
      const clientId = 'client-trace-777-uuid'
      const res = await app.request('/health', {
        headers: {
          'X-Request-Id': clientId,
        },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-Id')).toBe(clientId)
    })

    it('substitui X-Request-Id malicioso enviado pelo cliente por um ID seguro', async () => {
      const badId = 'evil<script>alert(1)</script>'
      const res = await app.request('/health', {
        headers: {
          'X-Request-Id': badId,
        },
      })
      expect(res.status).toBe(200)
      const returnedId = res.headers.get('X-Request-Id')
      expect(returnedId).toBeTruthy()
      expect(returnedId).not.toBe(badId)
      expect(returnedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('devolve X-Request-Id em respostas de erro 401 (não autenticado)', async () => {
      const res = await app.request('/orders')
      expect(res.status).toBe(401)
      expect(res.headers.get('X-Request-Id')).toBeTruthy()
    })

    it('devolve X-Request-Id em respostas de erro 404 (rota inexistente)', async () => {
      const res = await app.request('/rota-que-nao-existe')
      expect(res.status).toBe(404)
      expect(res.headers.get('X-Request-Id')).toBeTruthy()
    })
  })

  describe('3. Configuração de CORS para Observabilidade', () => {
    it('inclui X-Request-Id em Access-Control-Allow-Headers e Access-Control-Expose-Headers no preflight OPTIONS', async () => {
      const res = await app.request('/orders', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization, Content-Type, X-Request-Id',
        },
      })

      const allowHeaders = res.headers.get('Access-Control-Allow-Headers') || ''
      const exposeHeaders = res.headers.get('Access-Control-Expose-Headers') || ''

      expect(allowHeaders).toContain('X-Request-Id')
      expect(exposeHeaders).toContain('X-Request-Id')
    })
  })

  describe('4. Structured Logger e Invariantes de Segurança', () => {
    it('emite JSON estruturado com campos obrigatórios e sem vazar tokens', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const secretToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.sensivel'

      logger.info('trace-123', 'order.test_event', {
        orderId: 'ord-456',
        itemCount: 3,
      })

      expect(logSpy).toHaveBeenCalledOnce()
      const rawLog = logSpy.mock.calls[0][0]
      const payload = JSON.parse(rawLog)

      expect(payload).toHaveProperty('level', 'info')
      expect(payload).toHaveProperty('event', 'order.test_event')
      expect(payload).toHaveProperty('requestId', 'trace-123')
      expect(payload).toHaveProperty('timestamp')
      expect(payload).toHaveProperty('orderId', 'ord-456')
      expect(payload).toHaveProperty('itemCount', 3)

      // Invariante: não pode conter token/segredo
      expect(rawLog).not.toContain(secretToken)

      logSpy.mockRestore()
    })

    it('registra evento http.request.completed no término da requisição com duração e status', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const clientTrace = 'req-trace-lifecycle-999'

      const res = await app.request('/health', {
        headers: { 'X-Request-Id': clientTrace },
      })
      expect(res.status).toBe(200)

      expect(logSpy).toHaveBeenCalled()
      const calls = logSpy.mock.calls.map((c) => JSON.parse(c[0]))
      const lifecycleLog = calls.find((c) => c.event === 'http.request.completed')

      expect(lifecycleLog).toBeDefined()
      expect(lifecycleLog.requestId).toBe(clientTrace)
      expect(lifecycleLog.method).toBe('GET')
      expect(lifecycleLog.path).toBe('/health')
      expect(lifecycleLog.status).toBe(200)
      expect(typeof lifecycleLog.durationMs).toBe('number')

      logSpy.mockRestore()
    })
  })
})
