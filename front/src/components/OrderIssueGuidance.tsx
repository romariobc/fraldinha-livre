'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import OrderOccurrences from './OrderOccurrences'

/** Shared entry into persisted support, independent of commercial order transitions. */
export default function OrderIssueGuidance({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Problema com o pedido</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Atendimento por ocorrência</DialogTitle>
        <DialogDescription>Abra e acompanhe problemas vinculados ao pedido. Após o despacho, o cancelamento direto fica indisponível.</DialogDescription></DialogHeader>
        <OrderOccurrences orderId={orderId} />
        <Button variant="outline" onClick={() => setOpen(false)}>Voltar ao pedido</Button>
      </DialogContent>
    </Dialog>
  </>
}
