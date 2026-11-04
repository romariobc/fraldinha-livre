'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** One request per query, account-isolated results and visible-page polling. */
export function useLiveOrderQuery<T>(key: string | null, load: () => Promise<T>, live = true) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: unknown; busy: boolean }>({ key: null, data: null, error: null, busy: false })
  const scope = useRef<{ key: string | null; valid: boolean; flight?: Promise<void> }>({ key: null, valid: false })
  const refresh = useCallback(async function refreshQuery(afterPending = false): Promise<void> {
    const owner = scope.current
    if (!key || owner.key !== key || !owner.valid) return
    if (owner.flight) {
      await owner.flight
      if (afterPending && owner.valid && scope.current === owner) return refreshQuery()
      return
    }
    const task = async () => {
      setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: null, busy: true }))
      try {
        const data = await load()
        if (owner.valid && scope.current === owner) setState({ key, data, error: null, busy: false })
      } catch (error) {
        if (owner.valid && scope.current === owner) setState(previous => ({ ...previous, key, error, busy: false }))
      }
    }
    owner.flight = task().finally(() => { owner.flight = undefined })
    return owner.flight
  }, [key, load])
  useEffect(() => {
    const owner = { key, valid: true }
    scope.current = owner
    void refresh()
    const updateVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = live && key ? window.setInterval(updateVisible, 30_000) : undefined
    if (live && key) {
      window.addEventListener('focus', updateVisible)
      document.addEventListener('visibilitychange', updateVisible)
    }
    return () => {
      owner.valid = false
      window.clearInterval(interval)
      window.removeEventListener('focus', updateVisible)
      document.removeEventListener('visibilitychange', updateVisible)
    }
  }, [key, live, refresh])
  const setData = useCallback((update: T | ((previous: T | null) => T)) => {
    if (!key || scope.current.key !== key || !scope.current.valid) return
    setState(previous => ({ key, data: typeof update === 'function' ? (update as (value: T | null) => T)(previous.key === key ? previous.data : null) : update, error: previous.key === key ? previous.error : null, busy: previous.key === key && previous.busy }))
  }, [key])
  const current = state.key === key && key !== null
  return { data: current ? state.data : null, error: current ? state.error : null,
    loading: Boolean(key && (!current || (state.busy && state.data === null))),
    refreshing: current && state.busy, refresh, setData }
}
