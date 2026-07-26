/// <reference types="vitest/globals" />

import { renderHook, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { vi } from 'vitest'

// Modo backend (NEXT_PUBLIC_USE_BACKEND=true): o load de pedidos e GATEADO
// pelo estado de auth do Firebase — sem usuario nao ha token, e list() sem
// token e um 401 garantido (bug encontrado na validacao B9).

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}))

type AuthCallback = (user: { uid: string } | null) => void
let authCallback: AuthCallback = () => {}

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, callback: AuthCallback) => {
    authCallback = callback
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}))

const listMock = vi.fn()
vi.mock('@/lib/adapters/http-order-repository', () => ({
  HttpOrderRepository: vi.fn().mockImplementation(() => ({
    list: listMock,
    create: vi.fn(),
    cancel: vi.fn(),
  })),
}))

import { OrdersProvider, useOrders } from '../orders-context'

function wrapper({ children }: { children: ReactNode }) {
  return <OrdersProvider>{children}</OrdersProvider>
}

describe('OrdersContext — modo backend gateado por auth', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_BACKEND', 'true')
    listMock.mockReset().mockResolvedValue([])
    authCallback = () => {}
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sem usuario: nao chama list(), termina sem loading e sem erro', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => authCallback(null))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listMock).not.toHaveBeenCalled()
    expect(result.current.orders).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('com usuario: chama list() (token disponivel) apos o auth resolver', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => authCallback({ uid: 'user-a' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('logout apos login limpa os pedidos sem erro', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => authCallback({ uid: 'user-a' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => authCallback(null))

    await waitFor(() => expect(result.current.orders).toEqual([]))
    expect(result.current.error).toBeNull()
  })
})
