import type { DirectOrder } from '@/lib/domain/supplier'
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

export function normalizeOrder(order: DirectOrder | ContractOrder | SupplierOrderRow): SupplierOrderRow {
  // Check if it's already a SupplierOrderRow
  if ('buyerLocation' in order && typeof order.buyerLocation === 'string') {
    return order as SupplierOrderRow
  }

  // If ContractOrder
  if ('uid' in order && order.deliveryAddress) {
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
      paymentStatus: contractOrder.paymentStatus === 'approved' ? 'confirmado' : 'pendente',
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
    deliveryAddress: directOrder.deliveryAddress ?? {
      logradouro: 'Endereço Comercial',
      numero: 'S/N',
      bairro: 'Centro',
      cidade: directOrder.buyerCity || 'São Paulo',
      estado: directOrder.buyerState || 'SP',
      cep: '01000-000',
    },
    items: directOrder.items ?? [
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

export function formatDate(iso: string): string {
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

export function getStatusBadge(status: string) {
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
