import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import type { ApiErrorCode, ApiErrorResponse, ApiErrorDetails } from '../../../packages/contracts/src/error'
import type { Env, AppContext } from '../env'

export interface AppErrorParams {
  code: ApiErrorCode
  status: ContentfulStatusCode
  message: string
  details?: ApiErrorDetails
  cause?: unknown
}

/**
 * Classe padronizada para erros esperados da aplicação (OBS-002).
 * Desacopla status HTTP, código semântico estável (machine-readable) e mensagem amigável.
 */
export class AppError extends Error {
  public readonly code: ApiErrorCode
  public readonly status: ContentfulStatusCode
  public readonly details?: ApiErrorDetails
  public readonly cause?: unknown

  constructor(params: AppErrorParams) {
    super(params.message)
    this.name = 'AppError'
    this.code = params.code
    this.status = params.status
    this.details = params.details
    if (params.cause) {
      this.cause = params.cause
    }
  }

  toResponse(requestId: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    }
  }
}

/**
 * Helper para extrair issues de validação do Zod em estrutura padronizada e segura (sem PII/request body).
 */
export function formatZodIssues(error: ZodError): Array<{ path: (string | number)[]; code: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }))
}

type HonoContext = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>

/**
 * Emite uma resposta JSON padronizada com cabeçalho e corpo contendo o mesmo requestId correlacionado.
 */
export function sendAppError(c: HonoContext, error: AppError) {
  const requestId = c.get('requestId') || 'unknown'
  if (!c.res.headers.has('X-Request-Id') && requestId !== 'unknown') {
    c.res.headers.set('X-Request-Id', requestId)
  }
  return c.json(error.toResponse(requestId), error.status)
}

/**
 * Atalho declarativo para responder erros HTTP no padrão unificado.
 */
export function respondError(
  c: HonoContext,
  code: ApiErrorCode,
  status: ContentfulStatusCode,
  message: string,
  details?: ApiErrorDetails,
) {
  return sendAppError(c, new AppError({ code, status, message, details }))
}

/**
 * Atalho específico para responder erros de validação Zod.
 */
export function respondZodError(c: HonoContext, error: ZodError, message = 'Requisição inválida.') {
  return respondError(c, 'INVALID_REQUEST', 400, message, formatZodIssues(error))
}
