import { afterEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../api-client'
const session = vi.hoisted(() => ({ currentUser: null as null | { uid: string; getIdToken(): Promise<string> } }))
vi.mock('@/lib/firebase', () => ({ auth: session }))
afterEach(() => { vi.unstubAllGlobals(); session.currentUser = null })
it('não envia quando a conta já é diferente da tentativa', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  session.currentUser = { uid: 'buyer-b', getIdToken: async () => 'token-b' }
  await expect(apiFetch('/orders', { method: 'POST' }, 'buyer-a')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  expect(fetch).not.toHaveBeenCalled()
})
it('troca de conta durante obtenção do token não envia compra na outra identidade', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  session.currentUser = { uid: 'buyer-a', getIdToken: async () => {
    session.currentUser = { uid: 'buyer-b', getIdToken: async () => 'token-b' }
    return 'token-a'
  } }
  await expect(apiFetch('/orders', { method: 'POST' }, 'buyer-a')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  expect(fetch).not.toHaveBeenCalled()
})
