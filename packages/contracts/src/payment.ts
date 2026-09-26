import { z } from 'zod'

export const PaymentMethodSchema = z.enum(['pix', 'card'])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const SimulatedPaymentOutcomeSchema = z.enum(['approved', 'declined', 'pending'])
export type SimulatedPaymentOutcome = z.infer<typeof SimulatedPaymentOutcomeSchema>

export const SimulatedPaymentRequestSchema = z.object({
  orderId: z.string().optional(),
  amount: z.number().int().nonnegative(), // centavos
  method: PaymentMethodSchema,
  simulationOutcome: SimulatedPaymentOutcomeSchema.default('approved'),
})
export type SimulatedPaymentRequest = z.infer<typeof SimulatedPaymentRequestSchema>

export const SimulatedPaymentResultSchema = z.object({
  status: SimulatedPaymentOutcomeSchema,
  transactionId: z.string().min(1),
  paidAt: z.string().optional(), // ISO 8601 quando approved
  refusalReason: z.string().optional(), // quando declined
})
export type SimulatedPaymentResult = z.infer<typeof SimulatedPaymentResultSchema>
