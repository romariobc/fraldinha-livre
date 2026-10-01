// scripts/test-e2e-logic.test.mjs
// Testes unitários para as funções puras e regras do script test-e2e-catalog-to-history.mjs
// Utiliza o test runner nativo do Node.js (node:test) sem dependência externa.

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkEnvironmentLock,
  validateAdminOrder,
  computeSummary,
} from './test-e2e-catalog-to-history.mjs'

describe('test-e2e-catalog-to-history: checkEnvironmentLock', () => {
  it('bloqueia execução contra produção quando allowWrite=false com exitCode 2', () => {
    const lock = checkEnvironmentLock({
      apiUrl: 'https://fraldinha-livre-backend.romariobc.workers.dev',
      allowWrite: false,
    })
    assert.equal(lock.isProduction, true)
    assert.equal(lock.blocked, true)
    assert.equal(lock.exitCode, 2)
    assert.match(lock.message, /EXECUÇÃO BLOQUEADA POR SEGURANÇA/)
  })

  it('permite execução contra produção quando allowWrite=true', () => {
    const lock = checkEnvironmentLock({
      apiUrl: 'https://fraldinha-livre-backend.romariobc.workers.dev',
      allowWrite: true,
    })
    assert.equal(lock.isProduction, true)
    assert.equal(lock.blocked, false)
    assert.equal(lock.exitCode, 0)
  })

  it('permite execução em ambiente local ou preview sem necessidade de allowWrite', () => {
    const lock = checkEnvironmentLock({
      apiUrl: 'http://127.0.0.1:8787',
      allowWrite: false,
    })
    assert.equal(lock.isProduction, false)
    assert.equal(lock.blocked, false)
    assert.equal(lock.exitCode, 0)
  })
})

describe('test-e2e-catalog-to-history: validateAdminOrder', () => {
  const validOrder = {
    id: 'ord-123',
    uid: 'buyer-uid-1',
    supplierId: 'sup-uid-1',
    status: 'entregue',
    paymentTransactionId: 'tx-sim-999',
    items: [{ productId: 'prod-1', quantity: 2 }],
  }

  it('valida pedido administrativo em conformidade integral', () => {
    const res = validateAdminOrder(validOrder, {
      expectedOrderId: 'ord-123',
      expectedBuyerUid: 'buyer-uid-1',
      expectedSupplierUid: 'sup-uid-1',
      expectedStatus: 'entregue',
      expectedPaymentTxId: 'tx-sim-999',
    })
    assert.equal(res.ok, true)
    assert.equal(res.errors.length, 0)
  })

  it('reprova quando o pedido for nulo ou indefinido', () => {
    const res = validateAdminOrder(null)
    assert.equal(res.ok, false)
    assert.match(res.errors[0], /não encontrado/i)
  })

  it('detecta divergências em campos individuais (ID, status, comprador, fornecedor)', () => {
    const res = validateAdminOrder(validOrder, {
      expectedOrderId: 'ord-outro',
      expectedBuyerUid: 'buyer-outro',
      expectedSupplierUid: 'sup-outro',
      expectedStatus: 'aguardando',
      expectedPaymentTxId: 'tx-outro',
    })
    assert.equal(res.ok, false)
    assert.equal(res.errors.length, 5)
  })

  it('reprova pedido que não contenha itens', () => {
    const orderWithoutItems = { ...validOrder, items: [] }
    const res = validateAdminOrder(orderWithoutItems, { expectedOrderId: 'ord-123' })
    assert.equal(res.ok, false)
    assert.match(res.errors[0], /itens/i)
  })
})

describe('test-e2e-catalog-to-history: computeSummary', () => {
  it('computa aprovação com exitCode 0 quando todas as etapas são bem-sucedidas', () => {
    const results = [
      { step: '1. Auth', ok: true, category: 'functional' },
      { step: '2. Criar pedido', ok: true, category: 'functional' },
      { step: '3. Admin check', ok: true, category: 'admin' },
      { step: '4. Teardown', ok: true, category: 'cleanup' },
    ]
    const summary = computeSummary(results, { isProduction: false, blocked: false })
    assert.equal(summary.allPassed, true)
    assert.equal(summary.verdict, 'APROVADO')
    assert.equal(summary.exitCode, 0)
    assert.equal(summary.hasFunctionalFailure, false)
    assert.equal(summary.hasCleanupFailure, false)
  })

  it('detecta falha funcional e define exitCode 1', () => {
    const results = [
      { step: '1. Auth', ok: true, category: 'functional' },
      { step: '2. Criar pedido', ok: false, category: 'functional' },
      { step: '3. Teardown', ok: true, category: 'cleanup' },
    ]
    const summary = computeSummary(results, { isProduction: false, blocked: false })
    assert.equal(summary.allPassed, false)
    assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
    assert.equal(summary.exitCode, 1)
    assert.equal(summary.hasFunctionalFailure, true)
  })

  it('CRÍTICO: falha de teardown reprova a suíte e define exitCode 1 mesmo com etapas funcionais aprovadas', () => {
    const results = [
      { step: '1. Auth', ok: true, category: 'functional' },
      { step: '2. Criar pedido', ok: true, category: 'functional' },
      { step: '3. Admin check', ok: true, category: 'admin' },
      { step: '4. Teardown', ok: false, category: 'cleanup', error: 'HTTP 500' },
    ]
    const summary = computeSummary(results, { isProduction: false, blocked: false })
    assert.equal(summary.allPassed, false)
    assert.equal(summary.verdict, 'FALHA_DE_LIMPEZA')
    assert.equal(summary.exitCode, 1)
    assert.equal(summary.hasCleanupFailure, true)
    assert.equal(summary.hasFunctionalFailure, false)
  })

  it('emite alerta de retenção de pedido permanente quando executado em produção', () => {
    const results = [
      { step: '1. Auth', ok: true, category: 'functional' },
      { step: '2. Teardown', ok: true, category: 'cleanup' },
    ]
    const summary = computeSummary(results, { isProduction: true, blocked: false })
    assert.equal(summary.isProductionPermanentOrderWarning, true)
  })

  it('reproduz veredito de BLOQUEADO_POR_SEGURANCA com exitCode 2', () => {
    const summary = computeSummary([], { isProduction: true, blocked: true, exitCode: 2 })
    assert.equal(summary.verdict, 'BLOQUEADO_POR_SEGURANCA')
    assert.equal(summary.exitCode, 2)
    assert.equal(summary.allPassed, false)
  })
})
