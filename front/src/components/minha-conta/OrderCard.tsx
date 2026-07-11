'use client'

import { useState } from 'react'
import { Package2, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { Order, OrderStatus } from '@/lib/account-mock'
import { formatPrice } from '@/lib/utils'
import { getOrderItems } from '@/lib/order-items'
import { useOrders } from '@/contexts/orders-context'
import { useMarket } from '@/contexts/market-context'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OrderCardProps {
  order: Order
  mode: 'pedidos' | 'historico'
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  aguardando:          { label: 'Aguardando ofertas', className: 'bg-slate-100 text-slate-600' },
  'ofertas-recebidas': { label: 'Ofertas recebidas',  className: 'bg-accent/10 text-accent-dark' },
  aceito:              { label: 'Oferta aceita',       className: 'bg-primary-light text-primary-dark' },
  confirmado:          { label: 'Confirmado',          className: 'bg-primary-light text-primary-dark' },
  'a-caminho':         { label: 'A caminho',           className: 'bg-purple-100 text-purple-700' },
  entregue:            { label: 'Entregue',            className: 'bg-green-100 text-green-700' },
  cancelado:           { label: 'Cancelado',           className: 'bg-red-100 text-red-600' },
}

function formatAddress(addr: Order['deliveryAddress']): string {
  return `${addr.logradouro}, ${addr.numero} — ${addr.cidade}/${addr.estado}`
}

function formatAddressComplete(addr: Order['deliveryAddress']): string {
  const complement = addr.complemento ? ` — ${addr.complemento}` : ''
  return `${addr.logradouro}, ${addr.numero}${complement}\n${addr.bairro}, ${addr.cidade}/${addr.estado}\n${addr.cep}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function OrderCard({ order, mode }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const { cancelOrder } = useOrders()
  const { cancelDirectOrder } = useMarket()

  const statusCfg = STATUS_CONFIG[order.status]

  // 'aguardando' e compartilhado: em cotacao = aguardando ofertas; em compra
  // direta = aguardando confirmacao do fornecedor. Label precisa ser type-aware.
  const statusLabel =
    order.status === 'aguardando' && order.type === 'compra-direta'
      ? 'Aguardando confirmação'
      : statusCfg.label

  const items = getOrderItems(order)

  // Calcular total (order.price ?? soma dos subtotais)
  const total = order.price ?? items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)

  // Determinar se deve mostrar botão de cancelar
  const canCancel = mode === 'pedidos' && order.status === 'aguardando' && order.type === 'compra-direta'

  // Mensagem de restrição para outros status
  const restrictionMessage =
    mode === 'pedidos'
      ? order.status === 'confirmado'
        ? 'Pedido confirmado. Para alterar, fale com o fornecedor.'
        : order.status === 'a-caminho'
        ? 'Pedido a caminho — não pode ser cancelado por aqui.'
        : null
      : null

  async function handleConfirmCancel() {
    setIsCanceling(true)
    try {
      // Cancelar pedido na lista de pedidos
      cancelOrder(order.id)

      // Se for sup-001, também cancelar na lista de fornecedor
      if (order.supplierId === 'sup-001') {
        cancelDirectOrder(order.id)
      }

      toast.success('Pedido cancelado')
      setCancelDialogOpen(false)
    } finally {
      setIsCanceling(false)
    }
  }

  const panelId = `order-panel-${order.id}`

  return (
    <>
      <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
        {/* Linha superior: ícone + produto + badge de tipo + chevron */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <Package2 size={16} className="text-primary-dark" />
            </div>
            <div>
              <p className="font-display font-extrabold text-sm text-brand-text leading-tight">
                {order.product}
              </p>
              <p className="text-xs text-brand-muted mt-0.5">
                {order.quantity} {order.unit}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                order.type === 'cotacao'
                  ? 'bg-primary-light text-primary-dark'
                  : 'bg-accent/10 text-accent-dark'
              }`}
            >
              {order.type === 'cotacao' ? 'Cotação' : 'Compra direta'}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={expanded ? 'Ocultar detalhes do pedido' : 'Ver detalhes do pedido'}
              className="flex-shrink-0 text-brand-muted hover:text-brand-text transition-colors mt-0.5"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Endereço resumido */}
        <div className="flex items-center gap-1.5 text-xs text-brand-muted">
          <MapPin size={12} className="flex-shrink-0" />
          <span>{formatAddress(order.deliveryAddress)}</span>
        </div>

        {/* Painel expansível */}
        {expanded && (
          <div id={panelId} className="border-t pt-3 space-y-3">
            {/* Linhas de item */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-brand-text">Itens</p>
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-xs text-brand-muted">
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span>
                    {formatPrice(item.unitPrice)} = {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between border-t pt-2">
              <span className="text-xs font-semibold text-brand-text">Total</span>
              <span className="text-sm font-black text-brand-text">{formatPrice(total)}</span>
            </div>

            {/* Endereço completo */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-brand-text">Endereço de entrega</p>
              <p className="text-xs text-brand-muted whitespace-pre-line">
                {formatAddressComplete(order.deliveryAddress)}
              </p>
            </div>

            {/* Data */}
            <div>
              <p className="text-xs font-semibold text-brand-text">Data do pedido</p>
              <p className="text-xs text-brand-muted">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        )}

        {/* Rodapé: status + ações */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusCfg.className}`}>
            {statusLabel}
          </span>

          <div className="flex items-center gap-2">
            {/* Histórico: data e valor */}
            {mode === 'historico' && (
              <>
                {order.price != null && (
                  <span className="text-sm font-black text-brand-text">
                    {formatPrice(order.price)}
                  </span>
                )}
                <span className="text-xs text-brand-muted">{formatDate(order.createdAt)}</span>
              </>
            )}

            {/* Cancelar botão (só em pedidos + aguardando + compra-direta) */}
            {canCancel && (
              <button
                onClick={() => setCancelDialogOpen(true)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-2 py-1 rounded transition-colors"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </div>

        {/* Mensagem de restrição */}
        {restrictionMessage && (
          <p className="text-xs text-brand-muted italic">{restrictionMessage}</p>
        )}
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Voltar</Button>} />
            <Button
              onClick={handleConfirmCancel}
              disabled={isCanceling}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isCanceling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
