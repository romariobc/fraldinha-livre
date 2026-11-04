'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** MP-08 will provide opening, response and resolution; this handoff does not pretend to submit a report. */
export default function OrderIssueGuidance({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Problema com o pedido</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent><DialogHeader><DialogTitle>Atendimento por ocorrência</DialogTitle>
        <DialogDescription>Após o despacho, problemas devem ser tratados por uma ocorrência vinculada ao pedido. O cancelamento direto e a devolução automática de estoque ficam indisponíveis.</DialogDescription></DialogHeader>
        <p className="break-all text-sm">Pedido: {orderId}</p>
        <p className="text-sm">A abertura, a resposta e o acompanhamento de ocorrências ainda não estão disponíveis nesta versão. Nenhuma ocorrência foi enviada.</p>
        <Button variant="outline" onClick={() => setOpen(false)}>Voltar ao pedido</Button>
      </DialogContent>
    </Dialog>
  </>
}
