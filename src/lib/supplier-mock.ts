// ─── New types ────────────────────────────────────────────────────────────────

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

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MockSupplier {
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

export type DirectOrderStatus = 'aguardando' | 'confirmado' | 'cancelado'

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
  dispatchStatus?: DispatchStatus
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
  createdAt: string
  dispatchStatus?: DispatchStatus
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
  const masked = cnpj.replace(
    /^(\d{2})\.(\d{3}\.\d{3}\/\d{4})-(\d{2})$/,
    (_, _a, mid, _c) => `***.${mid}-**`
  )
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
  neighborhood: 'Bela Vista',
  zip: '01310-100',
}

export const MOCK_MARKET_ORDERS: MarketOrder[] = [
  // ── Same neighborhood (Bela Vista, zip 013xx) ─────────────────────────────
  {
    id: 'MKT-0041',
    product: 'Pampers Supersec M',
    quantity: 32,
    unit: 'un',
    buyerName: 'Clínica Bem Cuidar',
    buyerCnpj: '12.345.678/0001-90',
    buyerStreet: 'Av. Paulista, 1000',
    buyerNeighborhood: 'Bela Vista',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01310-100',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    totalOffers: 3,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0038',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerName: 'Revendas Baby SP',
    buyerCnpj: '98.765.432/0001-10',
    buyerStreet: 'R. Consolação, 500',
    buyerNeighborhood: 'Bela Vista',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01301-000',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: true,
    myOffer: { price: 24500, deliveryType: { kind: 'delivery', maxHours: 2 } },
    status: 'ofertado',
  },
  // ── Within 5km radius (CEP prefix '013', different neighborhood) ──────────
  {
    id: 'MKT-0035',
    product: 'Turma da Mônica P',
    quantity: 2,
    unit: 'cx',
    buyerName: 'Farmácia Central',
    buyerCnpj: '55.123.456/0001-44',
    buyerStreet: 'R. Augusta, 300',
    buyerNeighborhood: 'Consolação',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01305-100',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    totalOffers: 0,
    offeredByMe: false,
    status: 'aberto',
  },
  // ── Within 10km radius (CEP prefix '01', not '013') ───────────────────────
  {
    id: 'MKT-0029',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerName: 'Hospital Infantil SP',
    buyerCnpj: '11.222.333/0001-55',
    buyerStreet: 'Av. Rebouças, 1200',
    buyerNeighborhood: 'Jardins',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    buyerZip: '01426-000',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    totalOffers: 2,
    offeredByMe: true,
    myOffer: { price: 18900, deliveryType: { kind: 'days', count: 3 }, note: 'Inclui frete' },
    status: 'ofertado',
  },
  // ── National — other states ───────────────────────────────────────────────
  {
    id: 'MKT-0021',
    product: 'Babysec Premium M',
    quantity: 60,
    unit: 'un',
    buyerName: 'Rede Baby RJ',
    buyerCnpj: '77.888.999/0001-00',
    buyerStreet: 'Av. Rio Branco, 200',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    buyerZip: '20040-020',
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    totalOffers: 5,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0015',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerName: 'Distribuidora Norte',
    buyerCnpj: '22.333.444/0001-88',
    buyerStreet: 'R. Principal, 100',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Manaus',
    buyerState: 'AM',
    buyerZip: '69005-000',
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    totalOffers: 0,
    offeredByMe: false,
    status: 'aberto',
  },
  {
    id: 'MKT-0012',
    product: 'Huggies Natural Care G',
    quantity: 48,
    unit: 'un',
    buyerName: 'Clínica Materno Infantil',
    buyerCnpj: '44.555.666/0001-11',
    buyerStreet: 'Av. Beira Mar, 500',
    buyerNeighborhood: 'Meireles',
    buyerCity: 'Fortaleza',
    buyerState: 'CE',
    buyerZip: '60165-000',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    totalOffers: 1,
    offeredByMe: false,
    status: 'aberto',
  },
  // ── Encerrado ─────────────────────────────────────────────────────────────
  {
    id: 'MKT-0018',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerName: 'Atacado Santos',
    buyerCnpj: '33.444.555/0001-77',
    buyerStreet: 'R. Do Porto, 50',
    buyerNeighborhood: 'Centro',
    buyerCity: 'Santos',
    buyerState: 'SP',
    buyerZip: '11013-000',
    createdAt: '2026-04-30T10:00:00Z',
    totalOffers: 4,
    offeredByMe: true,
    myOffer: { price: 31200, deliveryType: { kind: 'days', count: 2 } },
    status: 'encerrado',
  },
]

export const MOCK_DIRECT_ORDERS: DirectOrder[] = [
  {
    id: 'DIR-0031',
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
    id: 'DIR-0028',
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
    id: 'DIR-0022',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    price: 10500,
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    createdAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    status: 'confirmado',
    dispatchStatus: 'em_preparo',
  },
  {
    id: 'DIR-0015',
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
    orderId: 'MKT-0018',
    product: 'MamyPoko Pants G',
    quantity: 40,
    unit: 'un',
    buyerName: 'Atacado Santos',
    buyerCity: 'Santos',
    buyerState: 'SP',
    price: 31200,
    deliveryType: { kind: 'days', count: 2 },
    status: 'aceita',
    createdAt: '2026-04-30T11:00:00Z',
    dispatchStatus: 'despachado',
  },
  {
    id: 'sof-002',
    orderId: 'MKT-0038',
    product: 'Huggies Supreme G',
    quantity: 28,
    unit: 'un',
    buyerName: 'Revendas Baby SP',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 24500,
    deliveryType: { kind: 'delivery', maxHours: 2 },
    status: 'enviada',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'sof-003',
    orderId: 'MKT-0029',
    product: 'Cremer XG',
    quantity: 20,
    unit: 'un',
    buyerName: 'Hospital Infantil SP',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 18900,
    deliveryType: { kind: 'days', count: 3 },
    note: 'Inclui frete',
    status: 'enviada',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
  {
    id: 'sof-004',
    orderId: 'MKT-0099',
    product: 'Pampers Confort Sec P',
    quantity: 24,
    unit: 'un',
    buyerName: 'Clínica Bem Cuidar',
    buyerCity: 'São Paulo',
    buyerState: 'SP',
    price: 15600,
    deliveryType: { kind: 'days', count: 1 },
    status: 'recusada',
    createdAt: '2026-05-10T14:00:00Z',
  },
  {
    id: 'sof-005',
    orderId: 'MKT-0098',
    product: 'Turma da Mônica M',
    quantity: 50,
    unit: 'un',
    buyerName: 'Rede Baby RJ',
    buyerCity: 'Rio de Janeiro',
    buyerState: 'RJ',
    price: 42500,
    deliveryType: { kind: 'to_arrange' },
    status: 'expirada',
    createdAt: '2026-05-05T10:00:00Z',
  },
]
