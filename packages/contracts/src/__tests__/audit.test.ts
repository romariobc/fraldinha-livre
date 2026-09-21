import { describe, expect, it } from 'vitest'
import {
  AdminAuditLogsResponseSchema,
  AdminModerateProductSchema,
  AuditEventSchema,
  AuditLogQuerySchema,
} from '../audit'

describe('Audit contracts', () => {
  it('valida evento administrativo completo', () => {
    const event = AuditEventSchema.parse({
      id: 'audit-1',
      actorId: 'admin-1',
      actorRole: 'admin',
      targetType: 'product',
      targetId: 'product-1',
      action: 'product.deactivated',
      reason: 'Produto fora da política comercial',
      metadata: { oldActive: true, newActive: false },
      requestId: 'req-1',
      createdAt: '2026-09-20T12:00:00.000Z',
    })

    expect(event.targetType).toBe('product')
  })

  it('exige justificativa entre 5 e 500 caracteres', () => {
    expect(() => AdminModerateProductSchema.parse({ active: false, reason: 'não' })).toThrow()
    expect(() => AdminModerateProductSchema.parse({ active: false, reason: 'Motivo válido' })).not.toThrow()
  })

  it('aplica defaults e limita paginação da consulta', () => {
    expect(AuditLogQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
    expect(() => AuditLogQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it('valida resposta paginada', () => {
    const response = AdminAuditLogsResponseSchema.parse({ logs: [], total: 0, page: 1, limit: 20 })
    expect(response.total).toBe(0)
  })
})
