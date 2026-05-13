// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MockSupplier {
  name: string        // razão social
  cnpj: string        // ex: '12.456.789/0001-00'
  email: string
  phone: string
  brands: string[]    // marcas que trabalha
  states: string[]    // UFs cobertas
  cities?: string[]   // cidades opcionais
  ceps?: string[]     // CEPs específicos
  rating: number      // 1–5
  memberSince: string // ex: 'mar/2025'
}

export type MarketOrderStatus = 'aberto' | 'ofertado' | 'encerrado'

export interface MarketOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  buyerCity: string
  buyerState: string
  createdAt: string       // ISO 8601
  totalOffers: number     // total de ofertas recebidas (de todos os fornecedores)
  offeredByMe: boolean    // este fornecedor já enviou oferta?
  myOffer?: {
    price: number         // centavos
    deliveryDays: number
    note?: string
  }
  status: MarketOrderStatus
}

export type DirectOrderStatus = 'aguardando' | 'confirmado' | 'cancelado'

export interface DirectOrder {
  id: string
  product: string
  quantity: number
  unit: 'un' | 'cx' | 'kg'
  price: number           // centavos — preço fixo do catálogo
  buyerCity: string
  buyerState: string
  createdAt: string
  status: DirectOrderStatus
}

export type OfferStatus = 'enviada' | 'aceita' | 'recusada' | 'expirada'

export interface SupplierOffer {
  id: string
  orderId: string
  product: string         // snapshot
  quantity: number
  unit: string
  buyerCity: string
  buyerState: string
  price: number           // centavos — total ofertado
  deliveryDays: number
  note?: string
  status: OfferStatus
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

export function maskCnpj(cnpj: string): string {
  // '12.456.789/0001-00' → '***.456.789/0001-**'
  const masked = cnpj.replace(
    /^(\d{2})\.(\d{3}\.\d{3}\/\d{4})-(\d{2})$/,
    (_, _a, mid, _c) => `***.${mid}-**`
  )
  // Fallback for unformatted input: mask first 3 and last 2 characters
  if (masked === cnpj) {
    return cnpj.slice(0, 3).replace(/./g, '*') + cnpj.slice(3, -2) + '**'
  }
  return masked
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_SUPPLIER: MockSupplier = {
  name: 'Distribuidora Sul Ltda.',
  cnpj: '12.456.789/0001-00',
  email: 'contato@distribuidorasul.com.br',
  phone: '(11) 98765-4321',
  brands: ['Pampers', 'Huggies', 'Cremer'],
  states: ['SP', 'RJ'],
  cities: ['São Paulo', 'Campinas', 'Rio de Janeiro'],
  ceps: ['01310-100', '04538-133', '05422-000'],
  rating: 4,
  memberSince: 'mar/2025',
}

export const MOCK_MARKET_ORDERS: MarketOrder[] = [
  {
    id: 'mkt-001',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    totalOffers: 3,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-002',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: true,
    myOffer: { price: 24500, deliveryDays: 2 },
    status: 'ofertado',
  },
  {
    id: 'mkt-003',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-004',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerCity: 'Niterói',
    buyerState: 'RJ',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    totalOffers: 2,
    offeredByMe: true,
    myOffer: { price: 18900, deliveryDays: 3, note: 'Inclui frete' },
    status: 'ofertado',
  },
  {
    id: 'mkt-005',
    product: 'Babysec Premium M',
    quantity: 60,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    totalOffers: 5,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'mkt-006',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerCity: 'Santos',
    buyerState: 'SP',
    createdAt: '2026-04-30T10:00:00Z',
    totalOffers: 4,
    offeredByMe: true,
    myOffer: { price: 31200, deliveryDays: 2 },
    status: 'encerrado',
  },
]

export const MOCK_DIRECT_ORDERS: DirectOrder[] = [
  {
    id: 'dir-001',
    product: 'Pampers Supersec G',
    quantity: 48,
    unit: 'un',
    price: 31200,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    status: 'aguardando',
  },
  {
    id: 'dir-002',
    product: 'Huggies Mega Suave M',
    quantity: 1,
    unit: 'cx',
    price: 8990,
    buyerCity: 'Guarulhos',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'aguardando',
  },
  {
    id: 'dir-003',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    price: 10500,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    status: 'confirmado',
  },
  {
    id: 'dir-004',
    product: 'Cremer PP',
    quantity: 3,
    unit: 'cx',
    price: 22800,
    buyerCity: 'Campinas',
    buyerState: 'SP',
    createdAt: '2026-04-28T09:00:00Z',
    status: 'cancelado',
  },
]

export const MOCK_OFFERS: SupplierOffer[] = [
  {
    id: 'sof-001',
    orderId: 'mkt-006',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerCity: 'Santos',
    buyerState: 'SP',
    price: 31200,
    deliveryDays: 2,
    status: 'aceita',
    createdAt: '2026-04-30T11:00:00Z',
  },
  {
    id: 'sof-002',
    orderId: 'mkt-002',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerCity: 'Campinas',
    buyerState: 'SP',
    price: 24500,
    deliveryDays: 2,
    status: 'enviada',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'sof-003',
    orderId: 'mkt-004',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerCity: 'Niterói',
    buyerState: 'RJ',
    price: 18900,
    deliveryDays: 3,
    note: 'Inclui frete',
    status: 'enviada',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
  {
    id: 'sof-004',
    orderId: 'mkt-099',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 15600,
    deliveryDays: 1,
    status: 'recusada',
    createdAt: '2026-05-10T14:00:00Z',
  },
  {
    id: 'sof-005',
    orderId: 'mkt-098',
    product: 'Turma da Mônica M',
    quantity: 50,
    unit: 'un',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    price: 42500,
    deliveryDays: 3,
    status: 'expirada',
    createdAt: '2026-05-05T10:00:00Z',
  },
]
