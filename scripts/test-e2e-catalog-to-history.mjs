// scripts/test-e2e-catalog-to-history.mjs
// Teste End-to-End de API: Ciclo de Vida de Produto e Pedido (Fornecedor -> Comprador -> Admin)
//
// NOTA IMPORTANTE DE ARQUITETURA E ESCOPO:
// Este teste realiza asserções ponta a ponta EXCLUSIVAMENTE contra as rotas HTTP da API backend (REST).
// Ele NÃO renderiza componentes React, NÃO instancia navegador headless (Puppeteer/Playwright) e
// NÃO homologa visualmente as abas PedidosTab, HistoricoTab, OrdersDataTable ou AdminOrdersTab.
// Trata-se de um teste de integração real de regras de negócio, autorização e persistência no banco D1.

import fs from 'node:fs'
import path from 'node:path'

/**
 * Valida a trava de ambiente contra escrita não autorizada em produção (Fail-Closed).
 */
export function checkEnvironmentLock({ apiUrl, allowWrite }) {
  const isProduction = apiUrl.includes('workers.dev') || apiUrl.includes('fraldinhalivre.com.br')
  if (isProduction && !allowWrite) {
    return {
      ok: false,
      isProduction: true,
      blocked: true,
      exitCode: 2,
      verdict: 'BLOQUEADO_POR_SEGURANCA',
      message:
        '⚠️  EXECUÇÃO BLOQUEADA POR SEGURANÇA: O ambiente alvo é PRODUÇÃO e a autorização de escrita (--allow-production-write ou QA_ALLOW_PRODUCTION_WRITE=true) não foi concedida. Pedidos criados em produção permanecem no banco para fins contábeis e de auditoria.',
    }
  }
  return {
    ok: true,
    isProduction,
    blocked: false,
    exitCode: 0,
    verdict: 'APROVADO',
  }
}

/**
 * Valida pré-requisitos e credenciais antes de qualquer chamada mutável (Fail-Closed).
 * Garante que credenciais ausentes abortem a execução ANTES da criação de produtos ou pedidos.
 */
export function checkPrerequisites({
  apiUrl,
  buyerEmail,
  buyerPassword,
  supplierEmail,
  supplierPassword,
  adminEmail,
  adminPassword,
  requireAdmin = false,
  allowWrite = false,
}) {
  const envLock = checkEnvironmentLock({ apiUrl, allowWrite })
  if (envLock.blocked) {
    return envLock
  }

  if (requireAdmin && (!adminEmail || !adminPassword)) {
    return {
      ok: false,
      isProduction: envLock.isProduction,
      blocked: true,
      exitCode: 1,
      verdict: 'FALHA_CONFIGURACAO',
      message:
        '❌ ERRO FAIL-CLOSED: Execução administrativa obrigatória (QA_REQUIRE_ADMIN=true ou --require-admin), mas credenciais de administrador (QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD) estão ausentes no ambiente.',
    }
  }

  if (!buyerPassword || !supplierPassword) {
    return {
      ok: false,
      isProduction: envLock.isProduction,
      blocked: true,
      exitCode: 1,
      verdict: 'FALHA_CONFIGURACAO',
      message:
        '❌ ERRO FAIL-CLOSED: Credenciais de comprador (QA_BUYER_PASSWORD) ou fornecedor (QA_SUPPLIER_PASSWORD) ausentes no ambiente.',
    }
  }

  return {
    ok: true,
    isProduction: envLock.isProduction,
    blocked: false,
    exitCode: 0,
    verdict: 'APROVADO',
  }
}

/**
 * Valida os dados de um pedido inspecionado pela rota de observabilidade administrativa (GET /orders?scope=admin).
 * Valida rigorosamente: id, uid, supplierId, supplierName (se presente), status, items, paymentMethod, paymentStatus e paymentTransactionId.
 */
export function validateAdminOrder(order, expected = {}) {
  const errors = []
  if (!order || typeof order !== 'object') {
    return { ok: false, errors: ['Pedido não encontrado na resposta administrativa'] }
  }
  if (expected.expectedOrderId && order.id !== expected.expectedOrderId) {
    errors.push(`ID do pedido divergente: esperado ${expected.expectedOrderId}, obtido ${order.id}`)
  }
  if (expected.expectedBuyerUid && order.uid !== expected.expectedBuyerUid) {
    errors.push(`UID do comprador divergente: esperado ${expected.expectedBuyerUid}, obtido ${order.uid}`)
  }
  if (expected.expectedSupplierUid && order.supplierId !== expected.expectedSupplierUid) {
    errors.push(`UID do fornecedor divergente: esperado ${expected.expectedSupplierUid}, obtido ${order.supplierId}`)
  }
  if (expected.expectedSupplierName && order.supplierName && order.supplierName !== expected.expectedSupplierName) {
    errors.push(`Nome do fornecedor divergente: esperado ${expected.expectedSupplierName}, obtido ${order.supplierName}`)
  }
  if (expected.expectedStatus && order.status !== expected.expectedStatus) {
    errors.push(`Status do pedido divergente: esperado ${expected.expectedStatus}, obtido ${order.status}`)
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('Lista de itens do pedido vazia ou inválida na visão administrativa')
  } else if (expected.expectedProductId) {
    const hasProduct = order.items.some((it) => it.productId === expected.expectedProductId)
    if (!hasProduct) {
      errors.push(`Item do pedido não contém o produto esperado ${expected.expectedProductId}`)
    }
  }
  if (expected.expectedPaymentMethod && order.paymentMethod !== expected.expectedPaymentMethod) {
    errors.push(`Método de pagamento divergente: esperado ${expected.expectedPaymentMethod}, obtido ${order.paymentMethod}`)
  }
  if (expected.expectedPaymentStatus && order.paymentStatus !== expected.expectedPaymentStatus) {
    errors.push(`Status de pagamento divergente: esperado ${expected.expectedPaymentStatus}, obtido ${order.paymentStatus}`)
  }
  if (expected.expectedPaymentTxId && order.paymentTransactionId !== expected.expectedPaymentTxId) {
    errors.push(`ID de transação divergente: esperado ${expected.expectedPaymentTxId}, obtido ${order.paymentTransactionId}`)
  }
  return {
    ok: errors.length === 0,
    errors,
  }
}

/**
 * Calcula o resumo consolidado, distinção de categorias de falha e define o exit code rigoroso.
 */
export function computeSummary(results = [], environmentInfo = {}) {
  const totalSteps = results.length
  const passedSteps = results.filter((r) => r.ok).length
  const functionalFailures = results.filter((r) => !r.ok && r.category !== 'cleanup')
  const cleanupFailures = results.filter((r) => !r.ok && r.category === 'cleanup')

  const hasFunctionalFailure = functionalFailures.length > 0
  const hasCleanupFailure = cleanupFailures.length > 0
  const allPassed = totalSteps > 0 && results.every((r) => r.ok)

  let verdict = 'APROVADO'
  let exitCode = 0

  if (environmentInfo.blocked) {
    verdict = 'BLOQUEADO_POR_SEGURANCA'
    exitCode = environmentInfo.exitCode || 2
  } else if (hasFunctionalFailure) {
    verdict = 'FALHA_FUNCIONAL'
    exitCode = 1
  } else if (hasCleanupFailure) {
    verdict = 'FALHA_DE_LIMPEZA'
    exitCode = 1
  } else if (!allPassed) {
    verdict = 'FALHA'
    exitCode = 1
  }

  return {
    totalSteps,
    passedSteps,
    allPassed,
    hasFunctionalFailure,
    hasCleanupFailure,
    functionalFailures,
    cleanupFailures,
    verdict,
    exitCode,
    isProductionPermanentOrderWarning: Boolean(environmentInfo.isProduction && allPassed),
  }
}

// 1. Carregamento de variáveis de ambiente de .env.qa.local se existir
const envLocalPath = path.resolve(process.cwd(), '.env.qa.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx !== -1) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

// 2. Resolução de API Key do Firebase
if (!process.env.FIREBASE_API_KEY && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  const frontEnvPath = path.resolve(process.cwd(), 'front/.env.production')
  if (fs.existsSync(frontEnvPath)) {
    const frontEnv = fs.readFileSync(frontEnvPath, 'utf8')
    for (const rawLine of frontEnv.split(/\r?\n/)) {
      const line = rawLine.trim()
      const match = line.match(/^NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.+)$/)
      if (match) {
        process.env.FIREBASE_API_KEY = match[1].trim()
        break
      }
    }
  }
}

const DEFAULT_API_URL = process.env.API_URL || 'https://fraldinha-livre-backend.romariobc.workers.dev'
const DEFAULT_FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const DEFAULT_BUYER_EMAIL = process.env.QA_BUYER_EMAIL || 'comprador.teste@fraldinhalivre.com.br'
const DEFAULT_BUYER_PASSWORD = process.env.QA_BUYER_PASSWORD
const DEFAULT_SUPPLIER_EMAIL = process.env.QA_SUPPLIER_EMAIL || 'fornecedor.teste1@fraldinhalivre.com.br'
const DEFAULT_SUPPLIER_PASSWORD = process.env.QA_SUPPLIER_PASSWORD
const DEFAULT_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || process.env.ADMIN_EMAIL
const DEFAULT_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
const DEFAULT_REQUIRE_ADMIN = process.env.QA_REQUIRE_ADMIN === 'true' || process.argv.includes('--require-admin')

const DEFAULT_ALLOW_WRITE = process.env.QA_ALLOW_PRODUCTION_WRITE === 'true' || process.argv.includes('--allow-production-write')

export async function authenticate(email, password, apiKey = DEFAULT_FIREBASE_API_KEY, fetchFn = globalThis.fetch) {
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY ausente')
  }
  const res = await fetchFn(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  if (!res.ok) {
    throw new Error(`Autenticação falhou para usuário de teste (HTTP ${res.status})`)
  }
  const data = await res.json()
  return { idToken: data.idToken, uid: data.localId, email: data.email }
}


export async function runE2E(options = {}) {
  const apiUrl = options.apiUrl || DEFAULT_API_URL
  const firebaseApiKey = options.firebaseApiKey || DEFAULT_FIREBASE_API_KEY
  const buyerEmail = options.buyerEmail || DEFAULT_BUYER_EMAIL
  const buyerPassword = options.buyerPassword !== undefined ? options.buyerPassword : DEFAULT_BUYER_PASSWORD
  const supplierEmail = options.supplierEmail || DEFAULT_SUPPLIER_EMAIL
  const supplierPassword = options.supplierPassword !== undefined ? options.supplierPassword : DEFAULT_SUPPLIER_PASSWORD
  const adminEmail = options.adminEmail || DEFAULT_ADMIN_EMAIL
  const adminPassword = options.adminPassword !== undefined ? options.adminPassword : DEFAULT_ADMIN_PASSWORD
  const requireAdmin = options.requireAdmin !== undefined ? options.requireAdmin : DEFAULT_REQUIRE_ADMIN
  const allowWrite = options.allowWrite !== undefined ? options.allowWrite : DEFAULT_ALLOW_WRITE

  const fetchFn = options.fetchFn || globalThis.fetch
  const authFn = options.authFn || ((email, pass) => authenticate(email, pass, firebaseApiKey, fetchFn))
  const log = options.logFn || console.log
  const warn = options.warnFn || console.warn
  const error = options.errorFn || console.error
  const table = options.tableFn || console.table

  log('===================================================================')
  log('  TESTE E2E DE API: Ciclo Completo de Pedidos (Fornecedor -> Comprador -> Admin)')
  log(`  Alvo: ${apiUrl}`)
  log('  Nota: Teste puramente HTTP REST. Não realiza renderização de interface gráfica.')
  log('===================================================================\n')

  const prereq = checkPrerequisites({
    apiUrl,
    buyerEmail,
    buyerPassword,
    supplierEmail,
    supplierPassword,
    adminEmail,
    adminPassword,
    requireAdmin,
    allowWrite,
  })

  if (prereq.blocked) {
    warn(prereq.message)
    if (prereq.isProduction) {
      warn('\nStatus de execução: NÃO EXECUTADO (Trava de produção ativa).')
      warn('Para executar conscientemente, use: node scripts/test-e2e-catalog-to-history.mjs --allow-production-write\n')
    }
    process.exitCode = prereq.exitCode
    return { verdict: prereq.verdict, exitCode: prereq.exitCode, allPassed: false, totalSteps: 0, passedSteps: 0 }
  }

  const results = []
  let createdProductId = null
  let createdOrderId = null
  let supplier = null
  let buyer = null
  let admin = null
  const simulatedTxId = `sim-e2e-${Date.now()}`

  try {
    // -------------------------------------------------------------
    // ETAPA 1: Autenticação de Fornecedor X e Comprador Y
    // -------------------------------------------------------------
    log('[1/12] Autenticando Fornecedor X e Comprador Y...')
    supplier = await authFn(supplierEmail, supplierPassword)
    buyer = await authFn(buyerEmail, buyerPassword)
    log(`  Fornecedor X autenticado (UID: ${supplier.uid})`)
    log(`  Comprador Y autenticado  (UID: ${buyer.uid})`)
    results.push({ step: '1. Autenticação das contas (Fornecedor e Comprador)', ok: !!supplier.idToken && !!buyer.idToken, category: 'functional' })

    // -------------------------------------------------------------
    // ETAPA 2: Fornecedor X adiciona produto ao catálogo
    // -------------------------------------------------------------
    const testTimestamp = Date.now()
    const testProductName = `Fralda E2E QA Teste ${testTimestamp}`
    log(`\n[2/12] Fornecedor X cadastra produto no catálogo via API (POST /products)...`)

    const productPayload = {
      name: testProductName,
      brand: 'Pampers Teste',
      size: 'M',
      quantity: 50,
      priceCents: 2490, // R$ 24,90
      slug: `fralda-e2e-qa-${testTimestamp}`,
      categoria: 'Fraldas Infantis',
      descricao: 'Produto temporário criado exclusivamente para teste automatizado E2E de ciclo de vida.',
      atributos: {
        faixaPeso: '6-9kg',
        genero: 'unissex',
        absorcao: 'alta',
        tecnologia: 'tubos-de-ar',
        erpId: `ERP-${testTimestamp}`,
      },
      badge: 'Teste QA',
    }

    const createProductRes = await fetchFn(`${apiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify(productPayload),
    })

    const productBody = await createProductRes.json()
    createdProductId = productBody.id
    const step2Ok = createProductRes.status === 201 && !!createdProductId
    log(`  Status HTTP: ${createProductRes.status}, Product ID gerado: ${createdProductId}`)
    results.push({ step: '2. Criação de produto pelo fornecedor (POST /products)', ok: step2Ok, productId: createdProductId, category: 'functional' })
    if (!step2Ok) throw new Error(`Falha ao cadastrar produto: ${JSON.stringify(productBody)}`)

    // -------------------------------------------------------------
    // ETAPA 3: Comprador Y localiza o produto no catálogo público
    // -------------------------------------------------------------
    log('\n[3/12] Comprador Y consulta catálogo público via API (GET /products)...')
    const catalogRes = await fetchFn(`${apiUrl}/products`)
    const catalog = await catalogRes.json()
    const foundProduct = Array.isArray(catalog) ? catalog.find((p) => p.id === createdProductId) : null

    const step3Ok = catalogRes.status === 200 &&
                    !!foundProduct &&
                    foundProduct.supplierId === supplier.uid &&
                    foundProduct.priceCents === 2490

    log(`  Produto encontrado no catálogo público:`, {
      id: foundProduct?.id,
      name: foundProduct?.name,
      supplierId: foundProduct?.supplierId,
      priceCents: foundProduct?.priceCents,
    })
    results.push({ step: '3. Localização do produto no catálogo público (GET /products)', ok: step3Ok, category: 'functional' })
    if (!step3Ok) throw new Error('Produto cadastrado não apareceu no catálogo público')

    // -------------------------------------------------------------
    // ETAPA 4: Comprador Y realiza compra direta com pagamento aprovado
    // -------------------------------------------------------------
    const idempotencyKey = `e2e-idempotency-${testTimestamp}`
    log('\n[4/12] Comprador Y cria pedido via API (POST /orders com Idempotency-Key)...')

    const orderPayload = {
      product: testProductName,
      quantity: 2,
      unit: 'un',
      supplierId: supplier.uid,
      supplierName: 'Distribuidora Sul Teste',
      deliveryAddress: {
        logradouro: 'Av. Paulista',
        numero: '1500',
        complemento: 'Andar 10',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-200',
      },
      price: 4980, // 2 x 2490 = R$ 49,80
      items: [
        {
          productId: createdProductId,
          productName: testProductName,
          unitPrice: 2490,
          quantity: 2,
          unit: 'un',
        },
      ],
      paymentMethod: 'pix',
      paymentTransactionId: simulatedTxId,
      paymentStatus: 'approved',
    }

    const createOrderRes = await fetchFn(`${apiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer.idToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(orderPayload),
    })

    const orderBody = await createOrderRes.json()
    createdOrderId = orderBody.id

    const step4Ok = createOrderRes.status === 201 &&
                    !!createdOrderId &&
                    orderBody.status === 'aguardando' &&
                    orderBody.paymentStatus === 'approved'

    log(`  Status HTTP: ${createOrderRes.status}, Order ID: ${createdOrderId}, Status inicial: ${orderBody.status}`)
    results.push({ step: '4. Comprador realiza compra direta (POST /orders)', ok: step4Ok, orderId: createdOrderId, category: 'functional' })
    if (!step4Ok) throw new Error(`Falha ao criar pedido: ${JSON.stringify(orderBody)}`)

    // -------------------------------------------------------------
    // ETAPA 5: Fornecedor X visualiza pedido na sua fila
    // -------------------------------------------------------------
    log('\n[5/12] Fornecedor X consulta fila de pedidos recebidos via API (GET /orders?scope=fornecedor)...')
    const supplierOrdersRes = await fetchFn(`${apiUrl}/orders?scope=fornecedor`, {
      headers: { Authorization: `Bearer ${supplier.idToken}` },
    })
    const supplierOrders = await supplierOrdersRes.json()
    const foundInSupplier = Array.isArray(supplierOrders) ? supplierOrders.find((o) => o.id === createdOrderId) : null

    const step5Ok = supplierOrdersRes.status === 200 &&
                    !!foundInSupplier &&
                    foundInSupplier.status === 'aguardando'

    log(`  Pedido localizado na fila do fornecedor:`, {
      id: foundInSupplier?.id,
      status: foundInSupplier?.status,
      product: foundInSupplier?.product,
    })
    results.push({ step: '5. Pedido isolado na fila do fornecedor (GET /orders?scope=fornecedor)', ok: step5Ok, category: 'functional' })
    if (!step5Ok) throw new Error('Pedido não encontrado na fila do fornecedor')

    // -------------------------------------------------------------
    // ETAPA 6: Fornecedor X confirma o pedido
    // -------------------------------------------------------------
    log('\n[6/12] Fornecedor X confirma o pedido via API (PATCH status -> confirmado)...')
    const confirmRes = await fetchFn(`${apiUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const confirmBody = await confirmRes.json()
    const step6Ok = confirmRes.status === 200 && confirmBody.status === 'confirmado'
    log(`  Status HTTP: ${confirmRes.status}, Novo status: ${confirmBody.status}`)
    results.push({ step: '6. Fornecedor confirma pedido (PATCH status -> confirmado)', ok: step6Ok, category: 'functional' })
    if (!step6Ok) throw new Error('Falha ao confirmar pedido')

    // -------------------------------------------------------------
    // ETAPA 7: Comprador Y consulta status confirmado via API
    // -------------------------------------------------------------
    log('\n[7/12] Comprador Y consulta API de pedidos (verificação da regra de pedidos ativos: confirmado)...')
    const buyerOrdersRes1 = await fetchFn(`${apiUrl}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders1 = await buyerOrdersRes1.json()
    const active1 = buyerOrders1.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const orderInActive1 = active1.find((o) => o.id === createdOrderId)

    const step7Ok = buyerOrdersRes1.status === 200 &&
                    !!orderInActive1 &&
                    orderInActive1.status === 'confirmado'

    results.push({ step: '7. Comprador verifica status "confirmado" na API (critério de ativos)', ok: step7Ok, category: 'functional' })
    if (!step7Ok) throw new Error('Pedido confirmado não apareceu nos pedidos ativos do comprador')

    // -------------------------------------------------------------
    // ETAPA 8: Fornecedor X despacha o pedido (A caminho)
    // -------------------------------------------------------------
    log('\n[8/12] Fornecedor X despacha o pedido via API (PATCH status -> a-caminho)...')
    const dispatchRes = await fetchFn(`${apiUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'a-caminho' }),
    })
    const dispatchBody = await dispatchRes.json()
    const step8Ok = dispatchRes.status === 200 && dispatchBody.status === 'a-caminho'
    log(`  Status HTTP: ${dispatchRes.status}, Novo status: ${dispatchBody.status}`)
    results.push({ step: '8. Fornecedor despacha pedido (PATCH status -> a-caminho)', ok: step8Ok, category: 'functional' })
    if (!step8Ok) throw new Error('Falha ao despachar pedido')

    // -------------------------------------------------------------
    // ETAPA 9: Comprador Y consulta status a-caminho via API
    // -------------------------------------------------------------
    log('\n[9/12] Comprador Y consulta API de pedidos (verificação da regra de pedidos ativos: a-caminho)...')
    const buyerOrdersRes2 = await fetchFn(`${apiUrl}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders2 = await buyerOrdersRes2.json()
    const active2 = buyerOrders2.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const orderInActive2 = active2.find((o) => o.id === createdOrderId)

    const step9Ok = buyerOrdersRes2.status === 200 &&
                    !!orderInActive2 &&
                    orderInActive2.status === 'a-caminho'

    results.push({ step: '9. Comprador verifica status "a-caminho" na API (critério de ativos)', ok: step9Ok, category: 'functional' })
    if (!step9Ok) throw new Error('Pedido a-caminho não apareceu nos pedidos ativos do comprador')

    // -------------------------------------------------------------
    // ETAPA 10: Fornecedor X marca o pedido como Entregue
    // -------------------------------------------------------------
    log('\n[10/12] Fornecedor X conclui entrega via API (PATCH status -> entregue)...')
    const deliverRes = await fetchFn(`${apiUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'entregue' }),
    })
    const deliverBody = await deliverRes.json()
    const step10Ok = deliverRes.status === 200 && deliverBody.status === 'entregue'
    log(`  Status HTTP: ${deliverRes.status}, Novo status: ${deliverBody.status}`)
    results.push({ step: '10. Fornecedor marca entrega (PATCH status -> entregue)', ok: step10Ok, category: 'functional' })
    if (!step10Ok) throw new Error('Falha ao marcar como entregue')

    // -------------------------------------------------------------
    // ETAPA 11: Comprador Y valida migração na API (critério de histórico)
    // -------------------------------------------------------------
    log('\n[11/12] Comprador Y valida migração lógica de status na API (sai de ativos, entra em histórico)...')
    const buyerOrdersRes3 = await fetchFn(`${apiUrl}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders3 = await buyerOrdersRes3.json()

    const active3 = buyerOrders3.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const inActiveTab = !!active3.find((o) => o.id === createdOrderId)

    const done3 = buyerOrders3.filter((o) => o.status === 'entregue' || o.status === 'cancelado')
    const orderInDone = done3.find((o) => o.id === createdOrderId)
    const inDoneTab = !!orderInDone && orderInDone.status === 'entregue'

    const step11Ok = buyerOrdersRes3.status === 200 && !inActiveTab && inDoneTab
    results.push({
      step: '11. Regra de negócio na API: pedido concluído sai de ativos e integra histórico',
      ok: step11Ok,
      category: 'functional',
    })
    if (!step11Ok) throw new Error('Falha na classificação de histórico do pedido')

    // -------------------------------------------------------------
    // ETAPA 12: Integração Administrativa (GET /orders?scope=admin)
    // -------------------------------------------------------------
    if (adminPassword) {
      log('\n[12/12] Autenticando Administrador e validando observabilidade global (GET /orders?scope=admin)...')
      admin = await authFn(adminEmail, adminPassword)
      const adminOrdersRes = await fetchFn(`${apiUrl}/orders?scope=admin`, {
        headers: { Authorization: `Bearer ${admin.idToken}` },
      })
      const adminOrders = await adminOrdersRes.json()
      const adminFoundOrder = Array.isArray(adminOrders) ? adminOrders.find((o) => o.id === createdOrderId) : null

      const adminValidation = validateAdminOrder(adminFoundOrder, {
        expectedOrderId: createdOrderId,
        expectedBuyerUid: buyer.uid,
        expectedSupplierUid: supplier.uid,
        expectedSupplierName: 'Distribuidora Sul Teste',
        expectedStatus: 'entregue',
        expectedProductId: createdProductId,
        expectedPaymentMethod: 'pix',
        expectedPaymentStatus: 'approved',
        expectedPaymentTxId: simulatedTxId,
      })

      const step12Ok = adminOrdersRes.status === 200 && adminValidation.ok
      log(`  Auditoria administrativa do pedido: HTTP ${adminOrdersRes.status}, Válido: ${adminValidation.ok ? 'SIM' : 'NÃO'}`)
      if (!adminValidation.ok) {
        error('  Erros na validação administrativa:', adminValidation.errors)
      }
      results.push({
        step: '12. Integração API Admin: localização e conformidade do pedido (GET /orders?scope=admin)',
        ok: step12Ok,
        category: 'admin',
        errors: adminValidation.errors,
      })
      if (!step12Ok) throw new Error('Pedido não validado na visão administrativa')
    } else {
      log('\n[12/12] Etapa administrativa ignorada (credencial QA_ADMIN_PASSWORD não fornecida).')
      results.push({
        step: '12. Integração API Admin (ignorado: credencial administrativa não configurada)',
        ok: true,
        skipped: true,
        category: 'admin',
      })
    }
  } catch (flowErr) {
    error(`\n❌ Interrupção do fluxo de execução: ${flowErr.message}`)
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN: Limpeza do produto de teste no D1
    // -------------------------------------------------------------
    if (createdProductId && supplier?.idToken) {
      log('\n[TEARDOWN] Removendo produto temporário de teste (DELETE /products/:id)...')
      try {
        const deleteRes = await fetchFn(`${apiUrl}/products/${createdProductId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${supplier.idToken}` },
        })
        const catalogCheckRes = await fetchFn(`${apiUrl}/products`)
        const catalogCheck = await catalogCheckRes.json()
        const stillInCatalog = Array.isArray(catalogCheck) && !!catalogCheck.find((p) => p.id === createdProductId)
        const cleanupOk = deleteRes.status === 204 && !stillInCatalog
        log(`  Remoção do produto: HTTP ${deleteRes.status}, Excluído do catálogo: ${!stillInCatalog ? 'SIM (limpo)' : 'NÃO'}`)
        results.push({
          step: '13. Teardown: exclusão do produto temporário',
          ok: cleanupOk,
          category: 'cleanup',
          error: cleanupOk ? undefined : `Status HTTP inesperado: ${deleteRes.status}`,
        })
      } catch (cleanErr) {
        error('  ❌ Falha crítica no teardown:', cleanErr.message)
        results.push({
          step: '13. Teardown: exclusão do produto temporário',
          ok: false,
          category: 'cleanup',
          error: cleanErr.message,
        })
      }
    }

    if (createdOrderId) {
      log(`\n  ⚠️  NOTA DE RASTREABILIDADE: O pedido de teste #${createdOrderId} permanece registrado no banco D1.`)
      log('     Para ambientes de produção, pedidos de compra direta não são excluíveis pela API por integridade contábil.')
      log('     Para isolamento estrito sem poluição de dados, execute este teste contra ambiente de preview ou D1 local.\n')
    }
  }

  log('===================================================================')
  log('  RESUMO DO TESTE END-TO-END DE API')
  log('===================================================================')
  table(results)

  const summary = computeSummary(results, { isProduction: prereq.isProduction, blocked: false })
  log(`\nVeredito Consolidado: [${summary.verdict}] - ${summary.passedSteps}/${summary.totalSteps} etapas aprovadas.`)

  if (!summary.allPassed) {
    error('❌ Falha na execução da suíte E2E. Processo encerrado com exit code 1.')
    process.exitCode = 1
  } else {
    log('🎉 Suíte E2E da API aprovada com sucesso!')
    process.exitCode = 0
  }

  return summary
}

// Auto-execução quando executado diretamente na linha de comando
const isMain = process.argv[1] && (
  process.argv[1].endsWith('test-e2e-catalog-to-history.mjs') ||
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
)

if (isMain) {
  runE2E().catch((err) => {
    console.error('\n💥 ERRO FATAL NA EXECUÇÃO DO TESTE E2E:', err)
    process.exit(1)
  })
}
