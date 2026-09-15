import { z } from 'zod'

export const AllowedProvisionRoles = ['comprador', 'fornecedor'] as const
export type AllowedProvisionRole = (typeof AllowedProvisionRoles)[number]

export const ProvisionRoleRequestSchema = z.object({
  role: z.enum(AllowedProvisionRoles),
})
export type ProvisionRoleRequest = z.infer<typeof ProvisionRoleRequestSchema>

export const ProvisionRoleResponseSchema = z.object({
  success: z.boolean(),
  role: z.enum(AllowedProvisionRoles),
  alreadyProvisioned: z.boolean().optional(),
})
export type ProvisionRoleResponse = z.infer<typeof ProvisionRoleResponseSchema>
