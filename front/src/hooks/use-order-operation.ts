'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { orderOperationError } from '@/lib/order-actions'

/** Serialize actions in this controller, keep error evidence and reconcile after success/failure. */
export function useOrderOperation(owner: string | null) {
  const scope = useRef({ owner, active: true, busy: false })
  const [state, setState] = useState<{ owner: string | null; id: string | null; error: string | null; revision: number }>({ owner: null, id: null, error: null, revision: 0 })
  useEffect(() => { const current = { owner, active: true, busy: false }; scope.current = current; return () => { current.active = false } }, [owner])
  const run = useCallback(async (id: string, operation: () => Promise<unknown>, refresh: () => Promise<unknown>, message: string) => {
    const current = scope.current
    if (!owner || current.owner !== owner || !current.active || current.busy) return false
    current.busy = true
    setState(previous => ({ owner, id, error: null, revision: previous.owner === owner ? previous.revision : 0 }))
    let success = false
    let failure: string | null = null
    try { await operation(); success = true }
    catch (error) { const diagnostic = orderOperationError(error); failure = diagnostic.message + (diagnostic.requestId ? ' Código de suporte: ' + diagnostic.requestId : '') }
    // A read failure does not undo a confirmed mutation. The list/detail query exposes its own error.
    try { await refresh() } catch { /* Keep the operation result and existing data. */ }
    if (current.active && scope.current === current) {
      setState(previous => ({ owner, id: null, error: failure, revision: previous.revision + 1 }))
      if (success) toast.success(message)
      else toast.error(failure!)
    }
    current.busy = false
    return success && current.active && scope.current === current
  }, [owner])
  return { run, revision: state.owner === owner ? state.revision : 0, pendingId: state.owner === owner ? state.id : null, error: state.owner === owner ? state.error : null }
}
