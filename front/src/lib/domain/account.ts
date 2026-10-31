import type { Address as ContractAddress, Order as ContractOrder, OrderItem } from '@contracts'

// Presentation model for account screens; legacy quotation and missing-items snapshots remain supported.
export type Address = ContractAddress
export type OrderType = ContractOrder['type'] | 'cotacao'
export type OrderStatus = ContractOrder['status']
export interface AccountProfile { name: string; email: string; cpf: string; address: Address }
export interface Offer { id: string; supplier: string; price: number; deliveryDays: number; rating: number }
export interface AccountOrder extends Omit<ContractOrder, 'uid' | 'type' | 'items'> {
  type: OrderType
  offers?: Offer[]
  items?: OrderItem[]
}
export type Order = AccountOrder
