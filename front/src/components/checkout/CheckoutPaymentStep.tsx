interface Props {
  method: 'pix' | 'card'
  setMethod(method: 'pix' | 'card'): void
  outcome: 'approved' | 'declined'
  setOutcome(outcome: 'approved' | 'declined'): void
  submitting: boolean
  onBack(): void
  onPay(): Promise<void>
}
export function CheckoutPaymentStep({ method, setMethod, outcome, setOutcome, submitting, onBack, onPay }: Props) {
  return <div className="max-w-2xl mx-auto space-y-6">
    <h1 className="font-display font-black text-2xl text-brand-text">Pagamento simulado</h1>
    <div className="bg-white rounded-card shadow-card p-6 space-y-6">
      <p className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">Ambiente demonstrativo: nenhuma cobrança real será realizada. Não informe dados reais de cartão. A aprovação ou recusa é registrada por fornecedor.</p>
      <fieldset disabled={submitting} className="space-y-3">
        <legend className="font-bold mb-2">Método da simulação</legend>
        <label className="flex items-center gap-3"><input type="radio" name="payment" checked={method === 'pix'} onChange={() => setMethod('pix')} />Pix simulado</label>
        <label className="flex items-center gap-3"><input type="radio" name="payment" checked={method === 'card'} onChange={() => setMethod('card')} />Cartão simulado, sem dados do cartão</label>
      </fieldset>
      <fieldset disabled={submitting} className="space-y-3">
        <legend className="font-bold mb-2">Resultado da simulação</legend>
        <label className="flex items-center gap-3"><input type="radio" name="simulationOutcome" checked={outcome === 'approved'} onChange={() => setOutcome('approved')} />Aprovar simulação</label>
        <label className="flex items-center gap-3"><input type="radio" name="simulationOutcome" checked={outcome === 'declined'} onChange={() => setOutcome('declined')} />Recusar simulação</label>
      </fieldset>
      <div className="flex gap-3">
        <button type="button" disabled={submitting} onClick={onBack} className="flex-1 rounded-full border border-slate-300 px-4 py-3 disabled:opacity-50">Voltar</button>
        <button type="button" disabled={submitting} onClick={onPay} className="flex-1 rounded-full bg-primary-dark text-white px-4 py-3 font-bold disabled:opacity-50">{submitting ? 'Registrando...' : 'Confirmar compra simulada'}</button>
      </div>
    </div>
  </div>
}
