'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function OrderCancellationDialog({ onClose, onConfirm }: {
  onClose(): void
  onConfirm(reason: string): Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500
  async function confirm() {
    if (!valid || pending) return
    setPending(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch {
      setError('Não foi possível cancelar. Atualize o pedido e tente novamente.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>Informe o motivo. O cancelamento será registrado e o estoque será devolvido.</DialogDescription>
        </DialogHeader>
        <label htmlFor="order-cancellation-reason">Motivo do cancelamento</label>
        <Textarea id="order-cancellation-reason" value={reason} onChange={(event) => setReason(event.target.value)}
          minLength={5} maxLength={500} disabled={pending} aria-describedby="order-cancellation-hint" />
        <p id="order-cancellation-hint" className="text-sm text-muted-foreground">Use de 5 a 500 caracteres.</p>
        {error && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Voltar</Button>
          <Button onClick={confirm} disabled={!valid || pending}>{pending ? 'Cancelando…' : 'Confirmar cancelamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
