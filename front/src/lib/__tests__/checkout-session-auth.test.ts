import { HttpOrderRepository } from '../adapters/http-order-repository'
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

it.each(['cancel','updateStatus'] as const)('não envia %s com token de outra conta', async method => {
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
 session.currentUser={uid:'other-user',getIdToken:async()=>'other-token'}
 const repo=new HttpOrderRepository('original-user')
 await expect(method==='cancel'?repo.cancel('order'):repo.updateStatus('order','confirmado')).rejects.toBeDefined()
 expect(fetch).not.toHaveBeenCalled()
})
