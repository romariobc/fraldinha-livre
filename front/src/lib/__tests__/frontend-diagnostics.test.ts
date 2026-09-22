import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  diagnoseError,
  logFrontendDiagnostic,
  showErrorToast,
  copySupportCode,
  DiagnosticResult,
} from '../frontend-diagnostics'
import { ApiError, NetworkError } from '../api-client'
import {
  InsufficientStockError,
  OrderCancelNotAllowedError,
  OrderForbiddenError,
  OrderNotFoundError,
} from '../ports/order-repository'
import {
  ProductForbiddenError,
  ProductNotFoundError,
} from '../ports/product-repository'
import { toast } from 'sonner'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Frontend Diagnostics (OBS-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Classificação e Extração: ApiError', () => {
    it('classifica HTTP 500 (INTERNAL_ERROR) preservando requestId e emitindo mensagem amigável sem stack trace', () => {
      const apiErr = new ApiError({
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Database connection failed at SQL server IP 10.0.0.1:5432 with stack trace',
        requestId: 'trace-500-req-uuid',
      })

      const diag = diagnoseError(apiErr, { operation: 'checkout.create_order' })

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('INTERNAL_ERROR')
      expect(diag.status).toBe(500)
      expect(diag.requestId).toBe('trace-500-req-uuid')
      expect(diag.recoverable).toBe(true)
      // Mensagem de UX deve ser amigável e NUNCA conter o texto do banco/stack trace
      expect(diag.message).toBe('Não foi possível concluir esta operação agora. Tente novamente em instantes.')
      expect(diag.message).not.toContain('10.0.0.1')
      expect(diag.message).not.toContain('SQL')
    })

    it('classifica falha de provedores externos (AI_PROVIDER_ERROR / 502) com mensagem de indisponibilidade temporária', () => {
      const apiErr = new ApiError({
        code: 'AI_PROVIDER_ERROR',
        status: 502,
        message: 'Cloudflare Workers AI timeout',
        requestId: 'ai-req-123',
      })

      const diag = diagnoseError(apiErr, { operation: 'chat.message' })

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('AI_PROVIDER_ERROR')
      expect(diag.status).toBe(502)
      expect(diag.message).toBe('O serviço está temporariamente indisponível. Tente novamente em instantes.')
    })

    it('classifica 401 UNAUTHORIZED com mensagem de sessão expirada', () => {
      const apiErr = new ApiError({
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Token expirado',
        requestId: 'auth-req-401',
      })

      const diag = diagnoseError(apiErr)

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('UNAUTHORIZED')
      expect(diag.status).toBe(401)
      expect(diag.message).toBe('Sua sessão expirou ou requer autenticação para continuar.')
      expect(diag.recoverable).toBe(true)
    })

    it('classifica 403 FORBIDDEN com mensagem de permissão negada', () => {
      const apiErr = new ApiError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Acesso negado para o recurso',
        requestId: 'auth-req-403',
      })

      const diag = diagnoseError(apiErr)

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('FORBIDDEN')
      expect(diag.status).toBe(403)
      expect(diag.message).toBe('Você não tem permissão para realizar esta ação.')
      expect(diag.recoverable).toBe(false)
    })

    it('classifica 409 AUTHORIZATION_STATE_CONFLICT solicitando novo login', () => {
      const apiErr = new ApiError({
        code: 'AUTHORIZATION_STATE_CONFLICT',
        status: 409,
        message: 'Conflito de papéis',
        requestId: 'conflict-req-409',
      })

      const diag = diagnoseError(apiErr)

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('AUTHORIZATION_STATE_CONFLICT')
      expect(diag.message).toBe('Conflito de credenciais detectado. Por favor, faça login novamente.')
    })

    it('classifica 404 RESOURCE_NOT_FOUND com mensagem amigável', () => {
      const apiErr = new ApiError({
        code: 'RESOURCE_NOT_FOUND',
        status: 404,
        message: 'Resource not found',
        requestId: 'notfound-req',
      })

      const diag = diagnoseError(apiErr)

      expect(diag.kind).toBe('api')
      expect(diag.code).toBe('RESOURCE_NOT_FOUND')
      expect(diag.message).toBe('Item ou recurso solicitado não foi encontrado.')
    })

    it('ignora requestId se for a string "unknown"', () => {
      const apiErr = new ApiError({
        code: 'INVALID_REQUEST',
        status: 400,
        message: 'Erro',
        requestId: 'unknown',
      })

      const diag = diagnoseError(apiErr)

      expect(diag.requestId).toBeUndefined()
    })
  })

  describe('2. Classificação: Falha de Transporte / NetworkError', () => {
    it('classifica NetworkError como kind network e NUNCA inventa backend requestId', () => {
      const netErr = new NetworkError('Falha de conexão com a rede')

      const diag = diagnoseError(netErr, { operation: 'checkout.create_order' })

      expect(diag.kind).toBe('network')
      expect(diag.code).toBe('NETWORK_ERROR')
      expect(diag.message).toBe('Falha de conexão com a rede. Verifique sua internet e tente novamente.')
      expect(diag.requestId).toBeUndefined() // Invariante crucial: não inventa backend correlation ID
      expect(diag.status).toBeUndefined()
      expect(diag.recoverable).toBe(true)
    })
  })

  describe('3. Classificação: Erros de Domínio (Domain Errors)', () => {
    it('classifica InsufficientStockError preservando requestId quando presente e mantendo mensagem de estoque', () => {
      const stockErr = new InsufficientStockError('Outro cliente finalizou antes.', {
        requestId: 'stock-req-789',
        cause: new Error('internal cause'),
      })

      const diag = diagnoseError(stockErr)

      expect(diag.kind).toBe('domain')
      expect(diag.code).toBe('INSUFFICIENT_STOCK')
      expect(diag.message).toBe('Outro cliente finalizou antes.')
      expect(diag.requestId).toBe('stock-req-789')
      expect(diag.recoverable).toBe(true)
      // Garante que o cause interno NUNCA entre na mensagem de UX
      expect(diag.message).not.toContain('internal cause')
    })

    it('classifica OrderCancelNotAllowedError com mensagem de trava de processamento', () => {
      const cancelErr = new OrderCancelNotAllowedError('ord-1', 'a-caminho')

      const diag = diagnoseError(cancelErr)

      expect(diag.kind).toBe('domain')
      expect(diag.code).toBe('ORDER_NOT_AWAITING')
      expect(diag.message).toBe('Não é possível cancelar um pedido que já está em processamento ou envio.')
      expect(diag.recoverable).toBe(false)
    })

    it('classifica OrderNotFoundError com mensagem amigável', () => {
      const notFound = new OrderNotFoundError('ord-999')

      const diag = diagnoseError(notFound)

      expect(diag.kind).toBe('domain')
      expect(diag.code).toBe('ORDER_NOT_FOUND')
      expect(diag.message).toBe('Pedido não encontrado.')
    })

    it('classifica OrderForbiddenError e ProductForbiddenError com mensagem de permissão', () => {
      const ordForb = new OrderForbiddenError('ord-1')
      const prodForb = new ProductForbiddenError('prod-1')

      expect(diagnoseError(ordForb).message).toBe('Você não tem permissão para modificar este item.')
      expect(diagnoseError(prodForb).message).toBe('Você não tem permissão para modificar este item.')
    })

    it('classifica ProductNotFoundError com mensagem amigável', () => {
      const prodNotFound = new ProductNotFoundError('prod-999')

      const diag = diagnoseError(prodNotFound)

      expect(diag.kind).toBe('domain')
      expect(diag.code).toBe('PRODUCT_NOT_FOUND')
      expect(diag.message).toBe('Produto não encontrado no catálogo.')
    })
  })

  describe('4. Classificação: Validation Error', () => {
    it('classifica erro Zod como kind validation sem vazar detalhes internos de schema', () => {
      const zodError = {
        name: 'ZodError',
        issues: [{ path: ['email'], message: 'Invalid email' }],
      }

      const diag = diagnoseError(zodError)

      expect(diag.kind).toBe('validation')
      expect(diag.code).toBe('VALIDATION_ERROR')
      expect(diag.message).toBe('Os dados fornecidos estão incompletos ou em formato inválido.')
      expect(diag.requestId).toBeUndefined()
      expect(diag.recoverable).toBe(true)
    })
  })

  describe('5. Classificação: Unexpected Error e Fallbacks', () => {
    it('classifica erro inesperado com fallback seguro', () => {
      const rawError = new Error('Random unexpected client crash')

      const diag = diagnoseError(rawError)

      expect(diag.kind).toBe('unexpected')
      expect(diag.code).toBe('UNEXPECTED_ERROR')
      expect(diag.message).toBe('Ocorreu um erro inesperado. Tente novamente em instantes.')
      expect(diag.recoverable).toBe(true)
    })

    it('desempacota requestId de ApiError quando encapsulado como cause interno de um Error genérico', () => {
      const causeApiError = new ApiError({
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Server error',
        requestId: 'nested-req-cause-123',
      })
      const wrapperError = new Error('Failed to create order: HTTP 500', { cause: causeApiError })

      const diag = diagnoseError(wrapperError)

      expect(diag.kind).toBe('unexpected')
      expect(diag.requestId).toBe('nested-req-cause-123')
    })

    it('trata valores não-objetos (string, null, undefined) com segurança sem lançar exceção', () => {
      expect(diagnoseError('falha em string').kind).toBe('unexpected')
      expect(diagnoseError(null).kind).toBe('unexpected')
      expect(diagnoseError(undefined).kind).toBe('unexpected')
      expect(diagnoseError(12345).kind).toBe('unexpected')
    })
  })

  describe('6. Logging Seguro e Sanitizado (logFrontendDiagnostic)', () => {
    it('emite JSON estruturado contendo apenas metadados seguros e NUNCA vaza PII', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const sensitiveDiag: DiagnosticResult = {
        kind: 'api',
        code: 'INTERNAL_ERROR',
        message: 'Erro amigável',
        requestId: 'trace-req-safe-123',
        status: 500,
        recoverable: true,
      }

      logFrontendDiagnostic(sensitiveDiag, { operation: 'orders.create' })

      expect(consoleErrorSpy).toHaveBeenCalledOnce()
      const rawLogged = consoleErrorSpy.mock.calls[0][0]
      const parsed = JSON.parse(rawLogged)

      expect(parsed).toEqual({
        event: 'frontend.diagnostic',
        kind: 'api',
        code: 'INTERNAL_ERROR',
        requestId: 'trace-req-safe-123',
        status: 500,
        operation: 'orders.create',
        recoverable: true,
      })

      // Invariantes estritos de segurança: nenhum campo proibido no payload de log
      expect(rawLogged).not.toContain('Bearer')
      expect(rawLogged).not.toContain('password')
      expect(rawLogged).not.toContain('cpf')
      expect(rawLogged).not.toContain('email')
      expect(rawLogged).not.toContain('token')

      consoleErrorSpy.mockRestore()
    })

    it('registra 4xx e erros recuperáveis via console.warn', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const clientDiag: DiagnosticResult = {
        kind: 'api',
        code: 'INVALID_REQUEST',
        message: 'Dados inválidos',
        status: 400,
        recoverable: true,
      }

      logFrontendDiagnostic(clientDiag, { operation: 'form.submit' })

      expect(consoleWarnSpy).toHaveBeenCalledOnce()
      const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0])
      expect(parsed.code).toBe('INVALID_REQUEST')
      expect(parsed.status).toBe(400)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('7. Clipboard e Cópia de Código (copySupportCode)', () => {
    const originalNavigator = globalThis.navigator

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      })
    })

    it('copia código quando clipboard.writeText está disponível', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        configurable: true,
        writable: true,
      })

      const ok = await copySupportCode('req-123-uuid')

      expect(ok).toBe(true)
      expect(writeTextMock).toHaveBeenCalledWith('req-123-uuid')
    })

    it('retorna false sem quebrar se clipboard.writeText rejeitar ou não estiver disponível', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'))
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        configurable: true,
        writable: true,
      })

      const ok = await copySupportCode('req-123-uuid')
      expect(ok).toBe(false)

      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      })
      const okFallback = await copySupportCode('req-123-uuid')
      expect(okFallback).toBe(false)
    })
  })

  describe('8. Integração com Toast (showErrorToast)', () => {
    it('executa diagnóstico, registra log UMA ÚNICA VEZ e exibe toast com código de suporte e ação de copiar', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const apiErr = new ApiError({
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Server error',
        requestId: '550e8400-e29b-41d4-a716-446655440000',
      })

      showErrorToast(apiErr, { operation: 'checkout.create_order' })

      // 1. Log registrado exatamente uma vez
      expect(consoleErrorSpy).toHaveBeenCalledOnce()

      expect(toast.error).toHaveBeenCalledOnce()
      const [toastMsg, toastOptions] = vi.mocked(toast.error).mock.calls[0]

      expect(toastMsg).toBe('Não foi possível concluir esta operação agora. Tente novamente em instantes.')
      expect(toastOptions?.description).toBe('Código de suporte: 550e8400-e29b-41d4-a716-446655440000')
      expect(toastOptions?.action).toEqual(expect.objectContaining({ label: 'Copiar código' }))

      consoleErrorSpy.mockRestore()
    })

    it('exibe mensagem customizada quando informada nas opções', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const netErr = new NetworkError('Transport fail')

      showErrorToast(netErr, {
        operation: 'checkout.retry',
        customMessage: 'Falha ao processar checkout. Verifique sua conexão.',
      })

      expect(toast.error).toHaveBeenCalledWith(
        'Falha ao processar checkout. Verifique sua conexão.',
        expect.objectContaining({
          description: undefined, // Sem requestId para falha de rede
          action: undefined,
        })
      )
    })
  })
})
