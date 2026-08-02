// src/components/catalogo/CatalogFilters.tsx
'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ProductFilters, Brand, Size } from '@/lib/products'

const BRANDS: (Brand | 'todos')[] = ['todos', 'Pampers', 'Huggies', 'MamyPoko', 'Turma da Mônica', 'Cremer']
const SIZES: (Size | 'todos')[] = ['todos', 'RN', 'P', 'M', 'G', 'GG', 'XXG']
const SORT_OPTIONS = [
  { value: '',           label: 'Relevância' },
  { value: 'preco-asc',  label: 'Menor preço' },
  { value: 'preco-desc', label: 'Maior preço' },
  { value: 'mais-vendido', label: 'Mais vendido' },
  { value: 'novidade',   label: 'Novidades' },
]

interface CatalogFiltersProps {
  filters: ProductFilters
  onChange: (key: keyof ProductFilters, value: string) => void
  onClear: () => void
}

function hasActiveFilters(filters: ProductFilters) {
  return filters.search || (filters.brand && filters.brand !== 'todos') || (filters.size && filters.size !== 'todos') || filters.sort
}

function FilterBody({ filters, onChange, onClear }: CatalogFiltersProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Busca */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Buscar</p>
        <Input
          placeholder="Nome ou marca..."
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text text-sm"
        />
      </div>

      {/* Marcas */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Marca</p>
        <div className="flex flex-wrap gap-1.5">
          {BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => onChange('brand', b)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                (filters.brand || 'todos') === b
                  ? 'bg-primary text-white'
                  : 'bg-brand-bg text-brand-muted hover:bg-primary-light hover:text-primary-dark'
              }`}
            >
              {b === 'todos' ? 'Todas' : b}
            </button>
          ))}
        </div>
      </div>

      {/* Tamanhos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Tamanho</p>
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => onChange('size', s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                (filters.size || 'todos') === s
                  ? 'bg-primary text-white'
                  : 'bg-brand-bg text-brand-muted hover:bg-primary-light hover:text-primary-dark'
              }`}
            >
              {s === 'todos' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Ordenação */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Ordenar por</p>
        <div className="flex flex-col gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange('sort', opt.value)}
              className={`text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filters.sort === opt.value
                  ? 'bg-primary-light text-primary-dark'
                  : 'text-brand-muted hover:bg-brand-bg'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Limpar */}
      {hasActiveFilters(filters) && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-primary-dark transition-colors"
        >
          <X size={14} />
          Limpar filtros
        </button>
      )}
    </div>
  )
}

// Sidebar fixa para telas lg+ (1024px+). Renderizar no máximo 1x por página —
// já cuida da própria visibilidade via `hidden lg:block`, mas o componente
// não sabe se está sendo renderizado em duplicidade em outro lugar da página.
export function CatalogFiltersDesktopSidebar({ filters, onChange, onClear }: CatalogFiltersProps) {
  return (
    <aside className="hidden lg:block w-[280px] flex-shrink-0">
      <div className="bg-white rounded-card shadow-card p-6 sticky top-24">
        <p className="font-display font-extrabold text-base text-brand-text mb-6">Filtros</p>
        <FilterBody filters={filters} onChange={onChange} onClear={onClear} />
      </div>
    </aside>
  )
}

// Botão + Sheet (bottom drawer) para telas abaixo de lg. Renderizar no máximo
// 1x por página — mesma ressalva do componente acima.
export function CatalogFiltersMobileTrigger({ filters, onChange, onClear }: CatalogFiltersProps) {
  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger
          render={
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors">
              <SlidersHorizontal size={16} />
              Filtrar
              {hasActiveFilters(filters) && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          }
        />
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-display font-extrabold text-brand-text text-left">
              Filtros
            </SheetTitle>
          </SheetHeader>
          <FilterBody filters={filters} onChange={onChange} onClear={onClear} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
