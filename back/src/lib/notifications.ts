export interface OrderNotificationItem {
  productName: string
  quantity: number
  unit: string
}

export interface OrderNotificationParams {
  supplierEmail: string | null | undefined
  orderId: string
  items: OrderNotificationItem[]
  totalCents: number
}

/** Injetável — testes passam uma versão fake, produção usa `sendViaResend`. */
export type SendEmailFn = (params: { to: string; subject: string; html: string; text: string }) => Promise<void>

function escapeHTML(str: string): string {
  return str.replace(/[&<>"']/g, (m: string) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }
    return map[m] || m
  })
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildOrderEmail(params: OrderNotificationParams): { subject: string; html: string; text: string } {
  const itemsText = params.items.map((item) => `- ${item.productName} × ${item.quantity} ${item.unit}`).join('\n')
  const itemsHtml = params.items.map((item) => `<li>${escapeHTML(item.productName)} × ${escapeHTML(item.quantity.toString())} ${escapeHTML(item.unit)}</li>`).join('')
  const total = formatBRL(params.totalCents)

  return {
    subject: 'Novo pedido recebido — Fraldinha Livre',
    text: `Você recebeu um novo pedido (#${params.orderId}):\n\n${itemsText}\n\nTotal: ${total}\n\nVeja os detalhes no seu painel: https://fraldinha-livre-frontend.romariobc.workers.dev/fornecedor/painel`,
    html: `<p>Você recebeu um novo pedido (#${params.orderId}):</p><ul>${itemsHtml}</ul><p><strong>Total:</strong> ${total}</p><p><a href="https://fraldinha-livre-frontend.romariobc.workers.dev/fornecedor/painel">Ver no painel</a></p>`,
  }
}

/**
 * Notifica o fornecedor de um novo pedido — best-effort (RN-02 da spec).
 * Nunca lança: falha de envio é logada e engolida, o pedido já foi gravado antes
 * desta função ser chamada.
 */
export async function notifySupplierOfNewOrder(
  params: OrderNotificationParams,
  options: { notificationsEnabled: boolean; sendEmail: SendEmailFn },
): Promise<void> {
  if (!params.supplierEmail) {
    // Produto sem e-mail cadastrado (ex.: fornecedor semeado sem conta Firebase real) — sem erro, só não notifica.
    return
  }

  const { subject, html, text } = buildOrderEmail(params)

  if (!options.notificationsEnabled) {
    console.log(`[notifications] enviaria para ${params.supplierEmail}: ${subject}`)
    return
  }

  try {
    await options.sendEmail({ to: params.supplierEmail, subject, html, text })
  } catch (error) {
    console.error('[notifications] falha ao enviar e-mail de novo pedido:', error)
  }
}

/** Implementação real via API REST do Resend. Remetente de teste até haver domínio verificado (ver spec). */
export async function sendViaResend(
  params: { to: string; subject: string; html: string; text: string },
  apiKey: string,
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend respondeu ${response.status}: ${body}`)
  }
}
