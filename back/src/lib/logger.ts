import type { Context } from 'hono'
import type { Env, AppContext } from '../env'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface StructuredLogPayload {
  level: LogLevel
  event: string
  requestId: string
  timestamp: string
  [key: string]: unknown
}

/**
 * Validador estrito de X-Request-Id enviado pelo cliente:
 * - Apenas caracteres alfanuméricos, hífens, underscores e pontos.
 * - Comprimento entre 1 e 64 caracteres.
 * - Rejeita caracteres de controle, espaços e newlines para prevenir log injection.
 */
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/

export function sanitizeRequestId(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (REQUEST_ID_REGEX.test(trimmed)) {
    return trimmed
  }
  return null
}

export function resolveRequestId(raw?: string | null): string {
  const sanitized = sanitizeRequestId(raw)
  if (sanitized) return sanitized
  return crypto.randomUUID()
}

type HonoContext = Context<{ Bindings: Env; Variables: AppContext['Variables'] }>

export function emitStructuredLog(
  level: LogLevel,
  event: string,
  requestId: string,
  meta?: Record<string, unknown>,
): void {
  const payload: StructuredLogPayload = {
    level,
    event,
    requestId: requestId || 'unknown',
    timestamp: new Date().toISOString(),
    ...meta,
  }

  const serialized = JSON.stringify(payload)

  switch (level) {
    case 'error':
      console.error(serialized)
      break
    case 'warn':
      console.warn(serialized)
      break
    case 'debug':
    case 'info':
    default:
      console.log(serialized)
      break
  }
}

function extractRequestId(target: HonoContext | string | undefined | null): string {
  if (!target) return 'unknown'
  if (typeof target === 'string') return target
  try {
    return target.get('requestId') || 'unknown'
  } catch {
    return 'unknown'
  }
}

export const logger = {
  info(target: HonoContext | string | undefined | null, event: string, meta?: Record<string, unknown>): void {
    emitStructuredLog('info', event, extractRequestId(target), meta)
  },
  warn(target: HonoContext | string | undefined | null, event: string, meta?: Record<string, unknown>): void {
    emitStructuredLog('warn', event, extractRequestId(target), meta)
  },
  error(target: HonoContext | string | undefined | null, event: string, meta?: Record<string, unknown>): void {
    emitStructuredLog('error', event, extractRequestId(target), meta)
  },
  debug(target: HonoContext | string | undefined | null, event: string, meta?: Record<string, unknown>): void {
    emitStructuredLog('debug', event, extractRequestId(target), meta)
  },
}
