import { toast } from 'sonner'
import { isApiError, NetworkError } from '@/lib/api-client'
import {
  InsufficientStockError,
  OrderCancelNotAllowedError,
  OrderForbiddenError,
  OrderNotFoundError,
} from '@/lib/ports/order-repository'
import {
  ProductForbiddenError,
  ProductNotFoundError,
} from '@/lib/ports/product-repository'

export type DiagnosticKind = 'api' | 'domain' | 'validation' | 'network' | 'unexpected'

export interface DiagnosticResult {
  kind: DiagnosticKind
  code: string
  message: string // Mensagem amigável de UX para exibição ao usuário final
  technicalMessage: string // Mensagem técnica sanitizada para diagnóstico
  requestId?: string
  status?: number
  recoverable: boolean
  actionLabel?: string
}

export interface DiagnosticContext {
  operation?: string
  [key: string]: unknown
}

export interface ToastDiagnosticOptions extends DiagnosticContext {
  customMessage?: string
  duration?: number
}

/**
 * Copia o código de suporte/Request ID para a área de transferência com fallback defensivo.
 */
export async function copySupportCode(code: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(code)
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Extrai de forma pura e segura a classificação e os metadados de diagnóstico de qualquer erro.
 * Nunca vaza PII, tokens ou schemas internos nas mensagens de UX.
 */
export function diagnoseError(err: unknown, context?: DiagnosticContext): DiagnosticResult {
  // 1. ApiError (erro HTTP estruturado do backend)
  if (isApiError(err)) {
    const requestId = err.requestId && err.requestId !== 'unknown' ? err.requestId : undefined
    let message = 'Não foi possível concluir a operação. Verifique os dados e tente novamente.'
    let recoverable = false

    if (err.status >= 500) {
      recoverable = true
      if (err.code === 'AI_PROVIDER_ERROR' || err.code.startsWith('AUTH_PROVIDER_')) {
        message = 'O serviço está temporariamente indisponível. Tente novamente em instantes.'
      } else {
        message = 'Não foi possível concluir esta operação agora. Tente novamente em instantes.'
      }
    } else if (err.status === 401 || err.code === 'UNAUTHORIZED') {
      message = 'Sua sessão expirou ou requer autenticação para continuar.'
      recoverable = true
    } else if (err.status === 403 || err.code === 'FORBIDDEN') {
      message = 'Você não tem permissão para realizar esta ação.'
      recoverable = false
    } else if (err.code === 'AUTHORIZATION_STATE_CONFLICT') {
      message = 'Conflito de credenciais detectado. Por favor, faça login novamente.'
      recoverable = true
    } else if (err.code === 'INSUFFICIENT_STOCK') {
      message = 'Estoque insuficiente para um ou mais itens selecionados.'
      recoverable = true
    } else if (err.code === 'ORDER_NOT_AWAITING') {
      message = 'Este pedido já está em processamento e não pode ser alterado.'
      recoverable = false
    } else if (
      err.code === 'ORDER_NOT_FOUND' ||
      err.code === 'PRODUCT_NOT_FOUND' ||
      err.code === 'RESOURCE_NOT_FOUND'
    ) {
      message = 'Item ou recurso solicitado não foi encontrado.'
      recoverable = false
    } else if (err.code === 'IDEMPOTENCY_KEY_REQUIRED' || err.code === 'IDEMPOTENCY_CONFLICT') {
      message = 'Esta operação já foi solicitada ou está em processamento.'
      recoverable = true
    } else if (err.code === 'PRICE_MISMATCH' || err.code === 'TOTAL_MISMATCH' || err.code === 'SUPPLIER_MISMATCH') {
      message = 'Houve divergência nos valores ou itens do pedido. Revise sua sacola.'
      recoverable = true
    } else if (err.code === 'INVALID_REQUEST') {
      message = 'Dados da requisição inválidos. Por favor, revise as informações.'
      recoverable = true
    }

    return {
      kind: 'api',
      code: err.code,
      message,
      technicalMessage: err.message,
      requestId,
      status: err.status,
      recoverable,
    }
  }

  // 2. NetworkError (falha explícita de rede/transporte antes de resposta HTTP)
  if (err instanceof NetworkError || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'NetworkError')) {
    return {
      kind: 'network',
      code: 'NETWORK_ERROR',
      message: 'Falha de conexão com a rede. Verifique sua internet e tente novamente.',
      technicalMessage: err instanceof Error ? err.message : 'Network transport failure',
      requestId: undefined, // Nunca inventa requestId de backend para falha de transporte
      status: undefined,
      recoverable: true,
    }
  }

  // 3. Domain Errors (erros tipados das portas de domínio)
  const isDomainError =
    err instanceof InsufficientStockError ||
    err instanceof OrderCancelNotAllowedError ||
    err instanceof OrderForbiddenError ||
    err instanceof OrderNotFoundError ||
    err instanceof ProductNotFoundError ||
    err instanceof ProductForbiddenError ||
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as { code?: unknown }).code === 'string' &&
      ['INSUFFICIENT_STOCK', 'ORDER_NOT_AWAITING', 'ORDER_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'FORBIDDEN'].includes(
        (err as { code: string }).code,
      ))

  if (isDomainError) {
    const code = (err as { code: string }).code
    const candidateReqId = (err as { requestId?: unknown }).requestId
    const requestId = typeof candidateReqId === 'string' && candidateReqId !== 'unknown' ? candidateReqId : undefined

    let message = (err as Error).message || 'Regra de negócio não atendida.'
    let recoverable = false

    if (code === 'INSUFFICIENT_STOCK') {
      message = (err as Error).message || 'Estoque insuficiente no momento da finalização.'
      recoverable = true
    } else if (code === 'ORDER_NOT_AWAITING') {
      message = 'Não é possível cancelar um pedido que já está em processamento ou envio.'
      recoverable = false
    } else if (code === 'ORDER_NOT_FOUND') {
      message = 'Pedido não encontrado.'
      recoverable = false
    } else if (code === 'PRODUCT_NOT_FOUND') {
      message = 'Produto não encontrado no catálogo.'
      recoverable = false
    } else if (code === 'FORBIDDEN') {
      message = 'Você não tem permissão para modificar este item.'
      recoverable = false
    }

    return {
      kind: 'domain',
      code,
      message,
      technicalMessage: (err as Error).message || code,
      requestId,
      recoverable,
    }
  }

  // 4. Validation Error (ex: ZodError)
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ZodError') {
    return {
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Os dados fornecidos estão incompletos ou em formato inválido.',
      technicalMessage: 'Zod schema validation failed',
      requestId: undefined,
      recoverable: true,
    }
  }

  // 5. Unexpected Error (inspeciona apenas se há requestId encapsulado em cause interno de ApiError)
  let extractedRequestId: string | undefined
  if (typeof err === 'object' && err !== null && 'cause' in err) {
    const innerCause = (err as { cause?: unknown }).cause
    if (isApiError(innerCause) && innerCause.requestId && innerCause.requestId !== 'unknown') {
      extractedRequestId = innerCause.requestId
    }
  }

  return {
    kind: 'unexpected',
    code: 'UNEXPECTED_ERROR',
    message: 'Ocorreu um erro inesperado. Tente novamente em instantes.',
    technicalMessage: err instanceof Error ? err.message : 'Unexpected runtime error',
    requestId: extractedRequestId,
    recoverable: true,
  }
}

/**
 * Registra o diagnóstico estruturado e higienizado no console.
 * Recebe ESTRITAMENTE o DiagnosticResult já sanitizado, garantindo zero vazamento de PII.
 */
export function logFrontendDiagnostic(diag: DiagnosticResult, context?: DiagnosticContext): void {
  const payload = {
    event: 'frontend.diagnostic',
    kind: diag.kind,
    code: diag.code,
    requestId: diag.requestId,
    status: diag.status,
    operation: context?.operation,
    recoverable: diag.recoverable,
  }

  if (diag.status && diag.status >= 500) {
    console.error(JSON.stringify(payload))
  } else if (diag.kind === 'unexpected') {
    console.error(JSON.stringify(payload))
  } else {
    console.warn(JSON.stringify(payload))
  }
}

/**
 * Exibe um toast de erro padronizado (via sonner), executa o logging estruturado UMA ÚNICA VEZ
 * e adiciona suporte à cópia do Request ID quando aplicável.
 */
export function showErrorToast(error: unknown, options?: ToastDiagnosticOptions): DiagnosticResult {
  const diag = diagnoseError(error, options)

  // Registra o log centralizado uma única vez (evita duplicidade pelo caller)
  logFrontendDiagnostic(diag, options)

  const toastMessage = options?.customMessage || diag.message
  const hasSupportCode = Boolean(diag.requestId)

  toast.error(toastMessage, {
    description: hasSupportCode ? `Código de suporte: ${diag.requestId}` : undefined,
    duration: options?.duration ?? 6000,
    action: hasSupportCode
      ? {
          label: 'Copiar código',
          onClick: () => {
            void copySupportCode(diag.requestId!).then((copied) => {
              if (copied) {
                toast.success('Código de suporte copiado!')
              }
            })
          },
        }
      : undefined,
  })

  return diag
}
