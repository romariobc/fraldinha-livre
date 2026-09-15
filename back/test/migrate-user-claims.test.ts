import { describe, it, expect, vi } from 'vitest'
import { runMigration, type UserToMigrate } from '../scripts/migrate-user-claims'

describe('migrate-user-claims — Migração Administrativa de Custom Claims (AUTH-001)', () => {
  it('migra compradores e fornecedores válidos com sucesso', async () => {
    const users: UserToMigrate[] = [
      { uid: 'u1', role: 'comprador', email: 'c1@teste.com' },
      { uid: 'u2', role: 'fornecedor', email: 'f1@teste.com' },
    ]

    const mockLookup = vi.fn().mockResolvedValue(null) // Nenhum claim existente
    const mockProvision = vi.fn().mockResolvedValue(undefined)

    const summary = await runMigration(
      users,
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      },
      {
        lookupClaims: mockLookup,
        provisionClaims: mockProvision,
      }
    )

    expect(summary.total).toBe(2)
    expect(summary.provisioned).toBe(2)
    expect(summary.errors).toBe(0)
    expect(summary.rejectedUnallowed).toBe(0)

    expect(mockProvision).toHaveBeenCalledWith(
      'u1',
      { role: 'comprador', comprador: true },
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      }
    )
    expect(mockProvision).toHaveBeenCalledWith(
      'u2',
      { role: 'fornecedor', fornecedor: true },
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      }
    )
  })

  it('rejeita com segurança tentativas de migração para admin ou roles arbitrárias', async () => {
    const users: UserToMigrate[] = [
      { uid: 'u-admin', role: 'admin', email: 'attacker@teste.com' },
      { uid: 'u-evil', role: 'superadmin', email: 'evil@teste.com' },
      { uid: 'u-rand', role: 'qualquer-coisa', email: 'rand@teste.com' },
    ]

    const mockLookup = vi.fn()
    const mockProvision = vi.fn()

    const summary = await runMigration(
      users,
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      },
      {
        lookupClaims: mockLookup,
        provisionClaims: mockProvision,
      }
    )

    expect(summary.total).toBe(3)
    expect(summary.rejectedUnallowed).toBe(3)
    expect(summary.provisioned).toBe(0)
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('é idempotente para usuários que já possuem a role esperada', async () => {
    const users: UserToMigrate[] = [
      { uid: 'u-already', role: 'fornecedor', email: 'existing@teste.com' },
    ]

    const mockLookup = vi.fn().mockResolvedValue({ customAttributes: { role: 'fornecedor', fornecedor: true } })
    const mockProvision = vi.fn()

    const summary = await runMigration(
      users,
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      },
      {
        lookupClaims: mockLookup,
        provisionClaims: mockProvision,
      }
    )

    expect(summary.alreadyProvisioned).toBe(1)
    expect(summary.provisioned).toBe(0)
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('bloqueia mutações conflitantes (ex: comprador tentando virar fornecedor via migração)', async () => {
    const users: UserToMigrate[] = [
      { uid: 'u-conflict', role: 'fornecedor', email: 'conflict@teste.com' },
    ]

    const mockLookup = vi.fn().mockResolvedValue({ customAttributes: { role: 'comprador', comprador: true } })
    const mockProvision = vi.fn()

    const summary = await runMigration(
      users,
      {
        projectId: 'test-proj',
        clientEmail: 'test@service.com',
        privateKey: 'key',
      },
      {
        lookupClaims: mockLookup,
        provisionClaims: mockProvision,
      }
    )

    expect(summary.conflicts).toBe(1)
    expect(summary.provisioned).toBe(0)
    expect(mockProvision).not.toHaveBeenCalled()
  })
})
