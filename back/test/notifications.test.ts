import { describe, it, expect, vi } from 'vitest'
import { notifySupplierOfNewOrder } from '../src/lib/notifications'

describe('notifySupplierOfNewOrder', () => {
  const baseParams = {
    supplierEmail: 'fornecedor@example.com',
    orderId: 'order-1',
    items: [{ productName: 'Fralda P', quantity: 2, unit: 'pct' }],
    totalCents: 3600,
  }

  it('sem supplier_email: nao chama sendEmail, nao lanca', async () => {
    const sendEmail = vi.fn()
    await notifySupplierOfNewOrder(
      { ...baseParams, supplierEmail: null },
      { notificationsEnabled: true, sendEmail },
    )
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('flag desligada: nao chama sendEmail', async () => {
    const sendEmail = vi.fn()
    await notifySupplierOfNewOrder(baseParams, { notificationsEnabled: false, sendEmail })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('flag ligada: chama sendEmail com o destinatario e assunto certos', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    await notifySupplierOfNewOrder(baseParams, { notificationsEnabled: true, sendEmail })
    expect(sendEmail).toHaveBeenCalledOnce()
    const callArgs = sendEmail.mock.calls[0][0]
    expect(callArgs.to).toBe('fornecedor@example.com')
    expect(callArgs.subject).toBe('Novo pedido recebido — Fraldinha Livre')
    expect(callArgs.text).toContain('Fralda P')
    expect(callArgs.text).toContain('order-1')
  })

  it('sendEmail rejeita: nao lanca (best-effort, RN-02)', async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error('network fail'))
    await expect(
      notifySupplierOfNewOrder(baseParams, { notificationsEnabled: true, sendEmail }),
    ).resolves.toBeUndefined()
  })
})
