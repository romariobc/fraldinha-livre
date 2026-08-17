import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { apiFetch } from '@/lib/api-client'

interface OrderReportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  buyerName: string
}

export function OrderReportDialog({ isOpen, onOpenChange, orderId, buyerName }: OrderReportDialogProps) {
  const [message, setMessage] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      toast.error('Por favor, digite uma mensagem.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch(`/orders/${orderId}/report`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      })

      if (!res.ok) {
        throw new Error('Falha ao enviar reporte')
      }

      toast.success('Mensagem enviada com sucesso para o cliente.')
      setMessage('')
      onOpenChange(false)
    } catch (error) {
      toast.error('Ocorreu um erro ao enviar a mensagem. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset message when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setMessage(''), 200)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="size-4 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Reportar ao Cliente</DialogTitle>
          </div>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Ocorreu algum problema com o pedido <strong>#{orderId}</strong>? Envie uma notificação direta para <strong>{buyerName}</strong>. Esta mensagem aparecerá na caixa de avisos dele.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reportMessage" className="font-semibold text-foreground">Sua Mensagem</Label>
            <Textarea
              id="reportMessage"
              placeholder="Ex: Tivemos um imprevisto com o estoque deste tamanho, deseja substituir por outro?"
              className="min-h-[120px] resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="bg-primary text-white hover:bg-primary-dark gap-2"
            >
              {isSubmitting ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Enviar Aviso</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
