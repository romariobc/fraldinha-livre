import { type ColumnDef } from '@/lib/compat/tanstack-table'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Copy,
  MessageSquareWarning,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { type SupplierOrderRow, formatDate, getStatusBadge } from './model'

interface ColumnActions {
  setSelectedOrder(order: SupplierOrderRow | null): void
  setIsDetailOpen(open: boolean): void
  setReportingOrder(order: SupplierOrderRow | null): void
  setIsReportOpen(open: boolean): void
  handleCopyId(id: string): void
  handleConfirmOrder(id: string): void
  handleRefuseOrder(id: string): void
  handleUpdateStatus(id: string, status: 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado'): void
}

export function createOrderColumns({ setSelectedOrder, setIsDetailOpen, setReportingOrder, setIsReportOpen, handleCopyId, handleConfirmOrder, handleRefuseOrder, handleUpdateStatus }: ColumnActions): ColumnDef<SupplierOrderRow>[] {
  return [
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
                    {order.status === 'confirmado' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleUpdateStatus(order.id, 'a-caminho')}
                          className="cursor-pointer text-blue-600 focus:text-blue-700 font-medium"
                        >
                          <Truck className="size-4 mr-2 text-blue-600" />
                          Despachar (A Caminho)
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
                    {order.status === 'a-caminho' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleUpdateStatus(order.id, 'entregue')}
                          className="cursor-pointer text-teal-600 focus:text-teal-700 font-medium"
                        >
                          <CheckCircle2 className="size-4 mr-2 text-teal-600" />
                          Marcar como Entregue
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
    ]
}
