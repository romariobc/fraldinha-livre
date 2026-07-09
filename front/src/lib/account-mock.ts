import type { OrderItem } from '@/lib/domain/order'

export type OrderType = 'cotacao' | 'compra-direta'

export type OrderStatus =
  | 'aguardando'
  | 'ofertas-recebidas'
  | 'aceito'
  | 'confirmado'
  | 'a-caminho'
  | 'entregue'
  | 'cancelado'

export interface Address {
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export interface MockUser {
  name: string
  email: string
  cpf: string
  address: Address
}

export interface Offer {
  id: string
  supplier: string
  price: number       // em centavos
  deliveryDays: number
  rating: number      // 1–5
}

export interface Order {
  id: string
  type: OrderType
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  deliveryAddress: Address
  status: OrderStatus
  createdAt: string   // ISO 8601
  price?: number      // em centavos — compra-direta ou oferta aceita
  supplierId?: string // para compra-direta e oferta aceita
  supplierName?: string // para compra-direta e oferta aceita
  offers?: Offer[]    // presente apenas em cotacao
  items?: OrderItem[] // D-018: linhas do pedido (canonico). Opcional na transicao; getOrderItems faz o fallback.
}

const SP_ADDRESS: Address = {
  logradouro: 'Av. Paulista',
  numero: '1374',
  complemento: 'Apto 52',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01310-100',
}

export const MOCK_USER: MockUser = {
  name: 'Ana Lima',
  email: 'ana.lima@email.com',
  cpf: '123.456.789-00',
  address: SP_ADDRESS,
}

export const INITIAL_ORDERS: Order[] = [
  // Pedido ativo — compra direta confirmada
  {
    id: 'ord-003',
    type: 'compra-direta',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    deliveryAddress: SP_ADDRESS,
    status: 'confirmado',
    createdAt: '2026-05-11T15:00:00Z',
    price: 13400,
    items: [{
      productId: 'ord-003-p1',
      productName: 'Turma da Mônica P',
      unitPrice: 13400,
      quantity: 2,
      unit: 'cx',
    }],
  },
  // Histórico — entregue
  {
    id: 'ord-004',
    type: 'compra-direta',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'entregue',
    createdAt: '2026-04-20T09:00:00Z',
    price: 10500,
    items: [{
      productId: 'ord-004-p1',
      productName: 'MamyPoko Pants G',
      unitPrice: 10500,
      quantity: 40,
      unit: 'un',
    }],
  },
  // Histórico — compra direta cancelada
  {
    id: 'ord-005',
    type: 'compra-direta',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'cancelado',
    createdAt: '2026-04-10T11:00:00Z',
    price: 6000,
    items: [{
      productId: 'ord-005-p1',
      productName: 'Cremer XG',
      unitPrice: 6000,
      quantity: 20,
      unit: 'un',
    }],
  },
]
