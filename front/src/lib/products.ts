// src/lib/products.ts

export type Brand = 'Pampers' | 'Huggies' | 'MamyPoko' | 'Turma da Mônica' | 'Cremer'
export type Size = 'RN' | 'P' | 'M' | 'G' | 'GG' | 'XXG'
export type Badge = 'Mais vendido' | 'Oferta' | 'Novidade'

export interface Product {
  id: string
  name: string
  brand: Brand
  size: Size
  quantity: number
  priceInCents: number
  supplierId: string
  badge?: Badge
}

export const PRODUCTS: Product[] = [
  // Pampers (5) — distribuidas entre sup-001 (3) e sup-002 (2)
  { id: 'p1', name: 'Supersec Pants', brand: 'Pampers', size: 'P',  quantity: 36, priceInCents: 1800, supplierId: 'sup-001', badge: 'Mais vendido' },
  { id: 'p2', name: 'Supersec Pants', brand: 'Pampers', size: 'M',  quantity: 32, priceInCents: 2200, supplierId: 'sup-001' },
  { id: 'p3', name: 'Supersec Pants', brand: 'Pampers', size: 'G',  quantity: 28, priceInCents: 2600, supplierId: 'sup-001' },
  { id: 'p4', name: 'Premium Care',   brand: 'Pampers', size: 'RN', quantity: 40, priceInCents: 2400, supplierId: 'sup-002', badge: 'Novidade' },
  { id: 'p5', name: 'Premium Care',   brand: 'Pampers', size: 'GG', quantity: 24, priceInCents: 3200, supplierId: 'sup-002' },
  // Huggies (5) — distribuidas entre sup-002 (3) e sup-003 (2)
  { id: 'h1', name: 'Supreme Care',   brand: 'Huggies', size: 'P',   quantity: 36, priceInCents: 2000, supplierId: 'sup-002' },
  { id: 'h2', name: 'Supreme Care',   brand: 'Huggies', size: 'M',   quantity: 32, priceInCents: 2500, supplierId: 'sup-002', badge: 'Mais vendido' },
  { id: 'h3', name: 'Supreme Care',   brand: 'Huggies', size: 'G',   quantity: 28, priceInCents: 2900, supplierId: 'sup-003' },
  { id: 'h4', name: 'Natural Fit',    brand: 'Huggies', size: 'GG',  quantity: 24, priceInCents: 3400, supplierId: 'sup-003' },
  { id: 'h5', name: 'Natural Fit',    brand: 'Huggies', size: 'XXG', quantity: 20, priceInCents: 3800, supplierId: 'sup-003', badge: 'Novidade' },
  // MamyPoko (5) — distribuidas entre sup-001 (2) e sup-004 (3)
  { id: 'm1', name: 'Pants Premium',  brand: 'MamyPoko', size: 'P',   quantity: 40, priceInCents: 1600, supplierId: 'sup-001', badge: 'Oferta' },
  { id: 'm2', name: 'Pants Premium',  brand: 'MamyPoko', size: 'M',   quantity: 36, priceInCents: 2000, supplierId: 'sup-004' },
  { id: 'm3', name: 'Pants Premium',  brand: 'MamyPoko', size: 'G',   quantity: 32, priceInCents: 2400, supplierId: 'sup-004', badge: 'Oferta' },
  { id: 'm4', name: 'Air Fit',        brand: 'MamyPoko', size: 'GG',  quantity: 28, priceInCents: 2800, supplierId: 'sup-004' },
  { id: 'm5', name: 'Air Fit',        brand: 'MamyPoko', size: 'XXG', quantity: 24, priceInCents: 3200, supplierId: 'sup-004' },
  // Turma da Mônica (5) — distribuidas entre sup-001 (1) e sup-003 (4)
  { id: 't1', name: 'Baby',           brand: 'Turma da Mônica', size: 'RN', quantity: 40, priceInCents: 1400, supplierId: 'sup-001' },
  { id: 't2', name: 'Baby',           brand: 'Turma da Mônica', size: 'P',  quantity: 36, priceInCents: 1700, supplierId: 'sup-003', badge: 'Mais vendido' },
  { id: 't3', name: 'Baby',           brand: 'Turma da Mônica', size: 'M',  quantity: 32, priceInCents: 2100, supplierId: 'sup-003' },
  { id: 't4', name: 'Confort',        brand: 'Turma da Mônica', size: 'G',  quantity: 28, priceInCents: 2500, supplierId: 'sup-003' },
  { id: 't5', name: 'Confort',        brand: 'Turma da Mônica', size: 'GG', quantity: 24, priceInCents: 2900, supplierId: 'sup-003' },
  // Cremer (4) — distribuidas entre sup-001 (1) e sup-002 (3)
  { id: 'c1', name: 'Naturali',       brand: 'Cremer', size: 'RN', quantity: 40, priceInCents: 1300, supplierId: 'sup-001', badge: 'Oferta' },
  { id: 'c2', name: 'Naturali',       brand: 'Cremer', size: 'P',  quantity: 36, priceInCents: 1600, supplierId: 'sup-002' },
  { id: 'c3', name: 'Naturali',       brand: 'Cremer', size: 'M',  quantity: 32, priceInCents: 2000, supplierId: 'sup-002' },
  { id: 'c4', name: 'Protect',        brand: 'Cremer', size: 'G',  quantity: 28, priceInCents: 2400, supplierId: 'sup-002' },
]

const PER_PAGE = 12

export interface ProductFilters {
  search: string
  brand: string
  size: string
  sort: string
  page: number
}

export function filterProducts(
  products: Product[],
  filters: ProductFilters
): { items: Product[]; total: number; totalPages: number } {
  let result = [...products]

  // Busca por texto
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
    )
  }

  // Filtro por marca
  if (filters.brand && filters.brand !== 'todos') {
    result = result.filter((p) => p.brand === filters.brand)
  }

  // Filtro por tamanho
  if (filters.size && filters.size !== 'todos') {
    result = result.filter((p) => p.size === filters.size)
  }

  // Ordenação
  if (filters.sort === 'preco-asc') {
    result.sort((a, b) => a.priceInCents - b.priceInCents)
  } else if (filters.sort === 'preco-desc') {
    result.sort((a, b) => b.priceInCents - a.priceInCents)
  } else if (filters.sort === 'mais-vendido') {
    result.sort((a, b) =>
      a.badge === 'Mais vendido' ? -1 : b.badge === 'Mais vendido' ? 1 : 0
    )
  } else if (filters.sort === 'novidade') {
    result.sort((a, b) =>
      a.badge === 'Novidade' ? -1 : b.badge === 'Novidade' ? 1 : 0
    )
  }

  const total = result.length
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const safePage = Math.min(Math.max(1, filters.page), totalPages)
  const start = (safePage - 1) * PER_PAGE
  const items = result.slice(start, start + PER_PAGE)

  return { items, total, totalPages }
}
