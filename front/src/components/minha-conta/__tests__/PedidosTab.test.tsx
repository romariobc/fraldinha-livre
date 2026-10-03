/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PedidosTab from '../PedidosTab'
import type { Order } from '@/lib/account-mock'

// Mock contexts
vi.mock('@/contexts/orders-context', () => ({
  useOrders: vi.fn(),
}))

vi.mock('@/contexts/market-context', () => ({
  useMarket: vi.fn(),
}))

import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'

const mockUseOrders = vi.mocked(useOrders)
const mockUseMarket = vi.mocked(useMarket)

const mockActiveOrder: Order = {
  id: 'ped-001',
  type: 'compra-direta',
  createdAt: '2026-03-20T10:00:00Z',
  status: 'confirmado',
  price: 12000,
  product: 'Fralda Conforto M',
  quantity: 2,
  unit: 'un',
  items: [
    {
      productId: 'prod-1',
      productName: 'Fralda Conforto M',
      quantity: 2,
      unitPrice: 6000,
      unit: 'un',
    },
  ],
  deliveryAddress: {
    logradouro: 'Rua das Flores',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001-000',
  },
}

describe('PedidosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      errorDiagnostic: null,
      refreshOrders: vi.fn(),
      createDirectOrder: vi.fn(),
      cancelOrder: vi.fn(),
      createOrdersFromCart: vi.fn(),
    })
    mockUseMarket.mockReturnValue({
      marketOrders: [],
      directOrders: [],
      offers: [],
      declinedIds: new Set(),
      handleEnviarOferta: vi.fn(),
      handleDeclineMercado: vi.fn(),
      handleConfirmarDireto: vi.fn(),
      handleRecusarDireto: vi.fn(),
      handleAtualizarStatusDireto: vi.fn(),
      handleAtualizarDespacho: vi.fn(),
      addDirectOrder: vi.fn(),
      cancelDirectOrder: vi.fn(),
      directOrdersLoading: false,
      directOrdersError: null,
      directOrdersDiagnostic: null,
      refetchDirectOrders: vi.fn(),
