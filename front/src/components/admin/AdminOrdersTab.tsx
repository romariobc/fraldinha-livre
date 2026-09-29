'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Order, OrderStatus } from '@contracts'
import { Search, RefreshCw, Filter, Eye, Copy, Check, Calendar, MapPin, CreditCard, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const PAGE_SIZE = 10

export default function AdminOrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/orders?scope=admin')
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error('Falha na resposta')
        const data = (await res.json()) as Order[]
        setOrders(data)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erro ao carregar pedidos.')
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

  const filteredOrders = useMemo(() => {
    if (!orders) return []
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      const matchStatus = statusFilter === 'todos' || o.status === statusFilter
      const matchSearch =
        !q ||
        o.id.toLowerCase().includes(q) ||
        o.uid.toLowerCase().includes(q) ||
        (o.product && o.product.toLowerCase().includes(q)) ||
        (o.supplierName && o.supplierName.toLowerCase().includes(q)) ||
        (o.paymentTransactionId && o.paymentTransactionId.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [orders, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredOrders.slice(start, start + PAGE_SIZE)
  }, [filteredOrders, currentPage])

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'aguardando':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            aguardando
          </span>
        )
      case 'confirmado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
            confirmado
          </span>
        )
      case 'a-caminho':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
            a-caminho
          </span>
        )
      case 'entregue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            entregue
          </span>
        )
      case 'cancelado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            cancelado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        )
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

  if (loading && !orders) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-brand-muted">
        <RefreshCw size={24} className="animate-spin mb-3 text-primary" />
        <p>Carregando pedidos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="admin-orders-tab">
      {/* Top Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted" />
            <Input
              type="text"
              placeholder="Buscar por ID, comprador, produto ou fornecedor..."
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
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filtrar por status"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-text shadow-sm focus:border-primary focus:outline-none"
          >
            <option value="todos">Todos ({orders?.length ?? 0})</option>
            <option value="aguardando">Aguardando</option>
            <option value="confirmado">Confirmado</option>
            <option value="a-caminho">A caminho</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
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
            title="Recarregar pedidos"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Orders Count summary */}
      <div className="text-xs text-brand-muted flex justify-between items-center px-0.5">
        <span>
          Mostrando {filteredOrders.length} de {orders?.length ?? 0} pedido(s)
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">
              <th className="py-2.5 px-3">ID</th>
              <th className="py-2.5 px-3">Comprador</th>
              <th className="py-2.5 px-3">Produto</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Total</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedOrders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 px-3 font-mono text-xs text-brand-text">
                  <div className="flex items-center gap-1.5">
                    <span title={o.id}>{o.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(o.id)}
                      className="text-slate-400 hover:text-brand-text p-0.5 rounded transition-colors"
                      title="Copiar ID do pedido"
                    >
                      {copiedId === o.id ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-brand-muted">
                  <span title={o.uid}>{o.uid.length > 12 ? `${o.uid.slice(0, 10)}...` : o.uid}</span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-brand-text line-clamp-1">{o.product}</div>
                  <div className="text-xs text-brand-muted">
                    {o.quantity} {o.unit}
                    {o.supplierName && ` • ${o.supplierName}`}
                  </div>
                </td>
                <td className="py-2.5 px-3">{getStatusBadge(o.status)}</td>
                <td className="py-2.5 px-3 font-semibold text-brand-text whitespace-nowrap">
                  {o.price != null ? `R$ ${(o.price / 100).toFixed(2)}` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrder(o)}
                    className="h-7 px-2 text-xs text-primary-dark hover:bg-primary-light flex items-center gap-1 ml-auto"
                  >
                    <Eye size={13} />
                    <span>Detalhes</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="py-12 text-center text-brand-muted">
            <p className="font-medium text-slate-600">Nenhum pedido encontrado com os filtros selecionados.</p>
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

      {/* Order Details Dialog */}
      <Dialog open={selectedOrder !== null} onOpenChange={(open) => { if (!open) setSelectedOrder(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <DialogTitle className="font-display text-lg font-bold">
                    Pedido #{selectedOrder.id.slice(0, 8)}...
                  </DialogTitle>
                  <div>{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <DialogDescription className="font-mono text-xs text-brand-muted flex items-center gap-1.5 pt-1">
                  <span>ID completo: {selectedOrder.id}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedOrder.id)}
                    className="p-0.5 hover:text-brand-text"
                    title="Copiar ID"
                  >
                    {copiedId === selectedOrder.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                {/* Metadados / Data / Comprador */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <div className="text-xs text-brand-muted flex items-center gap-1">
                      <Calendar size={13} />
                      <span>Data de Criação</span>
                    </div>
                    <div className="font-medium text-brand-text mt-0.5">
                      {selectedOrder.createdAt
                        ? new Date(selectedOrder.createdAt).toLocaleString('pt-BR')
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-muted">Comprador (UID)</div>
                    <div className="font-mono text-xs text-brand-text mt-0.5 break-all">
                      {selectedOrder.uid}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-muted">Fornecedor</div>
                    <div className="font-medium text-brand-text mt-0.5">
                      {selectedOrder.supplierName || '—'}
                      {selectedOrder.supplierId && (
                        <span className="block font-mono text-xs text-brand-muted">
                          UID: {selectedOrder.supplierId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-muted flex items-center gap-1">
                      <CreditCard size={13} />
                      <span>Pagamento</span>
                    </div>
                    <div className="text-xs text-brand-text mt-0.5">
                      <span className="font-semibold uppercase">{selectedOrder.paymentMethod || 'simulado'}</span>
                      {selectedOrder.paymentStatus && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium">
                          {selectedOrder.paymentStatus}
                        </span>
                      )}
                      {selectedOrder.paymentTransactionId && (
                        <div className="font-mono text-[11px] text-brand-muted truncate mt-0.5" title={selectedOrder.paymentTransactionId}>
                          Tx: {selectedOrder.paymentTransactionId}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Itens do Pedido */}
                <div>
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-muted mb-2 flex items-center gap-1.5">
                    <Package size={14} />
                    <span>Itens do Pedido ({selectedOrder.items?.length || 1})</span>
                  </h4>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-brand-muted">
                        <tr>
                          <th className="py-2 px-3 text-left">Item</th>
                          <th className="py-2 px-3 text-center">Qtd</th>
                          <th className="py-2 px-3 text-right">Unitário</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-medium text-brand-text">{item.productName}</td>
                              <td className="py-2 px-3 text-center">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right text-brand-muted">
                                R$ {(item.unitPrice / 100).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-brand-text">
                                R$ {((item.unitPrice * item.quantity) / 100).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-2 px-3 font-medium text-brand-text">{selectedOrder.product}</td>
                            <td className="py-2 px-3 text-center">
                              {selectedOrder.quantity} {selectedOrder.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-brand-muted">
                              {selectedOrder.price ? `R$ ${(selectedOrder.price / 100).toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-brand-text">
                              {selectedOrder.price ? `R$ ${(selectedOrder.price / 100).toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Endereço de Entrega */}
                {selectedOrder.deliveryAddress && (
                  <div>
                    <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-muted mb-1.5 flex items-center gap-1.5">
                      <MapPin size={14} />
                      <span>Endereço de Entrega</span>
                    </h4>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-brand-text">
                      <p className="font-medium">
                        {selectedOrder.deliveryAddress.logradouro}, {selectedOrder.deliveryAddress.numero}
                        {selectedOrder.deliveryAddress.complemento && ` - ${selectedOrder.deliveryAddress.complemento}`}
                      </p>
                      <p className="text-brand-muted mt-0.5">
                        {selectedOrder.deliveryAddress.bairro} • {selectedOrder.deliveryAddress.cidade}/{selectedOrder.deliveryAddress.estado} • CEP {selectedOrder.deliveryAddress.cep}
                      </p>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-display font-bold text-sm text-brand-text">Total do Pedido:</span>
                  <span className="font-display font-black text-base text-primary-dark">
                    {selectedOrder.price != null ? `R$ ${(selectedOrder.price / 100).toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
