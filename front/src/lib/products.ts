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
  price: number
  badge?: Badge
}

export const PRODUCTS: Product[] = [
  // Pampers (5)
  { id: 'p1', name: 'Supersec Pants', brand: 'Pampers', size: 'P',  quantity: 36, price: 18, badge: 'Mais vendido' },
  { id: 'p2', name: 'Supersec Pants', brand: 'Pampers', size: 'M',  quantity: 32, price: 22 },
  { id: 'p3', name: 'Supersec Pants', brand: 'Pampers', size: 'G',  quantity: 28, price: 26 },
  { id: 'p4', name: 'Premium Care',   brand: 'Pampers', size: 'RN', quantity: 40, price: 24, badge: 'Novidade' },
  { id: 'p5', name: 'Premium Care',   brand: 'Pampers', size: 'GG', quantity: 24, price: 32 },
  // Huggies (5)
  { id: 'h1', name: 'Supreme Care',   brand: 'Huggies', size: 'P',   quantity: 36, price: 20 },
  { id: 'h2', name: 'Supreme Care',   brand: 'Huggies', size: 'M',   quantity: 32, price: 25, badge: 'Mais vendido' },
  { id: 'h3', name: 'Supreme Care',   brand: 'Huggies', size: 'G',   quantity: 28, price: 29 },
  { id: 'h4', name: 'Natural Fit',    brand: 'Huggies', size: 'GG',  quantity: 24, price: 34 },
  { id: 'h5', name: 'Natural Fit',    brand: 'Huggies', size: 'XXG', quantity: 20, price: 38, badge: 'Novidade' },
  // MamyPoko (5)
  { id: 'm1', name: 'Pants Premium',  brand: 'MamyPoko', size: 'P',   quantity: 40, price: 16, badge: 'Oferta' },
  { id: 'm2', name: 'Pants Premium',  brand: 'MamyPoko', size: 'M',   quantity: 36, price: 20 },
  { id: 'm3', name: 'Pants Premium',  brand: 'MamyPoko', size: 'G',   quantity: 32, price: 24, badge: 'Oferta' },
  { id: 'm4', name: 'Air Fit',        brand: 'MamyPoko', size: 'GG',  quantity: 28, price: 28 },
  { id: 'm5', name: 'Air Fit',        brand: 'MamyPoko', size: 'XXG', quantity: 24, price: 32 },
  // Turma da Mônica (5)
  { id: 't1', name: 'Baby',           brand: 'Turma da Mônica', size: 'RN', quantity: 40, price: 14 },
  { id: 't2', name: 'Baby',           brand: 'Turma da Mônica', size: 'P',  quantity: 36, price: 17, badge: 'Mais vendido' },
  { id: 't3', name: 'Baby',           brand: 'Turma da Mônica', size: 'M',  quantity: 32, price: 21 },
  { id: 't4', name: 'Confort',        brand: 'Turma da Mônica', size: 'G',  quantity: 28, price: 25 },
  { id: 't5', name: 'Confort',        brand: 'Turma da Mônica', size: 'GG', quantity: 24, price: 29 },
  // Cremer (4)
  { id: 'c1', name: 'Naturali',       brand: 'Cremer', size: 'RN', quantity: 40, price: 13, badge: 'Oferta' },
  { id: 'c2', name: 'Naturali',       brand: 'Cremer', size: 'P',  quantity: 36, price: 16 },
  { id: 'c3', name: 'Naturali',       brand: 'Cremer', size: 'M',  quantity: 32, price: 20 },
  { id: 'c4', name: 'Protect',        brand: 'Cremer', size: 'G',  quantity: 28, price: 24 },
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
    result.sort((a, b) => a.price - b.price)
  } else if (filters.sort === 'preco-desc') {
    result.sort((a, b) => b.price - a.price)
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
