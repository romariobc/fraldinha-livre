// src/lib/profile-mock.ts

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  avatarInitials: string
  memberSince: string
}

export type OrderStatus = 'pendente' | 'confirmado' | 'enviado' | 'entregue' | 'cancelado'

export interface OrderItem {
  productName: string
  brand: string
  size: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  date: string
  status: OrderStatus
  items: OrderItem[]
  total: number
  trackingCode?: string
}

export interface Address {
  id: string
  label: string
  recipient: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zip: string
  isDefault: boolean
}

export const MOCK_USER: UserProfile = {
  id: 'u1',
  name: 'Ana Paula Ferreira',
  email: 'ana.ferreira@email.com',
  phone: '(11) 98765-4321',
  cpf: '123.456.789-00',
  avatarInitials: 'AF',
  memberSince: 'março de 2024',
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendente:   'Pendente',
  confirmado: 'Confirmado',
  enviado:    'Enviado',
  entregue:   'Entregue',
  cancelado:  'Cancelado',
}

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pendente:   'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  enviado:    'bg-purple-100 text-purple-800',
  entregue:   'bg-green-100 text-green-800',
  cancelado:  'bg-red-100 text-red-800',
}

export const MOCK_ORDERS: Order[] = [
  {
    id: '#FL-20240312',
    date: '12/03/2024',
    status: 'entregue',
    trackingCode: 'BR123456789',
    items: [
      { productName: 'Supersec Pants', brand: 'Pampers', size: 'M', quantity: 2, price: 22 },
      { productName: 'Supreme Care',   brand: 'Huggies', size: 'P', quantity: 1, price: 20 },
    ],
    total: 64,
  },
  {
    id: '#FL-20240405',
    date: '05/04/2024',
    status: 'entregue',
    trackingCode: 'BR987654321',
    items: [
      { productName: 'Pants Premium', brand: 'MamyPoko', size: 'G', quantity: 3, price: 24 },
    ],
    total: 72,
  },
  {
    id: '#FL-20240518',
    date: '18/05/2024',
    status: 'enviado',
    trackingCode: 'BR112233445',
    items: [
      { productName: 'Premium Care',  brand: 'Pampers', size: 'RN', quantity: 2, price: 24 },
      { productName: 'Natural Fit',   brand: 'Huggies', size: 'GG', quantity: 1, price: 34 },
    ],
    total: 82,
  },
  {
    id: '#FL-20240601',
    date: '01/06/2024',
    status: 'confirmado',
    items: [
      { productName: 'Naturali', brand: 'Cremer', size: 'P', quantity: 4, price: 16 },
    ],
    total: 64,
  },
]

export const MOCK_ADDRESSES: Address[] = [
  {
    id: 'a1',
    label: 'Casa',
    recipient: 'Ana Paula Ferreira',
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 45',
    neighborhood: 'Jardim Primavera',
    city: 'São Paulo',
    state: 'SP',
    zip: '01310-100',
    isDefault: true,
  },
  {
    id: 'a2',
    label: 'Trabalho',
    recipient: 'Ana Paula Ferreira',
    street: 'Av. Paulista',
    number: '1000',
    complement: 'Sala 302',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zip: '01310-200',
    isDefault: false,
  },
]
