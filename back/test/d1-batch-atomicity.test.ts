import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { orders } from '../src/schema/orders'
import type { Env } from '../src/env'

describe('D1 batch atomicity (RN-03)', () => {
  beforeAll(async () => {
    // Aplica migrations reais
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  /**
   * Prova de atomicidade: dois inserts com mesmo PRIMARY KEY.
   * A segunda statement falha (violação de PK), e ambas são revertidas.
   * Isso prova que db.batch() funciona como uma transação atômica.
   */
  it('db.batch([insert, insert] com conflito de PK → ambas são revertidas', async () => {
    const db = drizzle(env.DB)

    const addressJson = JSON.stringify({
      logradouro: 'Rua A',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
    })

    const commonId = 'order-conflict-1'

    // Tenta gravar 2 orders com o mesmo ID num mesmo batch.
    // A segunda falha (PRIMARY KEY violation), então ambas devem ser revertidas.
    try {
      await db.batch([
        db
          .insert(orders)
          .values({
            id: commonId,
            uid: 'uid-test-1',
            type: 'compra-direta',
            status: 'aguardando',
            product: 'Fralda',
            quantity: 100,
            unit: 'cx',
            deliveryAddress: addressJson,
            createdAt: new Date().toISOString(),
          }),
        db
          .insert(orders)
          .values({
            id: commonId, // Conflita com a primeira
            uid: 'uid-test-2',
            type: 'compra-direta',
            status: 'aguardando',
            product: 'Toalha',
            quantity: 50,
            unit: 'un',
            deliveryAddress: addressJson,
            createdAt: new Date().toISOString(),
          }),
      ])
      // Se chegou aqui, o batch não foi atômico (erro!)
      throw new Error('batch() deveria ter lançado erro, mas não lançou')
    } catch (error) {
      // Esperado: violação de PRIMARY KEY
      if (error instanceof Error && error.message === 'batch() deveria ter lançado erro, mas não lançou') {
        throw error
      }
      // Passou pelo erro esperado, continua
    }

    // Agora verifica se NENHUMA das duas foi persistida
    // (prova que a primeira foi revertida também, não só a segunda)
    const check = await db
      .select()
      .from(orders)
      .all()

    const found = check.find((o) => o.id === commonId)

    expect(found).toBeUndefined()
  })
})
