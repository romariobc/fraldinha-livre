'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Product } from '@contracts'
import { Search, RefreshCw, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { showErrorToast } from '@/lib/frontend-diagnostics'

const PAGE_SIZE = 10

export default function AdminProductsTab() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/products?scope=admin')
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error('Falha na resposta')
        const data = (await res.json()) as Product[]
        setProducts(data)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erro ao carregar produtos.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && p.active) ||
        (statusFilter === 'inativos' && !p.active)
      const matchSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.supplierId && p.supplierId.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [products, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredProducts.slice(start, start + PAGE_SIZE)
  }, [filteredProducts, currentPage])

  const moderateProduct = async () => {
    if (!selectedProduct || reason.trim().length < 5 || submitting) return
    setSubmitting(true)
    try {
      const response = await apiFetch(`/admin/products/${selectedProduct.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !selectedProduct.active, reason: reason.trim() }),
      })
      const body = (await response.json()) as { product: Product }
      setProducts(
        (current) =>
          current?.map((product) => (product.id === body.product.id ? body.product : product)) ?? current,
      )
      setSelectedProduct(null)
      setReason('')
    } catch (cause) {
      showErrorToast(cause, { operation: 'admin.products.moderate' })
    } finally {
      setSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-red-600 font-medium mb-3">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true)
            setError(null)
            setRefreshKey((k) => k + 1)
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (loading && !products) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-brand-muted">
        <RefreshCw size={24} className="animate-spin mb-3 text-primary" />
        <p>Carregando produtos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="admin-products-tab">
      {/* Top Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted" />
            <Input
              type="text"
              placeholder="Buscar por nome, marca ou fornecedor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-brand-muted">
            <Filter size={14} />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter)
              setCurrentPage(1)
            }}
            aria-label="Filtrar por status"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-text shadow-sm focus:border-primary focus:outline-none"
          >
            <option value="todos">Todos ({products?.length ?? 0})</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              setRefreshKey((k) => k + 1)
            }}
            disabled={refreshing}
            className="h-8 px-2.5 text-xs flex items-center gap-1"
            title="Recarregar produtos"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Products Count summary */}
      <div className="text-xs text-brand-muted flex justify-between items-center px-0.5">
        <span>
          Mostrando {filteredProducts.length} de {products?.length ?? 0} produto(s)
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">
              <th className="py-2.5 px-3">Nome</th>
              <th className="py-2.5 px-3">Marca</th>
              <th className="py-2.5 px-3">Fornecedor</th>
              <th className="py-2.5 px-3">Preço</th>
              <th className="py-2.5 px-3">Ativo</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="font-medium text-brand-text">{p.name}</div>
                  {p.slug && <div className="text-xs text-brand-muted font-mono">{p.slug}</div>}
                </td>
                <td className="py-2.5 px-3 text-brand-muted text-xs">{p.brand}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-brand-muted">
                  <span title={p.supplierId}>{p.supplierId}</span>
                </td>
                <td className="py-2.5 px-3 font-semibold text-brand-text whitespace-nowrap">
                  R$ {(p.priceCents / 100).toFixed(2)}
                </td>
                <td className="py-2.5 px-3">
                  {p.active ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Sim
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Não
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant={p.active ? 'destructive' : 'outline'}
                    onClick={() => setSelectedProduct(p)}
                    className="h-7 px-2 text-xs"
                  >
                    {p.active ? 'Desativar' : 'Ativar'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-brand-muted">
            <p className="font-medium text-slate-600">Nenhum produto encontrado com os filtros selecionados.</p>
            {(search || statusFilter !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('todos')
                  setCurrentPage(1)
                }}
                className="mt-2 text-xs text-primary-dark hover:underline"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="text-xs h-8"
          >
            Anterior
          </Button>
          <span className="text-xs text-brand-muted">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="text-xs h-8"
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Moderation Dialog */}
      <Dialog
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null)
            setReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProduct?.active ? 'Desativar produto' : 'Ativar produto'}</DialogTitle>
            <DialogDescription>
              Informe uma justificativa para registrar esta ação administrativa na trilha de auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Justificativa (mínimo de 5 caracteres)"
            className="text-sm min-h-[90px]"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedProduct(null)
                setReason('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reason.trim().length < 5 || submitting}
              onClick={() => void moderateProduct()}
            >
              {submitting ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
