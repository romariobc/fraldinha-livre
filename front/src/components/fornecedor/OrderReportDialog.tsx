'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import OrderOccurrences from '@/components/OrderOccurrences'

interface OrderReportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  buyerName: string
}
export function OrderReportDialog({ isOpen, onOpenChange, orderId }: OrderReportDialogProps) {
  return <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Atendimento por ocorrência</DialogTitle>
        <DialogDescription>Converse com o comprador e a administração sobre este pedido.</DialogDescription></DialogHeader>
      <OrderOccurrences orderId={orderId} />
    </DialogContent>
  </Dialog>
}
