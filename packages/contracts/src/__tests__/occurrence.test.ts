import { describe, expect, it } from 'vitest'
import { CreateOccurrenceSchema, ReplyOccurrenceSchema } from '../occurrence'
describe('occurrence requests', () => {
  it('trims opening and forbids ownership or commercial fields supplied by callers', () => {
    expect(CreateOccurrenceSchema.parse({ message: '  Problema real  ' })).toEqual({ message: 'Problema real' })
    for (const extra of [{ supplierId: 'other' }, { status: 'cancelado' }, { attachments: [] }]) expect(CreateOccurrenceSchema.safeParse({ message: 'Problema real', ...extra }).success).toBe(false)
  })
  it('requires resolution text, optimistic version and request identifier; reopening is unavailable', () => {
    const body = { message: 'Solução acordada', status: 'resolvida', expectedVersion: 2, requestId: '75c23a06-358f-42fa-bc64-21d1c788239f' }
    expect(ReplyOccurrenceSchema.safeParse(body).success).toBe(true)
    for (const override of [{ message: '  ' }, { status: 'aberta' }, { expectedVersion: -1 }, { requestId: 'invalid' }]) expect(ReplyOccurrenceSchema.safeParse({ ...body, ...override }).success).toBe(false)
  })
})
