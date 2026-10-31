'use client'

import * as React from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@/lib/compat/tanstack-table'
import { toast } from 'sonner'
import { useMarket } from '@/contexts/market-context'
import { OrderReportDialog } from './OrderReportDialog'
import { OrderCancellationDialog } from './OrderCancellationDialog'
import { copySupportCode } from '@/lib/frontend-diagnostics'
import type { DirectOrder } from '@/lib/domain/supplier'
import type { Order as ContractOrder } from '@contracts'
import { normalizeOrder, type SupplierOrderRow } from './orders-table/model'
import { createOrderColumns } from './orders-table/columns'
import { OrderDetailsDialog } from './orders-table/OrderDetailsDialog'
import { OrdersTableView } from './orders-table/OrdersTableView'
export type { SupplierOrderRow } from './orders-table/model'

interface OrdersDataTableProps {
  orders?: (DirectOrder | ContractOrder | SupplierOrderRow)[]
  isLoading?: boolean
  error?: string | null
  requestId?: string
  onConfirm?: (orderId: string) => Promise<void> | void
  onRefuse?: (orderId: string, reason: string) => Promise<void> | void
  onUpdateStatus?: (orderId: string, status: 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado') => Promise<void> | void
  onRefresh?: () => Promise<void> | void
}

export function OrdersDataTable({
  orders: customOrders,
  isLoading: customLoading,
  error: customError,
  requestId: customRequestId,
  onConfirm,
  onRefuse,
  onUpdateStatus,
  onRefresh,
}: OrdersDataTableProps) {
  const market = useMarket()

  const loading = customLoading ?? market.directOrdersLoading
  const error = customError ?? market.directOrdersError
  const requestId = customRequestId ?? market.directOrdersDiagnostic?.requestId

  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [copiedRequestId, setCopiedRequestId] = React.useState(false)
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopyRequestId = async (id: string) => {
    const success = await copySupportCode(id)
    if (success) {
      setCopiedRequestId(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedRequestId(false), 2000)
      toast.success('Código de suporte copiado!')
    } else {
      toast.error('Não foi possível copiar o código.')
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing || loading) return
    setIsRefreshing(true)
    try {
      if (onRefresh) {
        await onRefresh()
      } else if (market.refetchDirectOrders) {
        await market.refetchDirectOrders()
      }
    } catch {
      toast.error('Erro ao atualizar pedidos.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const data = React.useMemo(() => {
    const list = customOrders ?? market.directOrders ?? []
    return list.map(normalizeOrder)
  }, [customOrders, market.directOrders])

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('todos')
  const [selectedOrder, setSelectedOrder] = React.useState<SupplierOrderRow | null>(null)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  
  // State for reporting
  const [reportingOrder, setReportingOrder] = React.useState<SupplierOrderRow | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = React.useState<string | null>(null)
  const [isReportOpen, setIsReportOpen] = React.useState(false)

  // Status counts for tabs
  const statusCounts = React.useMemo(() => {
    const counts = {
      todos: data.length,
      aguardando: 0,
      confirmado: 0,
      cancelado: 0,
      entregue: 0,
    }
    data.forEach((o) => {
      if (o.status === 'aguardando') counts.aguardando++
      else if (o.status === 'confirmado') counts.confirmado++
      else if (o.status === 'cancelado') counts.cancelado++
      else if (o.status === 'entregue' || o.status === 'a-caminho') counts.entregue++
    })
    return counts
  }, [data])

  // Filtered by status tab
  const filteredData = React.useMemo(() => {
    if (statusFilter === 'todos') return data
    if (statusFilter === 'entregue') {
      return data.filter((o) => o.status === 'entregue' || o.status === 'a-caminho')
    }
    return data.filter((o) => o.status === statusFilter)
  }, [data, statusFilter])

  // Action handlers
  const handleConfirmOrder = async (orderId: string) => {
    try {
      if (onConfirm) {
        await onConfirm(orderId)
      } else {
        await market.handleConfirmarDireto(orderId)
      }
      toast.success(`Pedido #${orderId} confirmado com sucesso!`)
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'confirmado' } : null))
      }
    } catch {
      toast.error('Erro ao confirmar pedido')
    }
  }

  const handleRefuseOrder = (orderId: string) => {
    setIsDetailOpen(false)
    setCancellingOrderId(orderId)
  }

  const confirmRefusal = async (orderId: string, reason: string) => {
    try {
      if (onRefuse) {
        await onRefuse(orderId, reason)
      } else {
        await market.handleRecusarDireto(orderId, reason)
      }
      toast.info(`Pedido #${orderId} recusado/cancelado.`)
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'cancelado' } : null))
      }
    } catch {
      toast.error('Erro ao recusar pedido')
      throw new Error('Cancelamento não concluído')
    }
  }

  const handleUpdateStatus = async (
    orderId: string,
    status: 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado'
  ) => {
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(orderId, status)
      } else if (market.handleAtualizarStatusDireto) {
        await market.handleAtualizarStatusDireto(orderId, status)
      }
      toast.success(`Pedido #${orderId} atualizado com sucesso!`)
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status } : null))
      }
    } catch {
      toast.error('Erro ao atualizar status do pedido')
    }
  }

  const handleCopyId = (orderId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(orderId)
    }
    toast.success(`ID #${orderId} copiado para a área de transferência!`)
  }

  // Column definitions
  const columns = React.useMemo(
    () => createOrderColumns({ setSelectedOrder, setIsDetailOpen, setReportingOrder, setIsReportOpen, handleCopyId, handleConfirmOrder, handleRefuseOrder, handleUpdateStatus }),
    // Preserve the existing memoization boundary during this structural extraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  })

  // Global search filtering
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setGlobalFilter(val)
    table.setGlobalFilter(val)
  }

  return (
    <>
      <OrdersTableView
        filteredData={filteredData}
        table={table}
        columns={columns}
        data={data}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusCounts={statusCounts}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        handleSearchChange={handleSearchChange}
        error={error}
        requestId={requestId}
        copiedRequestId={copiedRequestId}
        handleCopyRequestId={handleCopyRequestId}
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        loading={loading}
      />
      <OrderDetailsDialog
        isDetailOpen={isDetailOpen}
        setIsDetailOpen={setIsDetailOpen}
        selectedOrder={selectedOrder}
        handleRefuseOrder={handleRefuseOrder}
        handleConfirmOrder={handleConfirmOrder}
        handleUpdateStatus={handleUpdateStatus}
      />
      {cancellingOrderId && (
        <OrderCancellationDialog
          onClose={() => setCancellingOrderId(null)}
          onConfirm={(reason) => confirmRefusal(cancellingOrderId, reason)}
        />
      )}
      {/* Report to Client Dialog */}
      {reportingOrder && (
        <OrderReportDialog
          isOpen={isReportOpen}
          onOpenChange={setIsReportOpen}
          orderId={reportingOrder.id}
          buyerName={reportingOrder.buyerName}
        />
      )}
    </>
  )
}
