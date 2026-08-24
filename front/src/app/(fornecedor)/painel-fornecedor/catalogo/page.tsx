'use client'

import * as React from 'react'
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
  Hash,
  Layers,
  Boxes,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AddProductDialog } from '@/components/fornecedor/AddProductDialog'
import { useAuth } from '@/contexts/auth-context'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import { formatPrice } from '@/lib/utils'
import type { Product, UpdateProductRequest } from '@contracts'

export default function CatalogoPage() {
  const { user } = useAuth()
  const repo: ProductRepository = React.useMemo(() => {
    return new HttpProductRepository()
  }, [])

  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'todos' | 'ativos' | 'despublicados'>('todos')
  const [brandFilter, setBrandFilter] = React.useState<string>('todas')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Load supplier products
  const handleReload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await repo.listForSupplier()
      setProducts(list)
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err)
      setError('Não foi possível carregar seu catálogo de produtos.')
    } finally {
      setLoading(false)
    }
  }, [repo])

  React.useEffect(() => {
    let isMounted = true

    repo
      .listForSupplier()
      .then((list) => {
        if (isMounted) {
          setProducts(list)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Erro ao carregar catálogo:', err)
          setError('Não foi possível carregar seu catálogo de produtos.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [repo])

  // Extract unique brands for filter
  const availableBrands = React.useMemo(() => {
    const brands = new Set<string>()
    products.forEach((p) => {
      if (p.brand) brands.add(p.brand)
    })
    return Array.from(brands)
  }, [products])

  // Metrics summary
  const summary = React.useMemo(() => {
    const total = products.length
    const active = products.filter((p) => p.active).length
    const inactive = total - active
    const totalStock = products.reduce((acc, p) => acc + (p.quantity || 0), 0)
    return { total, active, inactive, totalStock }
  }, [products])

  // Filtered products
  const filteredProducts = React.useMemo(() => {
    let list = [...products]

    // Status filter
    if (statusFilter === 'ativos') {
      list = list.filter((p) => p.active)
    } else if (statusFilter === 'despublicados') {
      list = list.filter((p) => !p.active)
    }

    // Brand filter
    if (brandFilter !== 'todas') {
      list = list.filter((p) => p.brand === brandFilter)
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => {
        const erp = p.atributos?.erpId?.toLowerCase() || ''
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.size.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q) ||
          erp.includes(q)
        )
      })
    }

    return list
  }, [products, statusFilter, brandFilter, searchQuery])

  // Actions
  const handleToggleActive = async (product: Product) => {
    try {
      const updateReq: UpdateProductRequest = {
        active: !product.active,
      }
      const updated = await repo.update(product.id, updateReq)
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
      toast.success(
        updated.active
          ? `"${product.name}" foi publicado no marketplace!`
          : `"${product.name}" foi despublicado.`
      )
    } catch (err) {
      console.error('Erro ao alternar status do produto:', err)
      toast.error('Erro ao alterar status de publicação.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!productToDelete) return
    setIsDeleting(true)
    try {
      await repo.remove(productToDelete.id)
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id))
      toast.success(`"${productToDelete.name}" removido do seu catálogo.`)
      setProductToDelete(null)
    } catch (err) {
      console.error('Erro ao excluir produto:', err)
      toast.error('Erro ao remover produto do catálogo.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleProductAdded = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-brand-text flex items-center gap-2.5">
            <Package className="size-6 text-primary-dark" />
            Meu Catálogo
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Gerencie seus produtos vinculados ao Catálogo Mestre, estoque disponível e preços da distribuidora.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white font-semibold flex items-center gap-2 shadow-xs shrink-0"
          data-testid="add-product-button"
        >
          <Plus className="size-4" />
          Adicionar Produto ao Meu Catálogo
        </Button>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary-dark">
            <Boxes className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de Produtos</p>
            <p className="text-xl font-bold font-display text-foreground mt-0.5">
              {summary.total} <span className="text-xs font-normal text-muted-foreground">itens</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Ativos no Marketplace</p>
            <p className="text-xl font-bold font-display text-emerald-700 mt-0.5">
              {summary.active} <span className="text-xs font-normal text-muted-foreground">publicados</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-600">
            <EyeOff className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Despublicados</p>
            <p className="text-xl font-bold font-display text-muted-foreground mt-0.5">
              {summary.inactive} <span className="text-xs font-normal text-muted-foreground">ocultos</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Layers className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estoque Consolidado</p>
            <p className="text-xl font-bold font-display text-blue-700 mt-0.5">
              {summary.totalStock} <span className="text-xs font-normal text-muted-foreground">unidades</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Catalog Section */}
      <Card className="border-border shadow-xs bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Produtos Vinculados à Sua Distribuidora</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Alterne o status de publicação ou atualize o estoque dos seus produtos ofertados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Status tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border w-fit">
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'todos'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos ({summary.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ativos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'ativos'
                    ? 'bg-card text-emerald-700 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ativos ({summary.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('despublicados')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'despublicados'
                    ? 'bg-card text-slate-700 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Despublicados ({summary.inactive})
              </button>
            </div>

            {/* Brand Filter & Search */}
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {availableBrands.length > 0 && (
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="h-9 w-full sm:w-36 rounded-lg border border-input bg-card px-2.5 py-1 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  data-testid="brand-filter-select"
                >
                  <option value="todas">Todas as Marcas</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-60 pointer-events-none" />
                <Input
                  placeholder="Buscar produto, marca, ERP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-card"
                  data-testid="catalog-search-input"
                />
              </div>
            </div>
          </div>

          {/* Product Cards List */}
          {loading ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
              <Clock className="size-8 animate-spin text-primary mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-foreground">Carregando catálogo...</h3>
              <p className="text-xs text-muted-foreground mt-1">Buscando os produtos da sua loja.</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 border border-destructive/20 bg-destructive/5 rounded-xl text-destructive p-4">
              <p className="text-xs font-semibold">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReload}
                className="mt-3 text-xs"
              >
                Tentar Novamente
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
              <Package className="size-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-base font-semibold text-foreground">
                {products.length === 0
                  ? 'Nenhum produto cadastrado ainda'
                  : 'Nenhum produto encontrado com os filtros atuais'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {products.length === 0
                  ? 'Vincule produtos do Catálogo Mestre para começar a vender para milhares de compradores.'
                  : 'Tente alterar os termos de busca ou remover os filtros aplicados.'}
              </p>
              {products.length === 0 && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white text-xs font-semibold"
                >
                  <Plus className="size-4 mr-1.5" />
                  Adicionar Meu Primeiro Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="products-grid">
              {filteredProducts.map((product) => {
                const erpId = product.atributos?.erpId
                return (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 bg-card shadow-xs hover:border-primary/40 ${
                      !product.active ? 'opacity-80 bg-muted/20' : ''
                    }`}
                    data-testid={`product-card-${product.id}`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {product.brand}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Tam {product.size}
                          </Badge>
                          {product.badge && (
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-800 border-amber-200">
                              {product.badge}
                            </Badge>
                          )}
                        </div>

                        {/* Status Badge */}
                        <Badge
                          variant={product.active ? 'default' : 'secondary'}
                          className={`text-[10px] shrink-0 ${
                            product.active
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {product.active ? 'Ativo' : 'Despublicado'}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-sm text-foreground line-clamp-1" title={product.name}>
                        {product.name}
                      </h3>

                      {/* Optional ERP_ID badge */}
                      {erpId && (
                        <div className="mt-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono text-muted-foreground border border-border"
                            data-testid={`erp-badge-${product.id}`}
                          >
                            <Hash className="size-3 text-primary" />
                            ERP: <strong className="text-foreground">{erpId}</strong>
                          </span>
                        </div>
                      )}

                      {/* Technical specifications */}
                      <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                        <p>
                          <span className="font-medium text-foreground">Peso:</span>{' '}
                          {product.atributos?.faixaPeso || 'Padrão'}
                        </p>
                        <p className="truncate">
                          <span className="font-medium text-foreground">Tecnologia:</span>{' '}
                          {product.atributos?.tecnologia || 'Camada Seca'}
                        </p>
                      </div>
                    </div>

                    {/* Price & Stock info */}
                    <div className="pt-3 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Estoque</span>
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                            <Layers className="size-3 text-muted-foreground" />
                            {product.quantity} un
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Preço de Venda</span>
                          <span className="font-extrabold text-sm text-primary-dark">
                            {formatPrice(product.priceCents)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant={product.active ? 'outline' : 'default'}
                          size="xs"
                          onClick={() => handleToggleActive(product)}
                          className={`flex-1 text-xs font-semibold ${
                            product.active
                              ? 'hover:bg-slate-100 text-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          data-testid={`toggle-active-${product.id}`}
                        >
                          {product.active ? (
                            <>
                              <EyeOff className="size-3 mr-1" />
                              Despublicar
                            </>
                          ) : (
                            <>
                              <Eye className="size-3 mr-1" />
                              Publicar
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setProductToDelete(product)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remover produto do catálogo"
                          aria-label="Excluir produto"
                          data-testid={`delete-btn-${product.id}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Modal (Master Catalog Linker) */}
      <AddProductDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onProductAdded={handleProductAdded}
        repo={repo}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!productToDelete}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Remover produto do catálogo?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Tem certeza que deseja remover{' '}
              <strong className="text-foreground">{productToDelete?.name}</strong> do seu catálogo?
              Ele deixará de ser ofertado no marketplace para sua distribuidora.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProductToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeleting ? 'Removendo...' : 'Sim, remover produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
