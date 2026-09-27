// scripts/qa-mvp06-e2e.mjs
// Script de validação de integração da API do ciclo de compra direta e ciclo de status
// ATENÇÃO: Este script testa endpoints HTTP da API. Ele NÃO executa automação de navegador (UI/viewports).

import fs from 'node:fs'
import path from 'node:path'

// Carregamento de variáveis de ambiente de .env.qa.local (se existir)
const envLocalPath = path.resolve(process.cwd(), '.env.qa.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

// Resolução dinâmica de variáveis de ambiente do Frontend (se necessário)
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

const API_URL = process.env.API_URL || 'https://fraldinha-livre-backend.romariobc.workers.dev'
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

if (!FIREBASE_API_KEY) {
  console.error('\n❌ ERRO: FIREBASE_API_KEY não encontrada em variáveis de ambiente nem em front/.env.production!')
  process.exit(1)
}

const BUYER_EMAIL = process.env.QA_BUYER_EMAIL || 'comprador.teste@fraldinhalivre.com.br'
const BUYER_PASSWORD = process.env.QA_BUYER_PASSWORD
const SUPPLIER_EMAIL = process.env.QA_SUPPLIER_EMAIL || 'fornecedor.teste1@fraldinhalivre.com.br'
const SUPPLIER_PASSWORD = process.env.QA_SUPPLIER_PASSWORD

if (!BUYER_PASSWORD || !SUPPLIER_PASSWORD) {
  console.error('\n❌ ERRO: Credenciais de teste ausentes!')
  console.error('Defina QA_BUYER_PASSWORD e QA_SUPPLIER_PASSWORD via variáveis de ambiente ou no arquivo .env.qa.local.')
  console.error('Consulte scripts/env.qa.example para referência.\n')
  process.exit(1)
}

const isProduction = API_URL.includes('workers.dev') || API_URL.includes('fraldinhalivre.com.br')
const allowProductionWrite = process.env.QA_ALLOW_PRODUCTION_WRITE === 'true' || process.argv.includes('--allow-production-write')

async function authenticate(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  if (!res.ok) {
    throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return { idToken: data.idToken, uid: data.localId, email: data.email }
}

async function runQa() {
  console.log('===================================================================')
  console.log('  Validação de Integração da API — Compra Direta e Fornecedor')
  console.log(`  Alvo: ${API_URL}`)
  console.log('===================================================================\n')

  if (isProduction && !allowProductionWrite) {
    console.warn('⚠️  AVISO DE SEGURANÇA: O alvo é o ambiente de PRODUÇÃO.')
    console.warn('Para evitar criação de pedidos e consumo de estoque acidental no D1 de produção,')
    console.warn('o teste de escrita está bloqueado por padrão.')
    console.warn('Para executar conscientemente (ciente de que criará pedidos reais no D1), passe:')
    console.warn('  --allow-production-write ou defina QA_ALLOW_PRODUCTION_WRITE=true.\n')
  }

  const results = []

  // 1. Health check
  console.log('[1/7] Checando /health...')
  const healthRes = await fetch(`${API_URL}/health`)
  const healthXId = healthRes.headers.get('x-request-id')
  const healthBody = await healthRes.json()
  const healthOk = healthRes.status === 200 && healthBody.ok === true
  console.log(`  Status: ${healthRes.status}, X-Request-Id: ${healthXId}, Body:`, healthBody)
  results.push({ step: 'Health check', ok: healthOk, xId: healthXId })

  // 2. Auth do comprador
  console.log(`\n[2/7] Autenticando comprador (${BUYER_EMAIL})...`)
  const buyer = await authenticate(BUYER_EMAIL, BUYER_PASSWORD)
  console.log(`  Comprador autenticado: UID ${buyer.uid}`)
  results.push({ step: 'Auth comprador', ok: !!buyer.idToken, uid: buyer.uid })

  // 3. Auth do fornecedor
  console.log(`\n[3/7] Autenticando fornecedor (${SUPPLIER_EMAIL})...`)
  const supplier = await authenticate(SUPPLIER_EMAIL, SUPPLIER_PASSWORD)
  console.log(`  Fornecedor autenticado: UID ${supplier.uid}`)
  results.push({ step: 'Auth fornecedor', ok: !!supplier.idToken, uid: supplier.uid })

  // 4. Cenário Negativo Real de API: Requisição sem Idempotency-Key com conferência antes/depois no D1
  console.log('\n[4/7] Testando cenário negativo de validação da API (POST /orders sem Idempotency-Key)...')
  const beforeOrdersRes = await fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` },
  })
  const beforeOrders = await beforeOrdersRes.json()
  const beforeCount = Array.isArray(beforeOrders) ? beforeOrders.length : 0

  const negativeRes = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyer.idToken}`,
    },
    body: JSON.stringify({ product: 'Teste Invalido', quantity: 1, unit: 'un', price: 100 }),
  })
  const negativeXId = negativeRes.headers.get('x-request-id')
  const negativeBody = await negativeRes.json()

  const afterOrdersRes = await fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` },
  })
  const afterOrders = await afterOrdersRes.json()
  const afterCount = Array.isArray(afterOrders) ? afterOrders.length : 0

  const countUnchanged = afterCount === beforeCount
  const negativeOk = negativeRes.status === 400 &&
                     negativeBody?.error?.code === 'IDEMPOTENCY_KEY_REQUIRED' &&
                     countUnchanged

  console.log(`  Status: ${negativeRes.status} (esperado 400), Code: ${negativeBody?.error?.code}, X-Request-Id: ${negativeXId}`)
  console.log(`  Contagem de pedidos no D1 antes: ${beforeCount}, depois: ${afterCount} (invariante: ${countUnchanged ? 'INALTERADA - nenhum pedido criado' : 'FALHA'})`)
  results.push({
    step: 'Cenário negativo API (rejeição 400 + invariante de contagem D1 antes/depois)',
    ok: negativeOk,
    xId: negativeXId,
    beforeCount,
    afterCount,
  })

  if (isProduction && !allowProductionWrite) {
    console.log('\n[!] Execução de escrita suspensa conforme proteção de produção. Testes de leitura e negativas concluídos.')
    console.table(results)
    return { allOk: results.every((r) => r.ok), results }
  }

  // 5. Criação do pedido com Pagamento Simulado Aprovado
  console.log('\n[5/7] Criando pedido direto com pagamento simulado aprovado (POST /orders)...')
  const simTxId = `sim-qa-${Date.now()}`
  const targetProductId = '940ae36c-b1be-4e6a-9442-1dcd3b585e25' // Produto de fornecedor.teste1
  const orderPayload = {
    product: 'Supersec Pants P',
    quantity: 1,
    unit: 'un',
    price: 1806,
    supplierId: supplier.uid,
    supplierName: 'Distribuidora Sul Teste',
    items: [
      {
        productId: targetProductId,
        productName: 'Supersec Pants P',
        unitPrice: 1806,
        quantity: 1,
        unit: 'un',
      },
    ],
    deliveryAddress: {
      logradouro: 'Av. Brigadeiro Faria Lima',
      numero: '2232',
      complemento: 'Conjunto 51',
      bairro: 'Jardim Paulistano',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01451-000',
    },
    paymentMethod: 'pix',
    paymentTransactionId: simTxId,
    paymentStatus: 'approved',
  }

  const createRes = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyer.idToken}`,
      'Idempotency-Key': `idemp-qa-${Date.now()}`,
    },
    body: JSON.stringify(orderPayload),
  })
  const createXId = createRes.headers.get('x-request-id')
  const createBody = await createRes.json()
  const createOk = createRes.status === 201 && !!createBody.id
  console.log(`  Status: ${createRes.status}, X-Request-Id: ${createXId}, Pedido retornado:`, createBody)

  if (!createOk) {
    throw new Error(`Falha ao criar pedido: ${createRes.status} ${JSON.stringify(createBody)}`)
  }
  const createdOrderId = createBody.id
  results.push({
    step: 'Criação pedido com pagamento simulado (POST /orders)',
    ok: createOk,
    orderId: createdOrderId,
    txId: simTxId,
    xId: createXId,
  })

  // 6. Confirmação da gravação no D1 via GET do comprador
  console.log('\n[6/7] Conferindo pedido gravado no D1 pelo comprador (GET /orders)...')
  const buyerOrdersRes = await fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` },
  })
  const buyerOrders = await buyerOrdersRes.json()
  const foundInBuyer = Array.isArray(buyerOrders) ? buyerOrders.find((o) => o.id === createdOrderId) : null
  const buyerGetOk = buyerOrdersRes.status === 200 && !!foundInBuyer && foundInBuyer.paymentStatus === 'approved' && foundInBuyer.status === 'aguardando'
  console.log('  Pedido localizado em Minha Conta:', {
    id: foundInBuyer?.id,
    status: foundInBuyer?.status,
    paymentMethod: foundInBuyer?.paymentMethod,
    paymentTransactionId: foundInBuyer?.paymentTransactionId,
    paymentStatus: foundInBuyer?.paymentStatus,
  })
  results.push({
    step: 'Consulta do comprador em Minha Conta (GET /orders)',
    ok: buyerGetOk,
    status: foundInBuyer?.status,
  })

  // 7. Ciclo de status no painel do fornecedor e consulta final do comprador
  console.log('\n[7/7] Ciclo de vida do pedido pelo fornecedor e acompanhamento pelo comprador...')
  const suppOrdersRes = await fetch(`${API_URL}/orders?scope=fornecedor`, {
    headers: { Authorization: `Bearer ${supplier.idToken}` },
  })
  const suppOrders = await suppOrdersRes.json()
  const foundInSupplier = Array.isArray(suppOrders) ? suppOrders.find((o) => o.id === createdOrderId) : null
  const supplierQueueOk = suppOrdersRes.status === 200 && !!foundInSupplier
  console.log('  Fornecedor localizou o pedido na fila:', {
    id: foundInSupplier?.id,
    status: foundInSupplier?.status,
  })
  results.push({
    step: 'Fornecedor consulta fila (GET /orders?scope=fornecedor)',
    ok: supplierQueueOk,
  })

  // 7a. Fornecedor confirma pedido (aguardando -> confirmado)
  console.log('  -> Fornecedor confirma o pedido (PATCH /orders/:id/status { status: "confirmado" })...')
  const confirmRes = await fetch(`${API_URL}/orders/${createdOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supplier.idToken}`,
    },
    body: JSON.stringify({ status: 'confirmado' }),
  })
  const confirmXId = confirmRes.headers.get('x-request-id')
  const confirmBody = await confirmRes.json()
  const confirmOk = confirmRes.status === 200 && confirmBody?.status === 'confirmado'
  console.log(`     Status HTTP: ${confirmRes.status}, X-Request-Id: ${confirmXId}, Resposta:`, confirmBody)
  results.push({
    step: 'Fornecedor confirma pedido (PATCH confirmado)',
    ok: confirmOk,
    xId: confirmXId,
  })

  // 7b. Fornecedor despacha pedido (confirmado -> a-caminho)
  console.log('  -> Fornecedor despacha o pedido (PATCH /orders/:id/status { status: "a-caminho" })...')
  const dispatchRes = await fetch(`${API_URL}/orders/${createdOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supplier.idToken}`,
    },
    body: JSON.stringify({ status: 'a-caminho' }),
  })
  const dispatchXId = dispatchRes.headers.get('x-request-id')
  const dispatchBody = await dispatchRes.json()
  const dispatchOk = dispatchRes.status === 200 && dispatchBody?.status === 'a-caminho'
  console.log(`     Status HTTP: ${dispatchRes.status}, X-Request-Id: ${dispatchXId}, Resposta:`, dispatchBody)
  results.push({
    step: 'Fornecedor despacha pedido (PATCH a-caminho)',
    ok: dispatchOk,
    xId: dispatchXId,
  })

  // 7c. Retorno ao comprador para validação da sincronização de status
  console.log('  -> Comprador consulta status atualizado (GET /orders)...')
  const finalBuyerRes = await fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` },
  })
  const finalBuyerOrders = await finalBuyerRes.json()
  const finalOrder = Array.isArray(finalBuyerOrders) ? finalBuyerOrders.find((o) => o.id === createdOrderId) : null
  const buyerSyncOk = finalBuyerRes.status === 200 && finalOrder?.status === 'a-caminho'
  console.log('     Comprador visualiza status final após refresh:', {
    id: finalOrder?.id,
    status: finalOrder?.status,
    expected: 'a-caminho',
    match: buyerSyncOk,
  })
  results.push({
    step: 'Comprador consulta atualização de status (GET /orders -> a-caminho)',
    ok: buyerSyncOk,
    finalStatus: finalOrder?.status,
  })

  console.log('\n===================================================================')
  console.log('  RESUMO DA EXECUÇÃO')
  console.log('===================================================================')
  console.table(results)
  const allOk = results.every((r) => r.ok)
  console.log(`\nResultado Geral: ${allOk ? '✅ SUCESSO' : '❌ FALHA'}`)
  return { allOk, results, createdOrderId }
}

runQa().catch((err) => {
  console.error('ERRO FATAL NA EXECUÇÃO:', err)
  process.exit(1)
})
