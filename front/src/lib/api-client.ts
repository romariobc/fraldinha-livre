import { auth } from '@/lib/firebase'
import type { ApiErrorCode } from '@contracts'
import { ApiErrorResponseSchema, ApiErrorCodeSchema } from '@contracts'

export interface ApiErrorParams {
  code: ApiErrorCode
  status: number
  message: string
  requestId: string
  details?: unknown
}

/**
 * Erro tipado emitido por apiFetch quando uma resposta HTTP não é 2xx (OBS-002).
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode
  public readonly status: number
  public readonly requestId: string
  public readonly details?: unknown

  constructor(params: ApiErrorParams) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.requestId = params.requestId
    this.details = params.details
  }
}

/**
 * Erro explícito de falha de transporte/rede disparado quando a chamada fetch() falha antes de obter resposta HTTP (OBS-004).
 */
export class NetworkError extends Error {
  constructor(message = 'Falha de conexão com a rede. Verifique sua internet e tente novamente.', options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NetworkError'
  }
}

/**
 * Type guard tipado e reutilizável para verificar se um erro é uma instância ou objeto estrutural de ApiError.
 * Valida rigorosamente campos mínimos sem usar any.
 */
export function isApiError(err: unknown): err is ApiError {
  if (err instanceof ApiError) {
    return true
  }
  if (typeof err !== 'object' || err === null) {
    return false
  }
  const candidate = err as Record<string, unknown>
  return (
    candidate.name === 'ApiError' &&
    typeof candidate.status === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.code === 'string' &&
    ApiErrorCodeSchema.safeParse(candidate.code).success
  )
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init.headers)
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', generateRequestId())
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch (err) {
    throw new NetworkError('Falha de conexão com a rede. Verifique sua internet e tente novamente.', { cause: err })
  }

  if (!res.ok) {
    const headerRequestId = res.headers?.get ? res.headers.get('X-Request-Id') : null
    const fallbackRequestId = headerRequestId || headers.get('X-Request-Id') || 'unknown'
    let rawJson: unknown = null

    try {
      rawJson = await res.json()
    } catch {
      // Ignora erro de parse se o backend ou proxy retornar HTML/texto ou body vazio
    }

    const parsed = ApiErrorResponseSchema.safeParse(rawJson)
    if (parsed.success) {
      throw new ApiError({
        code: parsed.data.error.code,
        status: res.status,
        message: parsed.data.error.message,
        requestId: parsed.data.error.requestId || fallbackRequestId,
        details: parsed.data.error.details,
      })
    }

    // Fallback defensivo para compatibilidade com legados ou falhas de infraestrutura (sem any)
    let rawErrorStr: string | null = null
    if (typeof rawJson === 'object' && rawJson !== null && 'error' in rawJson) {
      const legacyError = (rawJson as { error?: unknown }).error
      if (typeof legacyError === 'string') {
        rawErrorStr = legacyError
      }
    }

    const fallbackMessage = rawErrorStr || res.statusText || `Erro na requisição (HTTP ${res.status})`

    const fallbackCode: ApiErrorCode =
      res.status === 401
        ? 'UNAUTHORIZED'
        : res.status === 403
        ? 'FORBIDDEN'
        : res.status === 404
        ? 'RESOURCE_NOT_FOUND'
        : res.status >= 500
        ? 'INTERNAL_ERROR'
        : 'INVALID_REQUEST'

    throw new ApiError({
      code: fallbackCode,
      status: res.status,
      message: fallbackMessage,
      requestId: fallbackRequestId,
    })
  }

  return res
}
