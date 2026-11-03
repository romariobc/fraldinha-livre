import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveOrderQuery } from '../use-live-order-query'
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
describe('live order query', () => {
  beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }) })
  afterEach(() => { vi.useRealTimers() })
  it('loads on opening, focus, visible return, manual refresh and every 30 seconds', async () => {
    const load = vi.fn().mockResolvedValue(['saved'])
    const { result } = renderHook(() => useLiveOrderQuery('account:a', load))
    await settle(); expect(load).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(29_999)); expect(load).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(load).toHaveBeenCalledTimes(2)
    act(() => window.dispatchEvent(new Event('focus'))); await settle(); expect(load).toHaveBeenCalledTimes(3)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => vi.advanceTimersByTimeAsync(60_000)); expect(load).toHaveBeenCalledTimes(3)
    act(() => window.dispatchEvent(new Event('focus'))); await settle(); expect(load).toHaveBeenCalledTimes(3)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await settle(); expect(load).toHaveBeenCalledTimes(4)
    await act(async () => result.current.refresh()); expect(load).toHaveBeenCalledTimes(5)
  })
  it('coalesces repeated manual/focus/timer triggers while a request is pending', async () => {
    const pending = deferred<string[]>()
    const load = vi.fn(() => pending.promise)
    const { result } = renderHook(() => useLiveOrderQuery('account:a', load))
    act(() => { void result.current.refresh(); window.dispatchEvent(new Event('focus')) })
    await act(async () => vi.advanceTimersByTimeAsync(90_000))
    expect(load).toHaveBeenCalledTimes(1)
    pending.resolve(['confirmed']); await settle()
    expect(result.current.data).toEqual(['confirmed'])
    expect(result.current.loading).toBe(false)
  })
  it('preserves last data and exposes an error during network failure; manual retry recovers', async () => {
    const load = vi.fn().mockResolvedValueOnce(['old']).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(['new'])
    const { result } = renderHook(() => useLiveOrderQuery('account:a', load))
    await settle(); await act(async () => result.current.refresh())
    expect(result.current.data).toEqual(['old']); expect(result.current.error).toBeInstanceOf(Error)
    await act(async () => result.current.refresh())
    expect(result.current.data).toEqual(['new']); expect(result.current.error).toBeNull()
  })
  it('hides the previous account immediately and ignores its delayed success and failure', async () => {
    const a = deferred<string[]>(), b = deferred<string[]>()
    const loadA = vi.fn(() => a.promise), loadB = vi.fn(() => b.promise)
    const { result, rerender } = renderHook(({ key, load }) => useLiveOrderQuery(key, load), { initialProps: { key: 'a' as string | null, load: loadA } })
    rerender({ key: 'b', load: loadB }); expect(result.current.data).toBeNull()
    a.resolve(['private-a']); await settle(); expect(result.current.data).toBeNull()
    b.resolve(['private-b']); await settle(); expect(result.current.data).toEqual(['private-b'])
    rerender({ key: null, load: loadB }); expect(result.current.data).toBeNull(); expect(result.current.error).toBeNull()
  })
  it('unmount removes polling and event listeners and ignores late completion', async () => {
    const pending = deferred<string[]>(), load = vi.fn(() => pending.promise)
    const { unmount } = renderHook(() => useLiveOrderQuery('a', load))
    unmount(); pending.resolve(['late']); await settle()
    await act(async () => vi.advanceTimersByTimeAsync(60_000))
    window.dispatchEvent(new Event('focus')); expect(load).toHaveBeenCalledTimes(1)
  })
  it('disabled queries never request or disclose cached account data', async () => {
    const load = vi.fn().mockResolvedValue(['secret'])
    const { result } = renderHook(() => useLiveOrderQuery(null, load))
    await settle(); expect(load).not.toHaveBeenCalled(); expect(result.current.data).toBeNull()
  })
})
