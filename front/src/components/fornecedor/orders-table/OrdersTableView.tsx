import * as React from 'react'
import { type ColumnDef, flexRender } from '@/lib/compat/tanstack-table'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Table as TableInstance } from '@/lib/compat/tanstack-table'
import type { SupplierOrderRow } from './model'

interface OrdersTableViewProps {
 table: TableInstance<SupplierOrderRow>
 columns: ColumnDef<SupplierOrderRow>[]
 data: SupplierOrderRow[]
 filteredData: SupplierOrderRow[]
 statusFilter: string
 setStatusFilter: React.Dispatch<React.SetStateAction<string>>
 statusCounts: { todos: number; aguardando: number; confirmado: number; cancelado: number; entregue: number }
 globalFilter: string
 setGlobalFilter: React.Dispatch<React.SetStateAction<string>>
 handleSearchChange: React.ChangeEventHandler<HTMLInputElement>
 error: string | null
 requestId?: string
 copiedRequestId: boolean
 handleCopyRequestId(id: string): Promise<void>
 handleRefresh(): Promise<void>
 isRefreshing: boolean
 loading: boolean
}

export function OrdersTableView({ table, columns, data, filteredData, statusFilter, setStatusFilter, statusCounts, globalFilter, setGlobalFilter, handleSearchChange, error, requestId, copiedRequestId, handleCopyRequestId, handleRefresh, isRefreshing, loading }: OrdersTableViewProps) {
 return (<div className="space-y-4" data-testid="orders-data-table-container">
      {/* Top Filter Bar & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'todos'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos
            <span className="ml-1.5 text-[11px] opacity-75 font-normal">
              ({statusCounts.todos})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('aguardando')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'aguardando'
                ? 'bg-card text-amber-700 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Aguardando
            <span className="ml-1.5 text-[11px] opacity-75 font-normal">
              ({statusCounts.aguardando})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confirmado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'confirmado'
                ? 'bg-card text-emerald-700 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Confirmados
            <span className="ml-1.5 text-[11px] opacity-75 font-normal">
              ({statusCounts.confirmado})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('entregue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'entregue'
                ? 'bg-card text-blue-700 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Entregues
            <span className="ml-1.5 text-[11px] opacity-75 font-normal">
              ({statusCounts.entregue})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('cancelado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'cancelado'
                ? 'bg-card text-red-700 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cancelados
            <span className="ml-1.5 text-[11px] opacity-75 font-normal">
              ({statusCounts.cancelado})
            </span>
          </button>
        </div>

        {/* Global Search Input & Refresh Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-60 pointer-events-none" />
            <Input
              placeholder="Buscar pedido, cliente ou item..."
              value={globalFilter}
              onChange={handleSearchChange}
              className="pl-9 h-9 text-xs bg-card"
              data-testid="orders-search-input"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            aria-label="Atualizar pedidos"
            title="Atualizar pedidos"
            data-testid="orders-refresh-button"
            className="h-9 px-3 text-xs gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", (isRefreshing || loading) && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Error alert banner when refresh fails but previous data exists */}
      {error && data.length > 0 && (
        <div
          className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          data-testid="orders-refresh-error-banner"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>Não foi possível atualizar os pedidos: {error}</span>
            {requestId && (
              <span className="font-mono text-[11px] text-muted-foreground ml-1">
                (Código: {requestId})
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="h-7 px-2.5 text-xs border-red-200 text-red-800 hover:bg-red-100 shrink-0 cursor-pointer"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-2.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="size-6 animate-spin opacity-50 text-primary" />
                    <span className="text-xs">Carregando pedidos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error && data.length === 0 ? (
              <TableRow data-testid="orders-error-row">
                <TableCell colSpan={columns.length} className="h-48 text-center" data-testid="orders-error-state">
                  <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto p-4 text-center">
                    <div className="size-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                      <AlertCircle className="size-5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      Não foi possível carregar os pedidos
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {error}
                    </span>
                    {requestId && (
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
                        <span className="font-mono truncate">
                          Código: <strong className="text-foreground">{requestId}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyRequestId(requestId)}
                          className="text-xs font-semibold text-primary-dark hover:underline flex-none cursor-pointer"
                        >
                          {copiedRequestId ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing || loading}
                      className="mt-1 text-xs gap-1.5 cursor-pointer"
                      data-testid="orders-retry-button"
                    >
                      <RefreshCw className={cn("size-3.5", (isRefreshing || loading) && "animate-spin")} />
                      Tentar novamente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center" data-testid="orders-empty-state">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Package className="size-8 opacity-40 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      Nenhum pedido encontrado
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {globalFilter || statusFilter !== 'todos'
                        ? 'Tente ajustar os filtros ou termo de busca.'
                        : 'Você ainda não recebeu nenhum pedido direto.'}
                    </span>
                    {Boolean(globalFilter || statusFilter !== 'todos') && (
                      <button
                        type="button"
                        onClick={() => {
                          setGlobalFilter('')
                          setStatusFilter('todos')
                        }}
                        className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Limpar filtros e busca
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination & Footer Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-1">
        <div className="text-xs text-muted-foreground" data-testid="pagination-info">
          Mostrando{' '}
          <span className="font-semibold text-foreground">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize +
              (filteredData.length > 0 ? 1 : 0)}
          </span>{' '}
          a{' '}
          <span className="font-semibold text-foreground">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              filteredData.length
            )}
          </span>{' '}
          de{' '}
          <span className="font-semibold text-foreground">{filteredData.length}</span>{' '}
          pedidos
        </div>

        <div className="flex items-center gap-3">
          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Por página:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              data-testid="page-size-select"
            >
              {[5, 10, 20, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Primeira página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-2 text-xs font-medium text-foreground">
              Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de{' '}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

    </div>)
}
