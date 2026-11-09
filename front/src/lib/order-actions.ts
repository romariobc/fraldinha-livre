import type { OrderStatus } from '@contracts'
export type OrderActor = { uid: string; role: string | null } | null
export function canManageOrder(order: { supplierId?: string; uid?: string }, actor: OrderActor, scope: 'comprador' | 'fornecedor' | 'admin') {
  if (!actor || actor.role !== scope) return false
  if (scope === 'admin') return true
  // Missing ownership is supported only for legacy snapshots returned in the authorized list.
  return scope === 'comprador' ? !order.uid || order.uid === actor.uid : !order.supplierId || order.supplierId === actor.uid
}
export function allowedOrderTargets(status: string, role: string): OrderStatus[] {
  if (role === 'comprador') return status === 'aguardando' ? ['cancelado'] : []
  if (role === 'admin') return ['aguardando', 'confirmado'].includes(status) ? ['cancelado'] : []
  if (role !== 'fornecedor') return []
  if (status === 'aguardando') return ['confirmado', 'cancelado']
  if (status === 'confirmado') return ['a-caminho', 'cancelado']
  return status === 'a-caminho' ? ['entregue'] : []
}
export function orderOperationError(error: unknown) {
  let current: unknown = error
  let requestId: string | undefined
  let code: string | undefined
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    const value = current as { code?: string; requestId?: string; cause?: unknown }
    requestId ||= value.requestId && value.requestId !== 'unknown' ? value.requestId : undefined
    code ||= value.code
    current = value.cause
  }
  const conflict = ['ORDER_NOT_AWAITING', 'ORDER_STATUS_NOT_ALLOWED'].includes(code ?? '')
  const message = conflict ? 'O pedido foi alterado por outra operação ou esta ação não está mais disponível. Consulte o estado atualizado antes de continuar.'
    : code === 'FORBIDDEN' || code === 'UNAUTHORIZED' ? 'Sua conta não pode realizar esta ação. Confira sua sessão e atualize o pedido.'
    : code === 'ORDER_NOT_FOUND' ? 'O pedido não foi encontrado. Atualize a lista antes de continuar.'
    : 'Não foi possível confirmar a operação. Confira o estado atualizado do pedido antes de tentar novamente.'
  return { message, requestId }
}
