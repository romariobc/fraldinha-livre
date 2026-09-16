import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from '../api-client'

describe('apiFetch (OBS-001B)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('injeta X-Request-Id automaticamente na requisição', async () => {
    await apiFetch('/test-endpoint')

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    const [, init] = (globalThis.fetch as any).mock.calls[0]
    const headers = init.headers as Headers

    expect(headers.has('X-Request-Id')).toBe(true)
    const requestId = headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()
    expect(requestId!.length).toBeGreaterThan(5)
  })

  it('preserva X-Request-Id se já tiver sido fornecido no init', async () => {
    const customId = 'custom-trace-uuid-123'
    await apiFetch('/test-endpoint', {
      headers: {
        'X-Request-Id': customId,
      },
    })

    const [, init] = (globalThis.fetch as any).mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.get('X-Request-Id')).toBe(customId)
  })
})
