// scripts/test-e2e-logic.test.mjs
// Testes unitários para as funções puras e regras do script test-e2e-catalog-to-history.mjs
// Utiliza o test runner nativo do Node.js (node:test) sem dependência externa.

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkEnvironmentLock,
  checkPrerequisites,
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
    assert.equal(lock.verdict, 'BLOQUEADO_POR_SEGURANCA')
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
    assert.equal(lock.verdict, 'APROVADO')
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

describe('test-e2e-catalog-to-history: checkPrerequisites', () => {
  const validLocalConfig = {
    apiUrl: 'http://127.0.0.1:8787',
    buyerEmail: 'comprador@teste.com',
    buyerPassword: 'pass-buyer',
    supplierEmail: 'fornecedor@teste.com',
    supplierPassword: 'pass-supplier',
    adminEmail: 'admin@teste.com',
    adminPassword: 'pass-admin',
    requireAdmin: false,
    allowWrite: false,
  }

  it('aprova configuração válida em ambiente local', () => {
    const res = checkPrerequisites(validLocalConfig)
    assert.equal(res.ok, true)
    assert.equal(res.blocked, false)
    assert.equal(res.exitCode, 0)
  })

  it('bloqueia antes de chamadas mutáveis se ambiente for produção e allowWrite=false (exitCode 2)', () => {
    const res = checkPrerequisites({
      ...validLocalConfig,
      apiUrl: 'https://fraldinha-livre-backend.romariobc.workers.dev',
      allowWrite: false,
    })
    assert.equal(res.ok, false)
    assert.equal(res.blocked, true)
    assert.equal(res.exitCode, 2)
    assert.equal(res.verdict, 'BLOQUEADO_POR_SEGURANCA')
  })

  it('bloqueia antes de chamadas mutáveis se credencial admin ausente quando requireAdmin=true (exitCode 1)', () => {
    const res = checkPrerequisites({
      ...validLocalConfig,
      adminPassword: '',
      requireAdmin: true,
    })
    assert.equal(res.ok, false)
    assert.equal(res.blocked, true)
    assert.equal(res.exitCode, 1)
    assert.equal(res.verdict, 'FALHA_CONFIGURACAO')
    assert.match(res.message, /QA_ADMIN_PASSWORD/)
  })

  it('bloqueia se credenciais de comprador ou fornecedor estiverem ausentes (exitCode 1)', () => {
    const res = checkPrerequisites({
      ...validLocalConfig,
      buyerPassword: '',
    })
    assert.equal(res.ok, false)
    assert.equal(res.blocked, true)
    assert.equal(res.exitCode, 1)
    assert.equal(res.verdict, 'FALHA_CONFIGURACAO')
    assert.match(res.message, /QA_BUYER_PASSWORD/)
  })
})

describe('test-e2e-catalog-to-history: validateAdminOrder', () => {
  const validOrder = {
    id: 'ord-123',
    uid: 'buyer-uid-1',
    supplierId: 'sup-uid-1',
    supplierName: 'Distribuidora Sul Teste',
    status: 'entregue',
    paymentMethod: 'simulado',
    paymentStatus: 'pago',
    paymentTransactionId: 'tx-sim-999',
    items: [{ productId: 'prod-1', quantity: 2 }],
  }

  const expectedValid = {
    expectedOrderId: 'ord-123',
    expectedBuyerUid: 'buyer-uid-1',
    expectedSupplierUid: 'sup-uid-1',
    expectedSupplierName: 'Distribuidora Sul Teste',
    expectedStatus: 'entregue',
    expectedProductId: 'prod-1',
    expectedPaymentMethod: 'simulado',
    expectedPaymentStatus: 'pago',
    expectedPaymentTxId: 'tx-sim-999',
  }

  it('1. pedido correto é aceito com conformidade integral', () => {
    const res = validateAdminOrder(validOrder, expectedValid)
    assert.equal(res.ok, true)
    assert.equal(res.errors.length, 0)
  })

  it('2. pedido ausente (nulo ou indefinido) falha', () => {
    const res = validateAdminOrder(null, expectedValid)
    assert.equal(res.ok, false)
    assert.match(res.errors[0], /não encontrado/i)
  })

  it('3. comprador divergente falha', () => {
    const res = validateAdminOrder(
      { ...validOrder, uid: 'outro-comprador' },
      expectedValid
    )
    assert.equal(res.ok, false)
    assert.match(res.errors[0], /UID do comprador divergente/i)
  })

  it('4. fornecedor divergente falha (supplierId ou supplierName)', () => {
    const resId = validateAdminOrder(
      { ...validOrder, supplierId: 'outro-fornecedor' },
      expectedValid
    )
    assert.equal(resId.ok, false)
    assert.match(resId.errors[0], /UID do fornecedor divergente/i)

    const resName = validateAdminOrder(
      { ...validOrder, supplierName: 'Outro Nome Fornecedor' },
      expectedValid
    )
    assert.equal(resName.ok, false)
    assert.match(resName.errors[0], /Nome do fornecedor divergente/i)
  })

  it('5. status divergente falha', () => {
    const res = validateAdminOrder(
      { ...validOrder, status: 'cancelado' },
      expectedValid
    )
    assert.equal(res.ok, false)
    assert.match(res.errors[0], /Status do pedido divergente/i)
  })

  it('6. itens divergentes falham (lista vazia ou produto ausente)', () => {
    const emptyItems = validateAdminOrder(
      { ...validOrder, items: [] },
      expectedValid
    )
    assert.equal(emptyItems.ok, false)
    assert.match(emptyItems.errors[0], /itens do pedido vazia/i)

    const wrongProduct = validateAdminOrder(
      { ...validOrder, items: [{ productId: 'outro-prod', quantity: 1 }] },
      expectedValid
    )
    assert.equal(wrongProduct.ok, false)
    assert.match(wrongProduct.errors[0], /não contém o produto esperado/i)
  })

  it('7. pagamento divergente falha (método, status ou ID de transação)', () => {
    const wrongMethod = validateAdminOrder(
      { ...validOrder, paymentMethod: 'cartao' },
      expectedValid
    )
    assert.equal(wrongMethod.ok, false)
    assert.match(wrongMethod.errors[0], /Método de pagamento divergente/i)

    const wrongStatus = validateAdminOrder(
      { ...validOrder, paymentStatus: 'pendente' },
      expectedValid
    )
    assert.equal(wrongStatus.ok, false)
    assert.match(wrongStatus.errors[0], /Status de pagamento divergente/i)

    const wrongTxId = validateAdminOrder(
      { ...validOrder, paymentTransactionId: 'tx-diferente' },
      expectedValid
    )
    assert.equal(wrongTxId.ok, false)
    assert.match(wrongTxId.errors[0], /ID de transação divergente/i)
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
