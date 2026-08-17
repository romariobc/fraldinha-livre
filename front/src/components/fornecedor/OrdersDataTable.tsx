'use client'

import * as React from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Clock,
  MapPin,
  User,
  ShoppingBag,
  MessageSquareWarning,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { formatPrice } from '@/lib/utils'
import { useMarket } from '@/contexts/market-context'
import { OrderReportDialog } from './OrderReportDialog'
import type { DirectOrder } from '@/lib/supplier-mock'
import type { Order as ContractOrder } from '@contracts'

export interface SupplierOrderRow {
  id: string
  product: string
  quantity: number
  unit: string
  price: number // em centavos
  buyerName: string
  buyerLocation: string
  createdAt: string
  status: string
  deliveryAddress?: {
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    estado?: string
    cep?: string
  }
  items?: Array<{
    productId: string
    productName: string
    unitPrice: number
    quantity: number
    unit: string
  }>
  paymentStatus?: string
  dispatchStatus?: string
}

function normalizeOrder(order: DirectOrder | ContractOrder | SupplierOrderRow): SupplierOrderRow {
  // Check if it's already a SupplierOrderRow
  if ('buyerLocation' in order && typeof order.buyerLocation === 'string') {
    return order as SupplierOrderRow
  }

  // If ContractOrder
  if ('deliveryAddress' in order && order.deliveryAddress) {
    const contractOrder = order as ContractOrder
    const addr = contractOrder.deliveryAddress
    const buyerLoc = [addr.bairro, addr.cidade, addr.estado].filter(Boolean).join(' - ') || `${addr.cidade}, ${addr.estado}`
    return {
      id: contractOrder.id,
      product: contractOrder.product,
      quantity: contractOrder.quantity,
      unit: contractOrder.unit,
      price: contractOrder.price ?? 0,
      buyerName: 'Cliente ' + contractOrder.uid.slice(0, 6),
      buyerLocation: buyerLoc || 'São Paulo, SP',
      createdAt: contractOrder.createdAt,
      status: contractOrder.status,
      deliveryAddress: addr,
      items: contractOrder.items,
    }
  }

  // If DirectOrder
  const directOrder = order as DirectOrder
  const buyerLoc = [directOrder.buyerCity, directOrder.buyerState].filter(Boolean).join(', ') || 'São Paulo, SP'
  return {
    id: directOrder.id,
    product: directOrder.product,
    quantity: directOrder.quantity,
    unit: directOrder.unit,
    price: directOrder.price,
    buyerName: 'Comprador B2B',
    buyerLocation: buyerLoc,
    createdAt: directOrder.createdAt,
    status: directOrder.status,
    deliveryAddress: {
      logradouro: 'Endereço Comercial',
      numero: 'S/N',
      bairro: 'Centro',
      cidade: directOrder.buyerCity || 'São Paulo',
      estado: directOrder.buyerState || 'SP',
      cep: '01000-000',
    },
    items: [
      {
        productId: directOrder.id + '-item',
        productName: directOrder.product,
        unitPrice: directOrder.price / (directOrder.quantity || 1),
        quantity: directOrder.quantity,
        unit: directOrder.unit,
      },
    ],
    paymentStatus: directOrder.paymentStatus,
    dispatchStatus: directOrder.dispatchStatus,
  }
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return iso
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'aguardando':
      return {
        label: 'Aguardando',
        variant: 'secondary' as const,
        className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
      }
    case 'confirmado':
      return {
        label: 'Confirmado',
        variant: 'default' as const,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
      }
    case 'cancelado':
      return {
        label: 'Cancelado',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
      }
    case 'a-caminho':
      return {
        label: 'A Caminho',
        variant: 'secondary' as const,
        className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
      }
    case 'entregue':
      return {
        label: 'Entregue',
        variant: 'default' as const,
        className: 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100',
      }
    default:
      return {
        label: status,
        variant: 'outline' as const,
        className: '',
      }
  }
}

interface OrdersDataTableProps {
  orders?: (DirectOrder | ContractOrder | SupplierOrderRow)[]
  isLoading?: boolean
  onConfirm?: (orderId: string) => Promise<void> | void
  onRefuse?: (orderId: string) => Promise<void> | void
}

export function OrdersDataTable({
  orders: customOrders,
  isLoading: customLoading,
  onConfirm,
  onRefuse,
}: OrdersDataTableProps) {
  const market = useMarket()

  const loading = customLoading ?? market.directOrdersLoading

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

  const handleRefuseOrder = async (orderId: string) => {
    try {
      if (onRefuse) {
        await onRefuse(orderId)
      } else {
        await market.handleRecusarDireto(orderId)
      }
      toast.info(`Pedido #${orderId} recusado/cancelado.`)
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'cancelado' } : null))
      }
    } catch {
      toast.error('Erro ao recusar pedido')
    }
  }

  const handleCopyId = (orderId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(orderId)
    }
    toast.success(`ID #${orderId} copiado para a área de transferência!`)
  }

  // Column definitions
  const columns = React.useMemo<ColumnDef<SupplierOrderRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent font-semibold text-xs text-foreground"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              ID do Pedido
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="ml-1.5 size-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="ml-1.5 size-3.5" />
              ) : (
                <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" />
              )}
            </Button>
          )
        },
        cell: ({ row }) => {
          const id = row.original.id
          return (
            <span
              data-testid={`order-id-${id}`}
              className="font-mono font-bold text-xs text-primary-dark cursor-pointer hover:underline"
              onClick={() => {
                setSelectedOrder(row.original)
                setIsDetailOpen(true)
              }}
            >
              #{id}
            </span>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent font-semibold text-xs text-foreground"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Data / Hora
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="ml-1.5 size-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="ml-1.5 size-3.5" />
              ) : (
                <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" />
              )}
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(row.original.createdAt)}
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          return new Date(rowA.original.createdAt).getTime() - new Date(rowB.original.createdAt).getTime()
        },
      },
      {
        accessorKey: 'buyerLocation',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent font-semibold text-xs text-foreground"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Cliente / Destino
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="ml-1.5 size-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="ml-1.5 size-3.5" />
              ) : (
                <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" />
              )}
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">{row.original.buyerName}</span>
              <span className="text-[11px] text-muted-foreground">{row.original.buyerLocation}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'product',
        header: () => <span className="font-semibold text-xs text-foreground">Itens</span>,
        cell: ({ row }) => {
          const { product, quantity, unit, items } = row.original
          const itemsCount = items?.length || 1
          return (
            <div className="flex items-center gap-1.5 max-w-[220px]">
              <span className="text-xs text-foreground truncate" title={product}>
                {product}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                ({quantity} {unit})
              </span>
              {itemsCount > 1 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                  +{itemsCount - 1}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'price',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent font-semibold text-xs text-foreground"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Valor Total
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="ml-1.5 size-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="ml-1.5 size-3.5" />
              ) : (
                <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" />
              )}
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <span className="text-xs font-bold text-foreground">
              {formatPrice(row.original.price)}
            </span>
          )
        },
        sortingFn: (rowA, rowB) => {
          return rowA.original.price - rowB.original.price
        },
      },
      {
        accessorKey: 'status',
        header: () => <span className="font-semibold text-xs text-foreground">Status</span>,
        cell: ({ row }) => {
          const { label, variant, className } = getStatusBadge(row.original.status)
          return (
            <Badge variant={variant} className={className}>
              {label}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-right sr-only">Ações</span>,
        cell: ({ row }) => {
          const order = row.original
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ações do pedido"
                      data-testid={`actions-btn-${order.id}`}
                    />
                  }
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedOrder(order)
                        setIsDetailOpen(true)
                      }}
                      className="cursor-pointer"
                    >
                      <Eye className="size-4 mr-2 text-primary" />
                      Expandir
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setReportingOrder(order)
                        setIsReportOpen(true)
                      }}
                      className="cursor-pointer"
                    >
                      <MessageSquareWarning className="size-4 mr-2 text-amber-500" />
                      Reportar ao Cliente
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCopyId(order.id)}
                      className="cursor-pointer"
                    >
                      <Copy className="size-4 mr-2" />
                      Copiar ID
                    </DropdownMenuItem>
                    {order.status === 'aguardando' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleConfirmOrder(order.id)}
                          className="cursor-pointer text-emerald-600 focus:text-emerald-700 font-medium"
                        >
                          <CheckCircle2 className="size-4 mr-2 text-emerald-600" />
                          Confirmar Pedido
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRefuseOrder(order.id)}
                          className="cursor-pointer text-red-600 focus:text-red-700 font-medium"
                        >
                          <XCircle className="size-4 mr-2 text-red-600" />
                          Cancelar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
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
    <div className="space-y-4" data-testid="orders-data-table-container">
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

        {/* Global Search Input */}
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
      </div>

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
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="size-6 animate-spin opacity-50 text-primary" />
                    <span className="text-xs">Carregando pedidos...</span>
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
                <TableCell colSpan={columns.length} className="h-32 text-center">
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

      {/* Order Detail Preview Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-6">
                  <div>
                    <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                      <ShoppingBag className="size-5 text-primary" />
                      Pedido #{selectedOrder.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Recebido em {formatDate(selectedOrder.createdAt)}
                    </DialogDescription>
                  </div>
                  {(() => {
                    const { label, variant, className } = getStatusBadge(selectedOrder.status)
                    return (
                      <Badge variant={variant} className={className}>
                        {label}
                      </Badge>
                    )
                  })()}
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Cliente & Endereço */}
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    Dados do Comprador
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="font-medium text-foreground">Identificação: </span>
                      {selectedOrder.buyerName}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Cidade/UF: </span>
                      {selectedOrder.buyerLocation}
                    </div>
                  </div>

                  {selectedOrder.deliveryAddress && (
                    <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">Endereço de Entrega: </span>
                        {selectedOrder.deliveryAddress.logradouro},{' '}
                        {selectedOrder.deliveryAddress.numero}
                        {selectedOrder.deliveryAddress.complemento
                          ? ` - ${selectedOrder.deliveryAddress.complemento}`
                          : ''}
                        , {selectedOrder.deliveryAddress.bairro},{' '}
                        {selectedOrder.deliveryAddress.cidade} -{' '}
                        {selectedOrder.deliveryAddress.estado},{' '}
                        {selectedOrder.deliveryAddress.cep}
                      </div>
                    </div>
                  )}
                </div>

                {/* Itens do Pedido */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="bg-muted/50 px-3.5 py-2 font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <Package className="size-3.5 text-primary" />
                    Itens Inclusos
                  </div>
                  <div className="divide-y divide-border">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-foreground text-xs">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Quantidade: {item.quantity} {item.unit} · Preço un: {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                          <span className="font-bold text-foreground text-xs">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-xs">
                            {selectedOrder.product}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Quantidade: {selectedOrder.quantity} {selectedOrder.unit}
                          </p>
                        </div>
                        <span className="font-bold text-foreground text-xs">
                          {formatPrice(selectedOrder.price)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total footer */}
                  <div className="bg-muted/40 px-3.5 py-2.5 flex items-center justify-between border-t border-border">
                    <span className="font-bold text-foreground text-xs">Valor Total a Receber:</span>
                    <span className="font-extrabold text-sm text-primary-dark">
                      {formatPrice(selectedOrder.price)}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {selectedOrder.status === 'aguardando' && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        handleRefuseOrder(selectedOrder.id)
                        setIsDetailOpen(false)
                      }}
                      className="mr-auto"
                    >
                      <XCircle className="size-4 mr-1.5" />
                      Recusar Pedido
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        handleConfirmOrder(selectedOrder.id)
                        setIsDetailOpen(false)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="size-4 mr-1.5" />
                      Confirmar Pedido
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Report to Client Dialog */}
      {reportingOrder && (
        <OrderReportDialog
          isOpen={isReportOpen}
          onOpenChange={setIsReportOpen}
          orderId={reportingOrder.id}
          buyerName={reportingOrder.buyerName}
        />
      )}
    </div>
  )
}
