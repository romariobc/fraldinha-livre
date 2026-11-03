import { z } from 'zod'

export const SupplierStatusSchema = z.enum(['pendente', 'aprovado', 'rejeitado', 'suspenso'])
export const SupplierApplicationSchema = z.object({
  uid: z.string().min(1),
  status: SupplierStatusSchema,
  reason: z.string().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SupplierApplication = z.infer<typeof SupplierApplicationSchema>
export const SupplierDecisionSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado', 'suspenso']),
  reason: z.string().trim().min(5).max(500),
  expectedVersion: z.number().int().nonnegative(),
}).strict()
export const SupplierApplicationListSchema = z.object({
  applications: z.array(SupplierApplicationSchema),
  nextCursor: z.string().nullable(),
})
