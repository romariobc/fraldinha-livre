// src/lib/products.ts

export type Brand = 'Pampers' | 'Huggies' | 'MamyPoko' | 'Turma da Mônica' | 'Cremer'
export type Size = 'RN' | 'P' | 'M' | 'G' | 'GG' | 'XXG'
export type Badge = 'Mais vendido' | 'Oferta' | 'Novidade'

// Categoria do produto. Hoje o catálogo é 100% fraldas; o tipo deixa espaço para expandir
// (mães/bebês/cuidados/wellness) sem quebrar consumidores. RN-02.
export type ProductCategory = 'fraldas-descartaveis'

export interface ProductAtributos {
  faixaPeso: string        // ex.: "5–9 kg" (mapeado por tamanho)
  genero: 'unissex'        // fraldas são unissex; tipo deixa espaço para variar no futuro
  absorcao: string         // ex.: "até 12 horas"
  tecnologia: string       // ex.: "camada seca antivazamento"
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
}

// UCP (User Capability Profiles): Aqui entraria um descriptor estruturado { schema, capabilities }
// para descoberta por agentes (ex.: busca por capacidade de absorção, faixa de peso, marca).
// Não implementar agora — marcado como ponto de extensão para fase de discovery.

export const PRODUCTS: Product[] = [
  // Pampers (5) — distribuidas entre sup-001 (3) e sup-002 (2)
  { id: 'p1', name: 'Supersec Pants', brand: 'Pampers', size: 'P',  quantity: 36, priceInCents: 1800, supplierId: 'sup-001', slug: 'pampers-supersec-pants-p', categoria: 'fraldas-descartaveis', descricao: 'Fralda Pampers Supersec Pants tamanho P com proteção de até 12 horas. Ideal para bebês em fase de mobilidade.', atributos: { faixaPeso: '3–6 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada seca antivazamento' }, badge: 'Mais vendido' },
  { id: 'p2', name: 'Supersec Pants', brand: 'Pampers', size: 'M',  quantity: 32, priceInCents: 2200, supplierId: 'sup-001', slug: 'pampers-supersec-pants-m', categoria: 'fraldas-descartaveis', descricao: 'Fralda Pampers Supersec Pants tamanho M com tecnologia de camada seca e proteção antivazamento para bebês em crescimento.', atributos: { faixaPeso: '5–9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada seca antivazamento' } },
  { id: 'p3', name: 'Supersec Pants', brand: 'Pampers', size: 'G',  quantity: 28, priceInCents: 2600, supplierId: 'sup-001', slug: 'pampers-supersec-pants-g', categoria: 'fraldas-descartaveis', descricao: 'Fralda Pampers Supersec Pants tamanho G oferece conforto e proteção para bebês maiores com até 12 horas de absorção.', atributos: { faixaPeso: '9–12,5 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada seca antivazamento' } },
  { id: 'p4', name: 'Premium Care',   brand: 'Pampers', size: 'RN', quantity: 40, priceInCents: 2400, supplierId: 'sup-002', slug: 'pampers-premium-care-rn', categoria: 'fraldas-descartaveis', descricao: 'Fralda Pampers Premium Care tamanho RN especialmente desenvolvida para recém-nascidos com máxima maciez e proteção.', atributos: { faixaPeso: 'ate 4 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'tecnologia de gel super absorvente' }, badge: 'Novidade' },
  { id: 'p5', name: 'Premium Care',   brand: 'Pampers', size: 'GG', quantity: 24, priceInCents: 3200, supplierId: 'sup-002', slug: 'pampers-premium-care-gg', categoria: 'fraldas-descartaveis', descricao: 'Fralda Pampers Premium Care tamanho GG com máxima absorção e conforto para bebês maiores até 15 kg.', atributos: { faixaPeso: '12–15 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'tecnologia de gel super absorvente' } },
  // Huggies (5) — distribuidas entre sup-002 (3) e sup-003 (2)
  { id: 'h1', name: 'Supreme Care',   brand: 'Huggies', size: 'P',   quantity: 36, priceInCents: 2000, supplierId: 'sup-002', slug: 'huggies-supreme-care-p', categoria: 'fraldas-descartaveis', descricao: 'Fralda Huggies Supreme Care tamanho P com toque suave e proteção por até 12 horas para bebês pequenos.', atributos: { faixaPeso: '3–6 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'toque suave com aloe' } },
  { id: 'h2', name: 'Supreme Care',   brand: 'Huggies', size: 'M',   quantity: 32, priceInCents: 2500, supplierId: 'sup-002', slug: 'huggies-supreme-care-m', categoria: 'fraldas-descartaveis', descricao: 'Fralda Huggies Supreme Care tamanho M oferece conforto superior com ingredientes suaves para pele sensível.', atributos: { faixaPeso: '5–9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'toque suave com aloe' }, badge: 'Mais vendido' },
  { id: 'h3', name: 'Supreme Care',   brand: 'Huggies', size: 'G',   quantity: 28, priceInCents: 2900, supplierId: 'sup-003', slug: 'huggies-supreme-care-g', categoria: 'fraldas-descartaveis', descricao: 'Fralda Huggies Supreme Care tamanho G mantém a pele macia e protegida por até 12 horas durante o dia.', atributos: { faixaPeso: '9–12,5 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'toque suave com aloe' } },
  { id: 'h4', name: 'Natural Fit',    brand: 'Huggies', size: 'GG',  quantity: 24, priceInCents: 3400, supplierId: 'sup-003', slug: 'huggies-natural-fit-gg', categoria: 'fraldas-descartaveis', descricao: 'Fralda Huggies Natural Fit tamanho GG com formato anatômico e máxima proteção para bebês em crescimento.', atributos: { faixaPeso: '12–15 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'formato anatomico natural' } },
  { id: 'h5', name: 'Natural Fit',    brand: 'Huggies', size: 'XXG', quantity: 20, priceInCents: 3800, supplierId: 'sup-003', slug: 'huggies-natural-fit-xxg', categoria: 'fraldas-descartaveis', descricao: 'Fralda Huggies Natural Fit tamanho XXG para crianças maiores com conforto duradouro e proteção confiável.', atributos: { faixaPeso: 'acima de 14 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'formato anatomico natural' }, badge: 'Novidade' },
  // MamyPoko (5) — distribuidas entre sup-001 (2) e sup-004 (3)
  { id: 'm1', name: 'Pants Premium',  brand: 'MamyPoko', size: 'P',   quantity: 40, priceInCents: 1600, supplierId: 'sup-001', slug: 'mamypoko-pants-premium-p', categoria: 'fraldas-descartaveis', descricao: 'Fralda MamyPoko Pants Premium tamanho P com absorção de até 12 horas e cintura elástica para melhor ajuste.', atributos: { faixaPeso: '3–6 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'cintura elastica com abas laterais' }, badge: 'Oferta' },
  { id: 'm2', name: 'Pants Premium',  brand: 'MamyPoko', size: 'M',   quantity: 36, priceInCents: 2000, supplierId: 'sup-004', slug: 'mamypoko-pants-premium-m', categoria: 'fraldas-descartaveis', descricao: 'Fralda MamyPoko Pants Premium tamanho M combina qualidade e economia para bebês em desenvolvimento.', atributos: { faixaPeso: '5–9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'cintura elastica com abas laterais' } },
  { id: 'm3', name: 'Pants Premium',  brand: 'MamyPoko', size: 'G',   quantity: 32, priceInCents: 2400, supplierId: 'sup-004', slug: 'mamypoko-pants-premium-g', categoria: 'fraldas-descartaveis', descricao: 'Fralda MamyPoko Pants Premium tamanho G oferece melhor custo-benefício sem abrir mão da proteção.', atributos: { faixaPeso: '9–12,5 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'cintura elastica com abas laterais' }, badge: 'Oferta' },
  { id: 'm4', name: 'Air Fit',        brand: 'MamyPoko', size: 'GG',  quantity: 28, priceInCents: 2800, supplierId: 'sup-004', slug: 'mamypoko-air-fit-gg', categoria: 'fraldas-descartaveis', descricao: 'Fralda MamyPoko Air Fit tamanho GG com respirabilidade e conforto para bebês maiores.', atributos: { faixaPeso: '12–15 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'ventilacao air fit' } },
  { id: 'm5', name: 'Air Fit',        brand: 'MamyPoko', size: 'XXG', quantity: 24, priceInCents: 3200, supplierId: 'sup-004', slug: 'mamypoko-air-fit-xxg', categoria: 'fraldas-descartaveis', descricao: 'Fralda MamyPoko Air Fit tamanho XXG com ventilação superior para máximo conforto em bebês maiores.', atributos: { faixaPeso: 'acima de 14 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'ventilacao air fit' } },
  // Turma da Mônica (5) — distribuidas entre sup-001 (1) e sup-003 (4)
  { id: 't1', name: 'Baby',           brand: 'Turma da Mônica', size: 'RN', quantity: 40, priceInCents: 1400, supplierId: 'sup-001', slug: 'turma-da-monica-baby-rn', categoria: 'fraldas-descartaveis', descricao: 'Fralda Turma da Mônica Baby tamanho RN delicada com proteção especial para a pele sensível do recém-nascido.', atributos: { faixaPeso: 'ate 4 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada macia e respiravel' } },
  { id: 't2', name: 'Baby',           brand: 'Turma da Mônica', size: 'P',  quantity: 36, priceInCents: 1700, supplierId: 'sup-003', slug: 'turma-da-monica-baby-p', categoria: 'fraldas-descartaveis', descricao: 'Fralda Turma da Mônica Baby tamanho P com personagens divertidos que tornam a troca mais agradável.', atributos: { faixaPeso: '3–6 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada macia e respiravel' }, badge: 'Mais vendido' },
  { id: 't3', name: 'Baby',           brand: 'Turma da Mônica', size: 'M',  quantity: 32, priceInCents: 2100, supplierId: 'sup-003', slug: 'turma-da-monica-baby-m', categoria: 'fraldas-descartaveis', descricao: 'Fralda Turma da Mônica Baby tamanho M combina proteção confiável com personagens icônicos que bebês adoram.', atributos: { faixaPeso: '5–9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'camada macia e respiravel' } },
  { id: 't4', name: 'Confort',        brand: 'Turma da Mônica', size: 'G',  quantity: 28, priceInCents: 2500, supplierId: 'sup-003', slug: 'turma-da-monica-confort-g', categoria: 'fraldas-descartaveis', descricao: 'Fralda Turma da Mônica Confort tamanho G com máxima absorção e conforto para bebês em movimento.', atributos: { faixaPeso: '9–12,5 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'protecao extra confort' } },
  { id: 't5', name: 'Confort',        brand: 'Turma da Mônica', size: 'GG', quantity: 24, priceInCents: 2900, supplierId: 'sup-003', slug: 'turma-da-monica-confort-gg', categoria: 'fraldas-descartaveis', descricao: 'Fralda Turma da Mônica Confort tamanho GG oferece proteção segura e confortável para crianças em crescimento.', atributos: { faixaPeso: '12–15 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'protecao extra confort' } },
  // Cremer (4) — distribuidas entre sup-001 (1) e sup-002 (3)
  { id: 'c1', name: 'Naturali',       brand: 'Cremer', size: 'RN', quantity: 40, priceInCents: 1300, supplierId: 'sup-001', slug: 'cremer-naturali-rn', categoria: 'fraldas-descartaveis', descricao: 'Fralda Cremer Naturali tamanho RN com ingredientes naturais para pele sensível de recém-nascidos.', atributos: { faixaPeso: 'ate 4 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'material natural respiravel' }, badge: 'Oferta' },
  { id: 'c2', name: 'Naturali',       brand: 'Cremer', size: 'P',  quantity: 36, priceInCents: 1600, supplierId: 'sup-002', slug: 'cremer-naturali-p', categoria: 'fraldas-descartaveis', descricao: 'Fralda Cremer Naturali tamanho P com composição natural e proteção eficaz para bebês pequenos.', atributos: { faixaPeso: '3–6 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'material natural respiravel' } },
  { id: 'c3', name: 'Naturali',       brand: 'Cremer', size: 'M',  quantity: 32, priceInCents: 2000, supplierId: 'sup-002', slug: 'cremer-naturali-m', categoria: 'fraldas-descartaveis', descricao: 'Fralda Cremer Naturali tamanho M escolha de pais que preferem ingredientes naturais para seus bebês.', atributos: { faixaPeso: '5–9 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'material natural respiravel' } },
  { id: 'c4', name: 'Protect',        brand: 'Cremer', size: 'G',  quantity: 28, priceInCents: 2400, supplierId: 'sup-002', slug: 'cremer-protect-g', categoria: 'fraldas-descartaveis', descricao: 'Fralda Cremer Protect tamanho G oferece proteção intensiva e conforto para bebês maiores.', atributos: { faixaPeso: '9–12,5 kg', genero: 'unissex', absorcao: 'ate 12 horas', tecnologia: 'barreira protecao intensiva' } },
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

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}
