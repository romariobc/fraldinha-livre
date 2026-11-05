import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOrderOperation } from '../use-order-operation'
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from 'sonner'
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }
describe('serialized order operations', () => {
  it('coalesces rapid clicks and refreshes after the single confirmed action', async () => {
    const pending = deferred(), write = vi.fn(() => pending.promise), refresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOrderOperation('supplier-a'))
    let first!: Promise<boolean>
    act(() => { first = result.current.run('order', write, refresh, 'Confirmado'); void result.current.run('order', write, refresh, 'Confirmado') })
    expect(write).toHaveBeenCalledTimes(1); expect(result.current.pendingId).toBe('order')
    await act(async () => { pending.resolve(); await first })
    expect(refresh).toHaveBeenCalledTimes(1); expect(result.current.pendingId).toBeNull()
  })
  it('reconciles a conflict and retains an actionable error with support reference', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const write = vi.fn().mockRejectedValue({ cause: { code: 'ORDER_STATUS_NOT_ALLOWED', requestId: 'trace-conflict' } })
    const { result } = renderHook(() => useOrderOperation('supplier-a'))
    await act(async () => { expect(await result.current.run('order', write, refresh, 'Confirmado')).toBe(false) })
    expect(refresh).toHaveBeenCalledTimes(1); expect(result.current.error).toMatch(/estado atualizado/); expect(result.current.error).toContain('trace-conflict')
  })
  it('a read failure after a committed write never becomes an instruction to repeat the mutation', async () => {
    const write = vi.fn().mockResolvedValue(undefined), refresh = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useOrderOperation('admin-a'))
    await act(async () => { expect(await result.current.run('order', write, refresh, 'Cancelado')).toBe(true) })
    expect(write).toHaveBeenCalledTimes(1); expect(result.current.error).toBeNull()
  })
  it('late completion after account change neither updates state nor reports success for the new account', async () => {
    vi.mocked(toast.success).mockClear()
    const pending = deferred(), refresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ owner }) => useOrderOperation(owner), { initialProps: { owner: 'a' } })
    let saved!: Promise<boolean>
    act(() => { saved = result.current.run('order', () => pending.promise, refresh, 'Confirmado') })
    rerender({ owner: 'b' }); await act(async () => { pending.resolve(); expect(await saved).toBe(false) })
    expect(result.current.pendingId).toBeNull(); expect(result.current.error).toBeNull(); expect(toast.success).not.toHaveBeenCalled()
  })
})
