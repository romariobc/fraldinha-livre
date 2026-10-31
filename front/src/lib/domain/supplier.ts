import type { Address } from './account'
import type { OrderItem } from '@contracts'

// Supplier presentation models. Persisted HTTP order shape remains in @contracts.

export type DeliveryType =
  | { kind: 'delivery'; maxHours: 1 | 2 | 4 }
  | { kind: 'days'; count: number }
  | { kind: 'to_arrange' }

export type GeoScope =
  | { type: 'neighborhood' }
  | { type: 'radius'; km: 5 | 10 }
  | { type: 'city'; city: string; state: string }
  | { type: 'national' }

export type DispatchStatus = 'em_preparo' | 'despachado' | 'entregue'
export type PaymentStatus = 'pendente' | 'confirmado'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SupplierProfile {
  name: string
  cnpj: string
  email: string
  phone: string
  brands: string[]
  states: string[]
  cities?: string[]
  ceps?: string[]
  rating: number
  memberSince: string
  neighborhood: string
  zip: string
}

export type MarketOrderStatus = 'aberto' | 'ofertado' | 'encerrado'

export interface MarketOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'

  buyerName: string
  buyerCnpj: string
  buyerStreet: string
  buyerNeighborhood: string
  buyerCity: string
  buyerState: string
  buyerZip: string

  createdAt: string
  totalOffers: number
  offeredByMe: boolean
  myOffer?: {
    price: number
    deliveryType: DeliveryType
    note?: string
  }
  status: MarketOrderStatus
}

export type DirectOrderStatus = 'aguardando' | 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado'

export interface DirectOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  price: number
  buyerCity: string
  buyerState: string
  createdAt: string
  status: DirectOrderStatus
  paymentStatus?: PaymentStatus
  dispatchStatus?: DispatchStatus
  deliveryAddress?: Address
  items?: OrderItem[]
}

export type OfferStatus = 'enviada' | 'aceita' | 'recusada' | 'expirada'

export interface SupplierOffer {
  id: string
  orderId: string
  product: string
  quantity: number
  unit: string
  buyerName: string
  buyerCity: string
  buyerState: string
  price: number
  deliveryType: DeliveryType
  note?: string
  status: OfferStatus
  paymentStatus?: PaymentStatus
  createdAt: string
  dispatchStatus?: DispatchStatus
}
