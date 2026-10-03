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
  runE2E,
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

  it('8. regressão PR #18: rejeita quando pedido foi criado com pix/approved mas expectativas esperam simulado/pago', () => {
    const orderCreatedWithPix = {
      ...validOrder,
      paymentMethod: 'pix',
      paymentStatus: 'approved',
    }
    // Expectativas antigas que causavam a rejeição
    const outdatedExpectations = {
      ...expectedValid,
      expectedPaymentMethod: 'simulado',
      expectedPaymentStatus: 'pago',
    }
    const res = validateAdminOrder(orderCreatedWithPix, outdatedExpectations)
    assert.equal(res.ok, false)
    assert.equal(res.errors.length, 2)
    assert.match(res.errors[0], /Método de pagamento divergente: esperado simulado, obtido pix/)
    assert.match(res.errors[1], /Status de pagamento divergente: esperado pago, obtido approved/)
  })

  it('9. aprova pedido criado com pix/approved quando expectativas de admin forem coerentes com o contrato', () => {
    const orderCreatedWithPix = {
      ...validOrder,
      paymentMethod: 'pix',
      paymentStatus: 'approved',
    }
    const coherentExpectations = {
      ...expectedValid,
      expectedPaymentMethod: 'pix',
      expectedPaymentStatus: 'approved',
    }
    const res = validateAdminOrder(orderCreatedWithPix, coherentExpectations)
    assert.equal(res.ok, true)
    assert.equal(res.errors.length, 0)
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

describe('test-e2e-catalog-to-history: runE2E() fluxo completo e regressões', () => {
  const createMockEnvironment = (options = {}) => {
    const calls = []
    const createdProductId = 'prod-e2e-test-123'
    const createdOrderId = 'ord-e2e-test-456'
    let currentOrderStatus = 'aguardando'
    let inCatalog = true
    let lastOrderBody = null

    const authFn = async (email, password) => {
      if (options.failAuth) {
        throw new Error('Falha simulada de autenticação')
      }
      if (email.includes('supplier') || email.includes('fornecedor')) {
        return { idToken: 'token-supplier', uid: 'supplier-uid-1', email }
      }
      if (email.includes('buyer') || email.includes('comprador')) {
        return { idToken: 'token-buyer', uid: 'buyer-uid-1', email }
      }
      if (email.includes('admin')) {
        if (options.failAdminAuth) {
          throw new Error('Falha de rede na autenticação administrativa')
        }
        return { idToken: 'token-admin', uid: 'admin-uid-1', email }
      }
      return { idToken: 'token-user', uid: 'user-uid-1', email }
    }

    const fetchFn = async (url, init = {}) => {
      const method = (init.method || 'GET').toUpperCase()
      const headers = init.headers || {}
      let body = null
      if (init.body) {
        try {
          body = JSON.parse(init.body)
        } catch {
          body = init.body
        }
      }
      const record = { url, method, headers, body }
      calls.push(record)

      // POST /products
      if (url.endsWith('/products') && method === 'POST') {
        if (options.throwStep2) {
          throw new TypeError('fetch failed')
        }
        if (options.failStep2) {
          return new Response(JSON.stringify({ error: 'Erro ao cadastrar produto' }), { status: 400 })
        }
        return new Response(JSON.stringify({ id: createdProductId }), { status: 201 })
      }

      // GET /products
      if (url.endsWith('/products') && method === 'GET') {
        if (options.malformedJsonStep3) {
          return new Response('<html>502 Bad Gateway</html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          })
        }
        if (!inCatalog) {
          return new Response(JSON.stringify([]), { status: 200 })
        }
        return new Response(
          JSON.stringify([
            {
              id: createdProductId,
              supplierId: 'supplier-uid-1',
              priceCents: 2490,
              name: 'Fralda E2E QA Teste',
            },
          ]),
          { status: 200 }
        )
      }

      // POST /orders
      if (url.endsWith('/orders') && method === 'POST') {
        if (options.throwStep4) {
          throw new TypeError('fetch failed on order creation')
        }
        if (options.failStep4) {
          return new Response(JSON.stringify({ error: 'Erro ao criar pedido' }), { status: 400 })
        }
        lastOrderBody = body
        return new Response(
          JSON.stringify({
            id: createdOrderId,
            status: 'aguardando',
            paymentStatus: 'approved',
          }),
          { status: 201 }
        )
      }

      // GET /orders?scope=fornecedor
      if (url.includes('/orders?scope=fornecedor') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              id: createdOrderId,
              status: currentOrderStatus,
              product: 'Fralda E2E QA Teste',
            },
          ]),
          { status: 200 }
        )
      }

      // PATCH /orders/:id/status
      if (url.includes('/orders/') && url.endsWith('/status') && method === 'PATCH') {
        currentOrderStatus = body?.status || currentOrderStatus
        return new Response(JSON.stringify({ id: createdOrderId, status: currentOrderStatus }), { status: 200 })
      }

      // GET /orders (buyer)
      if (url.endsWith('/orders') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              id: createdOrderId,
              status: currentOrderStatus,
            },
          ]),
          { status: 200 }
        )
      }

      // GET /orders?scope=admin
      if (url.includes('/orders?scope=admin') && method === 'GET') {
        if (options.adminReturnsWrongPayment) {
          return new Response(
            JSON.stringify([
              {
                id: createdOrderId,
                uid: 'buyer-uid-1',
                supplierId: 'supplier-uid-1',
                supplierName: 'Distribuidora Sul Teste',
                status: 'entregue',
                items: [{ productId: createdProductId, quantity: 2 }],
                paymentMethod: 'simulado',
                paymentStatus: 'pago',
                paymentTransactionId: 'tx-errada',
              },
            ]),
            { status: 200 }
          )
        }
        return new Response(
          JSON.stringify([
            {
              id: createdOrderId,
              uid: 'buyer-uid-1',
              supplierId: 'supplier-uid-1',
              supplierName: 'Distribuidora Sul Teste',
              status: 'entregue',
              items: [{ productId: createdProductId, quantity: 2 }],
              paymentMethod: lastOrderBody?.paymentMethod || 'pix',
              paymentStatus: lastOrderBody?.paymentStatus || 'approved',
              paymentTransactionId: lastOrderBody?.paymentTransactionId,
            },
          ]),
          { status: 200 }
        )
      }

      // DELETE /products/:id
      if (url.includes('/products/') && method === 'DELETE') {
        if (options.failTeardown) {
          return new Response(JSON.stringify({ error: 'Erro ao excluir' }), { status: 500 })
        }
        inCatalog = false
        return new Response(null, { status: 204 })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const defaultRunOptions = {
      apiUrl: 'http://127.0.0.1:8787',
      firebaseApiKey: 'mock-key',
      buyerEmail: 'comprador.teste@fraldinhalivre.com.br',
      buyerPassword: 'pwd-buyer',
      supplierEmail: 'fornecedor.teste1@fraldinhalivre.com.br',
      supplierPassword: 'pwd-supplier',
      adminEmail: 'admin@fraldinhalivre.com.br',
      adminPassword: options.adminPassword !== undefined ? options.adminPassword : 'pwd-admin',
      requireAdmin: options.requireAdmin !== undefined ? options.requireAdmin : false,
      allowWrite: options.allowWrite !== undefined ? options.allowWrite : false,
      fetchFn,
      authFn,
      logFn: () => {},
      warnFn: () => {},
      errorFn: () => {},
      tableFn: () => {},
    }

    return { calls, authFn, fetchFn, defaultRunOptions }
  }

  it('1. executa fluxo completo com sucesso e exit code 0 (corrige ReferenceError: envLock)', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment()
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, true)
      assert.equal(summary.verdict, 'APROVADO')
      assert.equal(summary.passedSteps, 13)
      assert.equal(summary.totalSteps, 13)
      assert.equal(summary.hasFunctionalFailure, false)
      assert.equal(summary.hasCleanupFailure, false)
      assert.equal(process.exitCode, 0)
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('2. regressão PR #18 (Achado 1): valida que POST /orders envia unit="un" (não "pct") e supplierId correto', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment()
      await runE2E(env.defaultRunOptions)

      const orderCall = env.calls.find((c) => c.method === 'POST' && c.url.endsWith('/orders'))
      assert.ok(orderCall, 'POST /orders deve ter sido disparado')
      assert.equal(orderCall.body.unit, 'un', 'Unidade do pedido raiz deve ser "un", não "pct"')
      assert.equal(orderCall.body.supplierId, 'supplier-uid-1', 'supplierId deve corresponder ao fornecedor autenticado')
      assert.equal(orderCall.body.supplierName, 'Distribuidora Sul Teste')
      assert.equal(orderCall.body.items[0].unit, 'un', 'Unidade do item deve ser "un", não "pct"')
      assert.equal(orderCall.body.items[0].productId, 'prod-e2e-test-123')
      assert.equal(orderCall.body.paymentMethod, 'pix')
      assert.equal(orderCall.body.paymentStatus, 'approved')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('3. regressão PR #18 (Achado 2): valida integração admin com pix/approved conforme pedido criado', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ adminPassword: 'admin-password-123' })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, true)
      assert.equal(summary.verdict, 'APROVADO')
      const adminCall = env.calls.find((c) => c.method === 'GET' && c.url.includes('/orders?scope=admin'))
      assert.ok(adminCall, 'Consulta administrativa de pedidos deve ter sido realizada')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('4. falha funcional em etapa de negócio resulta em exitCode 1 e veredito FALHA_FUNCIONAL (com teardown executado)', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ failStep4: true })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false)
      assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
      assert.equal(summary.hasFunctionalFailure, true)
      assert.equal(process.exitCode, 1)

      // Teardown ainda deve ter sido chamado para limpar o produto criado na etapa 2
      const deleteCall = env.calls.find((c) => c.method === 'DELETE' && c.url.includes('/products/'))
      assert.ok(deleteCall, 'Teardown deve ser executado para limpar produto criado mesmo após falha')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('5. falha no teardown resulta em exitCode 1 e veredito FALHA_DE_LIMPEZA', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ failTeardown: true })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false)
      assert.equal(summary.verdict, 'FALHA_DE_LIMPEZA')
      assert.equal(summary.hasCleanupFailure, true)
      assert.equal(summary.hasFunctionalFailure, false)
      assert.equal(process.exitCode, 1)
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('6. bloqueia execução contra produção sem autorização com exitCode 2 e zero chamadas HTTP mutáveis', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment()
      const res = await runE2E({
        ...env.defaultRunOptions,
        apiUrl: 'https://fraldinha-livre-backend.romariobc.workers.dev',
        allowWrite: false,
      })

      assert.equal(res.verdict, 'BLOQUEADO_POR_SEGURANCA')
      assert.equal(res.exitCode, 2)
      assert.equal(process.exitCode, 2)
      assert.equal(env.calls.length, 0, 'Nenhuma chamada HTTP pode ser realizada quando bloqueado')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('7. ausência de credencial administrativa obrigatória (requireAdmin=true) bloqueia com exitCode 1 antes de qualquer escrita', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ adminPassword: '' })
      const res = await runE2E({
        ...env.defaultRunOptions,
        adminPassword: '',
        requireAdmin: true,
      })

      assert.equal(res.verdict, 'FALHA_CONFIGURACAO')
      assert.equal(res.exitCode, 1)
      assert.equal(process.exitCode, 1)
      assert.equal(env.calls.length, 0, 'Nenhuma chamada HTTP de mutação deve ocorrer antes de validar pré-requisitos')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('8. [REGRESSÃO P2] exceção de rede em POST /products não pode aprovar indevidamente o E2E', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ throwStep2: true })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false, 'Suíte não pode ser aprovada quando POST /products lança exceção')
      assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
      assert.equal(process.exitCode, 1)
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('9. chamada posterior (POST /orders) lança exceção após criação do produto: teardown é executado e suíte falha', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ throwStep4: true })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false)
      assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
      assert.equal(process.exitCode, 1)

      const deleteCall = env.calls.find((c) => c.method === 'DELETE' && c.url.includes('/products/'))
      assert.ok(deleteCall, 'Teardown do produto temporário deve ter sido executado após exceção no POST /orders')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('10. json() rejeita com resposta malformada após criação do produto: teardown é executado e suíte falha', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({ malformedJsonStep3: true })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false)
      assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
      assert.equal(process.exitCode, 1)

      const deleteCall = env.calls.find((c) => c.method === 'DELETE' && c.url.includes('/products/'))
      assert.ok(deleteCall, 'Teardown do produto temporário deve ter sido executado após erro de parsing JSON')
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it('11. autenticação administrativa falha após etapas anteriores: teardown é executado e suíte falha', async () => {
    const originalExitCode = process.exitCode
    try {
      const env = createMockEnvironment({
        adminPassword: 'admin-password-test',
        failAdminAuth: true,
      })
      const summary = await runE2E(env.defaultRunOptions)

      assert.equal(summary.allPassed, false)
      assert.equal(summary.verdict, 'FALHA_FUNCIONAL')
      assert.equal(process.exitCode, 1)

      const deleteCall = env.calls.find((c) => c.method === 'DELETE' && c.url.includes('/products/'))
      assert.ok(deleteCall, 'Teardown do produto temporário deve ter sido executado após falha de autenticação do admin')
    } finally {
      process.exitCode = originalExitCode
    }
  })
})


