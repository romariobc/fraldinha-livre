// src/lib/products.ts

export type Brand = string
export type Size = string
export type Badge = string
export type ProductCategory = string

export interface ProductAtributos {
  faixaPeso: string        // ex.: "5–9 kg" (mapeado por tamanho)
  genero: string           // ex.: "unissex" (fraldas são unissex; tipo deixa espaço para variar no futuro)
  absorcao: string         // ex.: "até 12 horas"
  tecnologia: string       // ex.: "camada seca antivazamento"
  erpId?: string           // Código ERP ou SKU interno do fornecedor
}

export interface Product {
  id: string
  name: string
  brand: Brand
  size: Size
  quantity: number
  priceInCents: number
  supplierId: string
  slug: string
  categoria: ProductCategory
  descricao: string
  atributos: ProductAtributos
  badge?: Badge
  imageUrl?: string
}

export const PRODUCTS: Product[] = []

const PER_PAGE = 12

export interface ProductFilters {
  search: string
  brand: string
  size: string
  sort: string
  page: number
  supplierId?: string
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

  // Filtro por fornecedor
  if (filters.supplierId) {
    result = result.filter((p) => p.supplierId === filters.supplierId)
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

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}
