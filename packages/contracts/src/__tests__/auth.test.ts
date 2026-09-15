import { describe, it, expect } from 'vitest'
import {
  ProvisionRoleRequestSchema,
  ProvisionRoleResponseSchema,
  AllowedProvisionRoles,
} from '../auth'

describe('Auth Contracts (Zod)', () => {
  it('ProvisionRoleRequestSchema aceita comprador e fornecedor', () => {
    expect(ProvisionRoleRequestSchema.parse({ role: 'comprador' })).toEqual({ role: 'comprador' })
    expect(ProvisionRoleRequestSchema.parse({ role: 'fornecedor' })).toEqual({ role: 'fornecedor' })
  })

  it('ProvisionRoleRequestSchema REJEITA admin', () => {
    expect(() => ProvisionRoleRequestSchema.parse({ role: 'admin' })).toThrow()
  })

  it('ProvisionRoleRequestSchema REJEITA strings arbitrárias', () => {
    expect(() => ProvisionRoleRequestSchema.parse({ role: 'super-user' })).toThrow()
    expect(() => ProvisionRoleRequestSchema.parse({ role: '' })).toThrow()
    expect(() => ProvisionRoleRequestSchema.parse({})).toThrow()
  })

  it('ProvisionRoleResponseSchema valida resposta de sucesso', () => {
    const valid = { success: true, role: 'fornecedor', alreadyProvisioned: false }
    expect(ProvisionRoleResponseSchema.parse(valid)).toEqual(valid)
  })
})
