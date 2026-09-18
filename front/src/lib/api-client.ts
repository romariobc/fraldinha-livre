import { auth } from '@/lib/firebase'
import type { ApiErrorCode } from '@contracts'
import { ApiErrorResponseSchema } from '@contracts'

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
 * Type guard tipado e reutilizável para verificar se um erro é uma instância de ApiError.
 */
export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError ||
    (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'ApiError')
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

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

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

    // Fallback defensivo para compatibilidade com legados ou falhas de infraestrutura
    const rawErrorStr =
      typeof rawJson === 'object' && rawJson !== null && 'error' in rawJson && typeof (rawJson as any).error === 'string'
        ? (rawJson as any).error
        : null

    const fallbackMessage = rawErrorStr || res.statusText || `Erro na requisição (HTTP ${res.status})`

    const fallbackCode: ApiErrorCode =
      res.status === 401
        ? 'UNAUTHORIZED'
        : res.status === 403
        ? 'FORBIDDEN'
        : res.status === 404
        ? 'RESOURCE_NOT_FOUND'
        : res.status === 409
        ? 'INSUFFICIENT_STOCK'
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
