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
  offers?: Offer[]    // presente apenas em cotacao
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
  // Pedido ativo — cotação com 2 ofertas recebidas
  {
    id: 'ord-001',
    type: 'cotacao',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'ofertas-recebidas',
    createdAt: '2026-05-12T10:00:00Z',
    offers: [
      { id: 'off-001', supplier: 'Distribuidora Sul', price: 8700, deliveryDays: 2, rating: 4 },
      { id: 'off-002', supplier: 'Baby Stock SP',     price: 9200, deliveryDays: 1, rating: 5 },
    ],
  },
  // Pedido ativo — cotação aguardando fornecedores
  {
    id: 'ord-002',
    type: 'cotacao',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'aguardando',
    createdAt: '2026-05-13T08:30:00Z',
    offers: [],
  },
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
  },
  // Histórico — cancelado
  {
    id: 'ord-005',
    type: 'cotacao',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    deliveryAddress: SP_ADDRESS,
    status: 'cancelado',
    createdAt: '2026-04-10T11:00:00Z',
    offers: [],
  },
]
