'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-10" aria-label="Paginação">
      {/* Anterior */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Página anterior"
      >
        <ChevronLeft size={16} />
        Anterior
      </button>

      {/* Números */}
      <div className="flex items-center gap-1">
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-brand-muted text-sm">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`w-9 h-9 rounded-full text-sm font-bold transition-colors ${
                page === currentPage
                  ? 'bg-primary text-white'
                  : 'text-brand-muted hover:bg-primary-light hover:text-primary-dark'
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* Próximo */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Próxima página"
      >
        Próximo
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
