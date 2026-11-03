import { CheckCircle2, XCircle, Package, MapPin, User, ShoppingBag, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils'
import { type SupplierOrderRow, formatDate, getStatusBadge } from './model'

interface OrderDetailsProps {
 isDetailOpen: boolean
 setIsDetailOpen(open: boolean): void
 selectedOrder: SupplierOrderRow | null
 handleRefuseOrder(id: string): void
 handleConfirmOrder(id: string): void
 handleUpdateStatus(id: string, status: 'confirmado' | 'a-caminho' | 'entregue' | 'cancelado'): void
}

export function OrderDetailsDialog({ isDetailOpen, setIsDetailOpen, selectedOrder, handleRefuseOrder, handleConfirmOrder, handleUpdateStatus }: OrderDetailsProps) {
 return (<Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
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
                {selectedOrder.status === 'confirmado' && (
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
                      Cancelar Pedido
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        handleUpdateStatus(selectedOrder.id, 'a-caminho')
                        setIsDetailOpen(false)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Truck className="size-4 mr-1.5" />
                      Despachar Pedido
                    </Button>
                  </>
                )}
                {selectedOrder.status === 'a-caminho' && (
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
                      Cancelar Pedido
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        handleUpdateStatus(selectedOrder.id, 'entregue')
                        setIsDetailOpen(false)
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <CheckCircle2 className="size-4 mr-1.5" />
                      Confirmar Entrega
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
      </Dialog>)
}
