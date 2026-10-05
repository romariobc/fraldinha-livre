/// <reference types="vitest/globals" />

import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { MarketProvider, useMarket } from '../market-context'
import { vi, beforeEach, afterEach } from 'vitest'
import { MOCK_DIRECT_ORDERS } from '@/lib/supplier-mock'
import type { OrderRepository } from '@/lib/ports/order-repository'
import type { Order as ContractOrder } from '@contracts'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock HttpOrderRepository
vi.mock('@/lib/adapters/http-order-repository', () => ({
  HttpOrderRepository: vi.fn(),
}))

// Mock useAuth — MarketProvider so busca listForSupplier() pro fornecedor logado
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import { useAuth } from '@/contexts/auth-context'

const mockedHttpOrderRepository = vi.mocked(HttpOrderRepository)
const mockUseAuth = vi.mocked(useAuth)

const FORNECEDOR_LOGADO = {
  user: { uid: 'sup-1', email: 'fornecedor@test.com', displayName: 'Fornecedor Test' },
  profile: null,
  role: 'fornecedor' as const,
  claims: { role: 'fornecedor', fornecedor: true },
  isAdmin: false,
  loading: false,
  signInGoogle: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signOutUser: vi.fn(),
  updateProfile: vi.fn(),
}

function makeFakeRepo(overrides: Partial<OrderRepository>): OrderRepository {
  return {
    list: vi.fn(),
    listForSupplier: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    updateStatus: vi.fn(),
    ...overrides,
  }
}

const fakeContractOrder: ContractOrder = {
  id: 'ord-fake-1',
  uid: 'uid-comprador-fake',
  type: 'compra-direta',
  status: 'aguardando',
  product: 'Fralda Teste',
  quantity: 2,
  unit: 'un',
  price: 4000,
  supplierId: 'sup-a',
  supplierName: 'Fornecedor A',
  deliveryAddress: {
    logradouro: 'Rua A',
    numero: '1',
    bairro: 'Centro',
    cidade: 'Sao Paulo',
    estado: 'SP',
    cep: '01000-000',
  },
  createdAt: '2026-07-26T00:00:00.000Z',
  items: [
    { productId: 'p1', productName: 'Fralda Teste', unitPrice: 2000, quantity: 2, unit: 'un' },
  ],
}

type AllProvidersProps = {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return <MarketProvider>{children}</MarketProvider>
}

beforeEach(() => {
  // Default: fornecedor logado, pra nao quebrar os testes que ja assumiam isso
  // implicitamente antes do gate por auth existir. Testes do gate sobrescrevem.
  mockUseAuth.mockReturnValue(FORNECEDOR_LOGADO)
})

describe('MarketContext - cancelDirectOrder', () => {
  it('should cancel a direct order by changing status to cancelado', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const orderToCancel = result.current.directOrders[0]

    act(() => {
      result.current.cancelDirectOrder(orderToCancel.id)
    })

    const updatedOrder = result.current.directOrders.find(o => o.id === orderToCancel.id)
    expect(updatedOrder?.status).toBe('cancelado')
  })

  it('should not affect other orders when canceling one', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const orderToCancel = result.current.directOrders[0]
    const otherOrdersStatuses = result.current.directOrders.slice(1).map(o => o.status)

    act(() => {
      result.current.cancelDirectOrder(orderToCancel.id)
    })

    const updatedOtherOrdersStatuses = result.current.directOrders.slice(1).map(o => o.status)
    expect(updatedOtherOrdersStatuses).toEqual(otherOrdersStatuses)
  })

  it('should be a no-op if order id does not exist', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    const originalOrders = result.current.directOrders.map(o => ({ ...o }))

    act(() => {
      result.current.cancelDirectOrder('non-existent-id')
    })

    // Orders should remain unchanged
    expect(result.current.directOrders).toEqual(originalOrders)
  })
})

describe('MarketContext - directOrders loading (mock mode)', () => {
  beforeEach(() => {
    // Simular modo mock
    delete process.env.NEXT_PUBLIC_USE_BACKEND
  })

  it('modo mock: directOrders começa com MOCK_DIRECT_ORDERS', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrders).toEqual(MOCK_DIRECT_ORDERS)
  })

  it('modo mock: directOrdersLoading é false', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrdersLoading).toBe(false)
  })

  it('modo mock: directOrdersError é null', () => {
    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrdersError).toBe(null)
  })
})

describe('MarketContext - directOrders loading (backend mode)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_BACKEND', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('modo backend: busca pedidos via listForSupplier e mapeia para DirectOrder', async () => {
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(listForSupplierMock).toHaveBeenCalledOnce()
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-fake-1')
    expect(result.current.directOrders[0].product).toBe('Fralda Teste')
    expect(result.current.directOrdersError).toBeNull()
  })

  it('modo backend: erro no listForSupplier define directOrdersError e nao quebra', async () => {
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({
          listForSupplier: vi.fn().mockRejectedValue(new Error('network fail')),
        }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(result.current.directOrdersError).toBe(
      'Não foi possível carregar os pedidos diretos. Tente novamente.'
    )
    expect(result.current.directOrders).toEqual([])
  })

  it('modo backend: visitante anonimo (sem user) nao chama listForSupplier', async () => {
    mockUseAuth.mockReturnValue({ ...FORNECEDOR_LOGADO, user: null, role: null })
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(listForSupplierMock).not.toHaveBeenCalled()
    expect(result.current.directOrders).toEqual([])
    expect(result.current.directOrdersError).toBeNull()
  })

  it('modo backend: comprador logado (role != fornecedor) nao chama listForSupplier', async () => {
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'comp-1', email: 'comprador@test.com', displayName: 'Comprador Test' },
      role: 'comprador',
    })
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    expect(listForSupplierMock).not.toHaveBeenCalled()
  })

  it('modo backend: aguarda auth resolver (loading=true) antes de decidir se busca', () => {
    mockUseAuth.mockReturnValue({ ...FORNECEDOR_LOGADO, loading: true })
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(listForSupplierMock).not.toHaveBeenCalled()
    expect(result.current.directOrdersLoading).toBe(true)
  })

  it('modo backend: handleConfirmarDireto chama repo.updateStatus com "confirmado"', async () => {
    const updateStatusMock = vi.fn().mockResolvedValue(fakeContractOrder)
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock, updateStatus: updateStatusMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    await act(async () => {
      await result.current.handleConfirmarDireto('ord-fake-1')
    })

    expect(updateStatusMock).toHaveBeenCalledWith('ord-fake-1', 'confirmado')
    expect(result.current.directOrders[0].status).toBe('confirmado')
  })

  it('modo backend: handleRecusarDireto chama repo.updateStatus com "cancelado"', async () => {
    const updateStatusMock = vi.fn().mockResolvedValue(fakeContractOrder)
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock, updateStatus: updateStatusMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    await act(async () => {
      await result.current.handleRecusarDireto('ord-fake-1')
    })

    expect(updateStatusMock).toHaveBeenCalledWith('ord-fake-1', 'cancelado')
    expect(result.current.directOrders[0].status).toBe('cancelado')
  })

  it('modo backend: handleAtualizarStatusDireto chama repo.updateStatus com status desejado', async () => {
    const updateStatusMock = vi.fn().mockResolvedValue(fakeContractOrder)
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock, updateStatus: updateStatusMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    await act(async () => {
      await result.current.handleAtualizarStatusDireto('ord-fake-1', 'a-caminho')
    })

    expect(updateStatusMock).toHaveBeenCalledWith('ord-fake-1', 'a-caminho')
    expect(result.current.directOrders[0].status).toBe('a-caminho')
  })

  it('modo backend: refetchDirectOrders dispara nova consulta e recupera de erro', async () => {
    const listForSupplierMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Falha temporária de rede'))
      .mockResolvedValueOnce([fakeContractOrder])

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrders).toEqual([])

    // Dispara refetch manual
    await act(async () => {
      await result.current.refetchDirectOrders()
    })

    expect(listForSupplierMock).toHaveBeenCalledTimes(2)
    expect(result.current.directOrdersError).toBeNull()
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-fake-1')
  })

  it('modo backend: não emite toast no contexto (delega feedback para UI)', async () => {
    const { toast } = await import('sonner')
    const updateStatusMock = vi.fn().mockResolvedValue(fakeContractOrder)
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock, updateStatus: updateStatusMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))

    await act(async () => {
      await result.current.handleConfirmarDireto('ord-fake-1')
    })

    // Contexto não deve chamar toast.success nem toast.info
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('modo backend: logout ou troca de usuário descarta resposta pendente', async () => {
    let resolveLateFetch: (value: ContractOrder[]) => void
    const latePromise = new Promise<ContractOrder[]>((resolve) => {
      resolveLateFetch = resolve
    })

    const listForSupplierMock = vi.fn().mockReturnValue(latePromise)
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result, rerender, unmount } = renderHook(() => useMarket(), { wrapper: AllProviders })

    // Simula logout antes da resposta chegar
    mockUseAuth.mockReturnValue({ ...FORNECEDOR_LOGADO, user: null, role: null })
    rerender()

    // Resolve a promise pendente tardiamente
    await act(async () => {
      resolveLateFetch!([fakeContractOrder])
    })

    // directOrders deve estar limpo e sem o pedido tardio
    expect(result.current.directOrders).toEqual([])

    unmount()
  })

  it('modo backend: logout limpa pedidos do fornecedor anterior imediatamente', async () => {
    const listForSupplierMock = vi.fn().mockResolvedValue([fakeContractOrder])
    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)

    // Usuário desloga
    act(() => {
      mockUseAuth.mockReturnValue({ ...FORNECEDOR_LOGADO, user: null, role: null })
      rerender()
    })

    expect(result.current.directOrders).toEqual([])
    expect(result.current.directOrdersLoading).toBe(false)
    expect(result.current.directOrdersError).toBeNull()
  })

  it('modo backend: resposta antiga mais lenta não sobrescreve um retry mais recente', async () => {
    let resolveOldFetch: (value: ContractOrder[]) => void
    const oldPromise = new Promise<ContractOrder[]>((resolve) => {
      resolveOldFetch = resolve
    })

    const newOrder: ContractOrder = { ...fakeContractOrder, id: 'ord-recente-2' }

    const listForSupplierMock = vi
      .fn()
      .mockReturnValueOnce(oldPromise) // Primeira busca demorada
      .mockResolvedValueOnce([newOrder]) // Retry imediato

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })

    // Dispara retry manual enquanto a primeira requisição ainda está pendente
    await act(async () => {
      await result.current.refetchDirectOrders()
    })

    // O estado deve refletir o resultado da requisição mais recente (retry)
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-recente-2')

    // Agora a requisição antiga resolve tardiamente
    await act(async () => {
      resolveOldFetch!([fakeContractOrder])
    })

    // O estado NÃO deve ser sobrescrito pela resposta antiga
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-recente-2')
  })

  it('modo backend: falha transitória de refresh preserva os pedidos anteriores', async () => {
    const listForSupplierMock = vi
      .fn()
      .mockResolvedValueOnce([fakeContractOrder]) // Carga inicial com sucesso
      .mockRejectedValueOnce(new Error('Erro transitório no refresh')) // Refresh falha

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    const { result } = renderHook(() => useMarket(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)

    // Aciona refresh manual que falha
    await act(async () => {
      await result.current.refetchDirectOrders()
    })

    // Os dados anteriores permanecem preservados em tela e o erro é registrado
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-fake-1')
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrdersLoading).toBe(false)
  })

  it('modo backend: troca de fornecedor (UID A -> B) ativa loading e isola pedidos/erros da conta anterior', async () => {
    let resolveB: (value: ContractOrder[]) => void
    const pendingPromiseB = new Promise<ContractOrder[]>((resolve) => {
      resolveB = resolve
    })

    const orderSupplierA: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-A' }
    const orderSupplierB: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-B', supplierId: 'sup-B' }

    const listForSupplierMock = vi
      .fn()
      .mockResolvedValueOnce([orderSupplierA]) // Carga do Fornecedor A
      .mockReturnValueOnce(pendingPromiseB) // Carga do Fornecedor B em andamento

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    // 1. Fornecedor A logado
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'sup-A', email: 'fornecedorA@test.com', displayName: 'Fornecedor A' },
    })

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-A')

    // 2. Troca de conta para Fornecedor B
    act(() => {
      mockUseAuth.mockReturnValue({
        ...FORNECEDOR_LOGADO,
        user: { uid: 'sup-B', email: 'fornecedorB@test.com', displayName: 'Fornecedor B' },
      })
      rerender()
    })

    // Enquanto a busca de B está pendente, o loading DEVE ser true e pedidos devem ser []
    expect(result.current.directOrdersLoading).toBe(true)
    expect(result.current.directOrders).toEqual([])
    expect(result.current.directOrdersError).toBeNull()

    // 3. Resposta de B chega
    await act(async () => {
      resolveB!([orderSupplierB])
    })

    expect(result.current.directOrdersLoading).toBe(false)
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-B')
  })

  it('modo backend: erro de um fornecedor não vaza para outro na troca de conta', async () => {
    let rejectB: (reason: Error) => void
    const pendingPromiseB = new Promise<ContractOrder[]>((_, reject) => {
      rejectB = reject
    })

    const listForSupplierMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Falha no Fornecedor A'))
      .mockReturnValueOnce(pendingPromiseB)

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    // 1. Fornecedor A logado falha
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'sup-A', email: 'fornecedorA@test.com', displayName: 'Fornecedor A' },
    })

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrdersDiagnostic).not.toBeNull()

    // 2. Troca de conta para Fornecedor B
    act(() => {
      mockUseAuth.mockReturnValue({
        ...FORNECEDOR_LOGADO,
        user: { uid: 'sup-B', email: 'fornecedorB@test.com', displayName: 'Fornecedor B' },
      })
      rerender()
    })

    // Enquanto B carrega, o erro do A NÃO pode estar visível para o B
    expect(result.current.directOrdersLoading).toBe(true)
    expect(result.current.directOrdersError).toBeNull()
    expect(result.current.directOrdersDiagnostic).toBeNull()
    expect(result.current.directOrders).toEqual([])

    // 3. Fornecedor B também falha
    await act(async () => {
      rejectB!(new Error('Falha no Fornecedor B'))
    })

    // Agora o erro e diagnóstico devem ser exibidos para o Fornecedor B
    expect(result.current.directOrdersLoading).toBe(false)
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrdersDiagnostic).not.toBeNull()
  })

  it('modo backend: [REGRESSÃO P1] Fornecedor A com pedidos -> troca para B -> consulta de B falha: NENHUM pedido de A vaza para B, erro de B visível e loading false', async () => {
    let rejectB: (reason: Error) => void
    const pendingPromiseB = new Promise<ContractOrder[]>((_, reject) => {
      rejectB = reject
    })

    const orderSupplierA: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-A-secreto' }

    const listForSupplierMock = vi
      .fn()
      .mockResolvedValueOnce([orderSupplierA]) // Fornecedor A carrega com sucesso
      .mockReturnValueOnce(pendingPromiseB) // Fornecedor B inicia consulta

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    // 1. Fornecedor A carrega pedidos com sucesso
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'sup-A', email: 'fornecedorA@test.com', displayName: 'Fornecedor A' },
    })

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-A-secreto')

    // 2. Troca de conta para Fornecedor B
    act(() => {
      mockUseAuth.mockReturnValue({
        ...FORNECEDOR_LOGADO,
        user: { uid: 'sup-B', email: 'fornecedorB@test.com', displayName: 'Fornecedor B' },
      })
      rerender()
    })

    // Enquanto B está pendente: loading true e nenhum pedido de A visível
    expect(result.current.directOrdersLoading).toBe(true)
    expect(result.current.directOrders).toEqual([])

    // 3. Consulta de B falha
    await act(async () => {
      rejectB!(new Error('Falha de rede na conta B'))
    })

    // Loading deve ser false, erro de B deve estar visível e NENHUM pedido de A pode estar em directOrders!
    expect(result.current.directOrdersLoading).toBe(false)
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrders).toEqual([])
  })

  it('modo backend: Fornecedor A com pedidos -> troca para B -> refresh manual de B falha: pedidos de A permanecem isolados e erro de B é visível', async () => {
    const orderSupplierA: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-A-privado' }

    const listForSupplierMock = vi
      .fn()
      .mockResolvedValueOnce([orderSupplierA]) // Fornecedor A carrega com sucesso
      .mockRejectedValueOnce(new Error('Erro no efeito automático de B')) // Efeito de B falha
      .mockRejectedValueOnce(new Error('Erro no refresh manual de B')) // Refresh manual de B também falha

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    // 1. Fornecedor A logado com sucesso
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'sup-A', email: 'fornecedorA@test.com', displayName: 'Fornecedor A' },
    })

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-A-privado')

    // 2. Troca para B e efeito falha
    act(() => {
      mockUseAuth.mockReturnValue({
        ...FORNECEDOR_LOGADO,
        user: { uid: 'sup-B', email: 'fornecedorB@test.com', displayName: 'Fornecedor B' },
      })
      rerender()
    })

    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toEqual([])
    expect(result.current.directOrdersError).not.toBeNull()

    // 3. Fornecedor B dispara refresh manual (refetchDirectOrders) e falha novamente
    await act(async () => {
      await result.current.refetchDirectOrders()
    })

    // Pedidos de A continuam rigorosamente isolados (vazios), loading false e erro visível para B
    expect(result.current.directOrdersLoading).toBe(false)
    expect(result.current.directOrdersError).toBe('Não foi possível carregar os pedidos diretos. Tente novamente.')
    expect(result.current.directOrders).toEqual([])
  })

  it('modo backend: Fornecedor A com pedidos -> troca para B -> resposta tardia de A não sobrescreve os dados de B', async () => {
    let resolveA: (value: ContractOrder[]) => void
    const pendingPromiseA = new Promise<ContractOrder[]>((resolve) => {
      resolveA = resolve
    })

    const orderSupplierA: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-A-lento' }
    const orderSupplierB: ContractOrder = { ...fakeContractOrder, id: 'ord-sup-B-rapido', supplierId: 'sup-B' }

    const listForSupplierMock = vi
      .fn()
      .mockReturnValueOnce(pendingPromiseA) // Consulta de A demora
      .mockResolvedValueOnce([orderSupplierB]) // Consulta de B responde rápido

    mockedHttpOrderRepository.mockImplementation(
      function() { return makeFakeRepo({ listForSupplier: listForSupplierMock }) as unknown as HttpOrderRepository }
    )

    // 1. Monta com Fornecedor A (resposta ainda pendente)
    mockUseAuth.mockReturnValue({
      ...FORNECEDOR_LOGADO,
      user: { uid: 'sup-A', email: 'fornecedorA@test.com', displayName: 'Fornecedor A' },
    })

    const { result, rerender } = renderHook(() => useMarket(), { wrapper: AllProviders })

    expect(result.current.directOrdersLoading).toBe(true)

    // 2. Troca para Fornecedor B antes de A responder
    act(() => {
      mockUseAuth.mockReturnValue({
        ...FORNECEDOR_LOGADO,
        user: { uid: 'sup-B', email: 'fornecedorB@test.com', displayName: 'Fornecedor B' },
      })
      rerender()
    })

    // Espera B resolver com sucesso
    await waitFor(() => expect(result.current.directOrdersLoading).toBe(false))
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-B-rapido')

    // 3. Resposta tardia de A chega depois que B já está ativo e carregado
    await act(async () => {
      resolveA!([orderSupplierA])
    })

    // O estado de B não pode ser sobrescrito pelos dados de A
    expect(result.current.directOrders).toHaveLength(1)
    expect(result.current.directOrders[0].id).toBe('ord-sup-B-rapido')
  })
})



