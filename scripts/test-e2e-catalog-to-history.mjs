// scripts/test-e2e-catalog-to-history.mjs
// Teste End-to-End: Do Cadastro do Produto pelo Fornecedor ao Histórico do Comprador
//
// Fluxo testado:
// 1. Fornecedor X autentica e adiciona um produto ao catálogo (POST /products)
// 2. Comprador Y autentica e localiza o produto no catálogo público (GET /products)
// 3. Comprador Y realiza a compra com pagamento simulado aprovado (POST /orders)
// 4. Fornecedor X localiza o pedido em sua fila (GET /orders?scope=fornecedor)
// 5. Fornecedor X confirma o pedido (PATCH status -> confirmado)
// 6. Comprador Y valida pedido na aba Pedidos Ativos com status confirmado
// 7. Fornecedor X despacha o pedido (PATCH status -> a-caminho)
// 8. Comprador Y valida pedido na aba Pedidos Ativos com status a-caminho
// 9. Fornecedor X conclui a entrega (PATCH status -> entregue)
// 10. Comprador Y valida migração: pedido SAI de Pedidos Ativos e ENTRA no Histórico
// 11. Limpeza (Teardown): Fornecedor X remove o produto de teste do catálogo (DELETE /products/:id)

import fs from 'node:fs'
import path from 'node:path'

// 1. Carregamento de variáveis de ambiente de .env.qa.local
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

// 2. Resolução dinâmica de API Key do Firebase
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
  console.error('\n❌ ERRO: FIREBASE_API_KEY não encontrada!')
  process.exit(1)
}

const BUYER_EMAIL = process.env.QA_BUYER_EMAIL || 'comprador.teste@fraldinhalivre.com.br'
const BUYER_PASSWORD = process.env.QA_BUYER_PASSWORD
const SUPPLIER_EMAIL = process.env.QA_SUPPLIER_EMAIL || 'fornecedor.teste1@fraldinhalivre.com.br'
const SUPPLIER_PASSWORD = process.env.QA_SUPPLIER_PASSWORD

if (!BUYER_PASSWORD || !SUPPLIER_PASSWORD) {
  console.error('\n❌ ERRO: Credenciais de teste ausentes no .env.qa.local ou variáveis de ambiente!')
  process.exit(1)
}

const isProduction = API_URL.includes('workers.dev') || API_URL.includes('fraldinhalivre.com.br')
const allowWrite = process.env.QA_ALLOW_PRODUCTION_WRITE === 'true' || process.argv.includes('--allow-production-write')

async function authenticate(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  if (!res.ok) {
    throw new Error(`Autenticação falhou para ${email}: HTTP ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return { idToken: data.idToken, uid: data.localId, email: data.email }
}

async function runE2E() {
  console.log('===================================================================')
  console.log('  TESTE E2E: Ciclo Completo de Produto, Pedido e Histórico')
  console.log(`  Alvo: ${API_URL}`)
  console.log('===================================================================\n')

  if (isProduction && !allowWrite) {
    console.warn('⚠️  AVISO DE SEGURANÇA: O ambiente alvo é PRODUÇÃO.')
    console.warn('Este teste criará um produto temporário, um pedido real e alterará status no D1.')
    console.warn('Para executar conscientemente, execute com a flag:')
    console.warn('  node scripts/test-e2e-catalog-to-history.mjs --allow-production-write\n')
    process.exit(0)
  }

  const results = []
  let createdProductId = null
  let createdOrderId = null
  let supplier = null
  let buyer = null

  try {
    // -------------------------------------------------------------
    // ETAPA 1: Autenticação de Fornecedor X e Comprador Y
    // -------------------------------------------------------------
    console.log('[1/11] Autenticando Fornecedor X e Comprador Y...')
    supplier = await authenticate(SUPPLIER_EMAIL, SUPPLIER_PASSWORD)
    buyer = await authenticate(BUYER_EMAIL, BUYER_PASSWORD)
    console.log(`  Fornecedor X autenticado: ${supplier.email} (UID: ${supplier.uid})`)
    console.log(`  Comprador Y autenticado:  ${buyer.email} (UID: ${buyer.uid})`)
    results.push({ step: '1. Autenticação das contas', ok: !!supplier.idToken && !!buyer.idToken })

    // -------------------------------------------------------------
    // ETAPA 2: Fornecedor X adiciona produto ao catálogo
    // -------------------------------------------------------------
    const testTimestamp = Date.now()
    const testProductName = `Fralda E2E QA Teste ${testTimestamp}`
    console.log(`\n[2/11] Fornecedor X cadastra produto no catálogo: "${testProductName}"...`)

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

    const createProductRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify(productPayload),
    })

    const productXId = createProductRes.headers.get('x-request-id')
    const productBody = await createProductRes.json()
    createdProductId = productBody.id

    const step2Ok = createProductRes.status === 201 &&
                    !!createdProductId &&
                    productBody.supplierId === supplier.uid &&
                    productBody.active === true

    console.log(`  Status HTTP: ${createProductRes.status}, Product ID: ${createdProductId}, X-Request-Id: ${productXId}`)
    results.push({ step: '2. Fornecedor adiciona produto (POST /products)', ok: step2Ok, productId: createdProductId, xId: productXId })
    if (!step2Ok) throw new Error(`Falha ao cadastrar produto: ${JSON.stringify(productBody)}`)

    // -------------------------------------------------------------
    // ETAPA 3: Comprador Y localiza o produto no catálogo público
    // -------------------------------------------------------------
    console.log('\n[3/11] Comprador Y consulta catálogo público (GET /products)...')
    const publicCatalogRes = await fetch(`${API_URL}/products`)
    const publicCatalog = await publicCatalogRes.json()
    const foundProduct = Array.isArray(publicCatalog) ? publicCatalog.find((p) => p.id === createdProductId) : null

    const step3Ok = publicCatalogRes.status === 200 &&
                    !!foundProduct &&
                    foundProduct.active === true &&
                    foundProduct.priceCents === 2490 &&
                    foundProduct.supplierId === supplier.uid

    console.log(`  Produto localizado no catálogo público:`, {
      id: foundProduct?.id,
      name: foundProduct?.name,
      priceCents: foundProduct?.priceCents,
      supplierId: foundProduct?.supplierId,
    })
    results.push({ step: '3. Comprador acha produto no catálogo público (GET /products)', ok: step3Ok })
    if (!step3Ok) throw new Error('Produto cadastrado não apareceu no catálogo público')

    // -------------------------------------------------------------
    // ETAPA 4: Comprador Y cria pedido com pagamento simulado
    // -------------------------------------------------------------
    console.log('\n[4/11] Comprador Y finaliza compra com pagamento simulado aprovado (POST /orders)...')
    const simTxId = `sim-e2e-${testTimestamp}`
    const idempotencyKey = `idemp-e2e-${testTimestamp}`

    const orderPayload = {
      product: foundProduct.name,
      quantity: 1,
      unit: 'un',
      price: 2490,
      supplierId: supplier.uid,
      supplierName: 'Distribuidora Sul Teste',
      deliveryAddress: {
        logradouro: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
      },
      items: [
        {
          productId: foundProduct.id,
          productName: foundProduct.name,
          unitPrice: 2490,
          quantity: 1,
          unit: 'un',
        },
      ],
      paymentMethod: 'pix',
      paymentTransactionId: simTxId,
      paymentStatus: 'approved',
    }

    const createOrderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer.idToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(orderPayload),
    })

    const orderXId = createOrderRes.headers.get('x-request-id')
    const orderBody = await createOrderRes.json()
    createdOrderId = orderBody.id

    const step4Ok = createOrderRes.status === 201 &&
                    !!createdOrderId &&
                    orderBody.status === 'aguardando' &&
                    orderBody.paymentStatus === 'approved'

    console.log(`  Status HTTP: ${createOrderRes.status}, Order ID: ${createdOrderId}, Status inicial: ${orderBody.status}, X-Request-Id: ${orderXId}`)
    results.push({ step: '4. Comprador realiza compra (POST /orders)', ok: step4Ok, orderId: createdOrderId, xId: orderXId })
    if (!step4Ok) throw new Error(`Falha ao criar pedido: ${JSON.stringify(orderBody)}`)

    // -------------------------------------------------------------
    // ETAPA 5: Fornecedor X visualiza pedido na sua fila
    // -------------------------------------------------------------
    console.log('\n[5/11] Fornecedor X consulta fila de pedidos recebidos (GET /orders?scope=fornecedor)...')
    const supplierOrdersRes = await fetch(`${API_URL}/orders?scope=fornecedor`, {
      headers: { Authorization: `Bearer ${supplier.idToken}` },
    })
    const supplierOrders = await supplierOrdersRes.json()
    const foundInSupplier = Array.isArray(supplierOrders) ? supplierOrders.find((o) => o.id === createdOrderId) : null

    const step5Ok = supplierOrdersRes.status === 200 &&
                    !!foundInSupplier &&
                    foundInSupplier.status === 'aguardando'

    console.log(`  Pedido localizado na fila do fornecedor:`, {
      id: foundInSupplier?.id,
      status: foundInSupplier?.status,
      product: foundInSupplier?.product,
    })
    results.push({ step: '5. Pedido aparece na fila do fornecedor (GET /orders?scope=fornecedor)', ok: step5Ok })
    if (!step5Ok) throw new Error('Pedido não encontrado na fila do fornecedor')

    // -------------------------------------------------------------
    // ETAPA 6: Fornecedor X confirma o pedido
    // -------------------------------------------------------------
    console.log('\n[6/11] Fornecedor X confirma o pedido (PATCH status -> confirmado)...')
    const confirmRes = await fetch(`${API_URL}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'confirmado' }),
    })
    const confirmBody = await confirmRes.json()
    const step6Ok = confirmRes.status === 200 && confirmBody.status === 'confirmado'
    console.log(`  Status HTTP: ${confirmRes.status}, Novo status: ${confirmBody.status}`)
    results.push({ step: '6. Fornecedor confirma pedido (PATCH confirmado)', ok: step6Ok })
    if (!step6Ok) throw new Error('Falha ao confirmar pedido')

    // -------------------------------------------------------------
    // ETAPA 7: Comprador Y acompanha status na aba Pedidos (confirmado)
    // -------------------------------------------------------------
    console.log('\n[7/11] Comprador Y consulta status atualizado (aba Pedidos: confirmado)...')
    const buyerOrdersRes1 = await fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders1 = await buyerOrdersRes1.json()
    // Regra exata de PedidosTab.tsx: active = orders.filter(o => o.status !== 'entregue' && o.status !== 'cancelado')
    const active1 = buyerOrders1.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const orderInActive1 = active1.find((o) => o.id === createdOrderId)

    const step7Ok = buyerOrdersRes1.status === 200 &&
                    !!orderInActive1 &&
                    orderInActive1.status === 'confirmado'

    console.log(`  Pedido em PedidosTab (ativo):`, {
      id: orderInActive1?.id,
      status: orderInActive1?.status,
    })
    results.push({ step: '7. Comprador acompanha status "confirmado" em PedidosTab', ok: step7Ok })
    if (!step7Ok) throw new Error('Pedido confirmado não apareceu na aba Pedidos do comprador')

    // -------------------------------------------------------------
    // ETAPA 8: Fornecedor X despacha o pedido (A caminho)
    // -------------------------------------------------------------
    console.log('\n[8/11] Fornecedor X despacha o pedido (PATCH status -> a-caminho)...')
    const dispatchRes = await fetch(`${API_URL}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'a-caminho' }),
    })
    const dispatchBody = await dispatchRes.json()
    const step8Ok = dispatchRes.status === 200 && dispatchBody.status === 'a-caminho'
    console.log(`  Status HTTP: ${dispatchRes.status}, Novo status: ${dispatchBody.status}`)
    results.push({ step: '8. Fornecedor despacha pedido (PATCH a-caminho)', ok: step8Ok })
    if (!step8Ok) throw new Error('Falha ao despachar pedido')

    // -------------------------------------------------------------
    // ETAPA 9: Comprador Y acompanha status na aba Pedidos (a-caminho)
    // -------------------------------------------------------------
    console.log('\n[9/11] Comprador Y consulta status atualizado (aba Pedidos: a-caminho)...')
    const buyerOrdersRes2 = await fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders2 = await buyerOrdersRes2.json()
    const active2 = buyerOrders2.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const orderInActive2 = active2.find((o) => o.id === createdOrderId)

    const step9Ok = buyerOrdersRes2.status === 200 &&
                    !!orderInActive2 &&
                    orderInActive2.status === 'a-caminho'

    console.log(`  Pedido em PedidosTab (ativo):`, {
      id: orderInActive2?.id,
      status: orderInActive2?.status,
    })
    results.push({ step: '9. Comprador acompanha status "a-caminho" em PedidosTab', ok: step9Ok })
    if (!step9Ok) throw new Error('Pedido a-caminho não apareceu na aba Pedidos do comprador')

    // -------------------------------------------------------------
    // ETAPA 10: Fornecedor X marca o pedido como Entregue
    // -------------------------------------------------------------
    console.log('\n[10/11] Fornecedor X marca pedido como entregue (PATCH status -> entregue)...')
    const deliverRes = await fetch(`${API_URL}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplier.idToken}`,
      },
      body: JSON.stringify({ status: 'entregue' }),
    })
    const deliverBody = await deliverRes.json()
    const step10Ok = deliverRes.status === 200 && deliverBody.status === 'entregue'
    console.log(`  Status HTTP: ${deliverRes.status}, Novo status: ${deliverBody.status}`)
    results.push({ step: '10. Fornecedor marca como entregue (PATCH entregue)', ok: step10Ok })
    if (!step10Ok) throw new Error('Falha ao marcar como entregue')

    // -------------------------------------------------------------
    // ETAPA 11: Comprador Y valida migração: sai de Pedidos e entra em Histórico
    // -------------------------------------------------------------
    console.log('\n[11/11] Comprador Y valida migração para aba Histórico...')
    const buyerOrdersRes3 = await fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.idToken}` },
    })
    const buyerOrders3 = await buyerOrdersRes3.json()

    // 11a. Regra PedidosTab: o pedido NÃO DEVE ESTAR em active
    const active3 = buyerOrders3.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
    const inActiveTab = !!active3.find((o) => o.id === createdOrderId)

    // 11b. Regra HistoricoTab: o pedido DEVE ESTAR em done com status entregue
    const done3 = buyerOrders3.filter((o) => o.status === 'entregue' || o.status === 'cancelado')
    const orderInDone = done3.find((o) => o.id === createdOrderId)
    const inDoneTab = !!orderInDone && orderInDone.status === 'entregue'

    const step11Ok = buyerOrdersRes3.status === 200 && !inActiveTab && inDoneTab

    console.log(`  Validação de Abas de Minha Conta:`)
    console.log(`    - Presente na aba Pedidos (ativos): ${inActiveTab ? 'SIM (FALHA)' : 'NÃO (CORRETO - removido de ativos)'}`)
    console.log(`    - Presente na aba Histórico:       ${inDoneTab ? 'SIM (CORRETO - classificado como entregue)' : 'NÃO (FALHA)'}`)

    results.push({
      step: '11. Pedido sai de PedidosTab e entra em HistoricoTab',
      ok: step11Ok,
      saiuDePedidos: !inActiveTab,
      entrouEmHistorico: inDoneTab,
    })
    if (!step11Ok) throw new Error('Falha na migração do pedido para o Histórico')

  } finally {
    // -------------------------------------------------------------
    // TEARDOWN: Limpeza do produto de teste no D1
    // -------------------------------------------------------------
    if (createdProductId && supplier?.idToken) {
      console.log('\n[LIMPEZA] Removendo produto temporário de teste do catálogo (DELETE /products/:id)...')
      try {
        const deleteRes = await fetch(`${API_URL}/products/${createdProductId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${supplier.idToken}` },
        })
        const catalogCheckRes = await fetch(`${API_URL}/products`)
        const catalogCheck = await catalogCheckRes.json()
        const stillInCatalog = Array.isArray(catalogCheck) && !!catalogCheck.find((p) => p.id === createdProductId)
        console.log(`  Remoção do produto: HTTP ${deleteRes.status}, Excluído do catálogo público: ${!stillInCatalog ? 'SIM (limpo)' : 'NÃO'}`)
        results.push({ step: '12. Teardown: produto de teste excluído', ok: deleteRes.status === 204 && !stillInCatalog })
      } catch (cleanErr) {
        console.warn('  Aviso: Não foi possível remover produto de teste:', cleanErr.message)
      }
    }
  }

  console.log('\n===================================================================')
  console.log('  RESUMO DO TESTE END-TO-END')
  console.log('===================================================================')
  console.table(results)
  const allPassed = results.every((r) => r.ok)
  console.log(`\nResultado Geral: ${allPassed ? '🎉 FLUXO E2E APROVADO COM SUCESSO INTEGRAL' : '❌ FALHA EM UMA OU MAIS ETAPAS'}\n`)
}

runE2E().catch((err) => {
  console.error('\n💥 ERRO FATAL NA EXECUÇÃO DO TESTE E2E:', err)
  process.exit(1)
})
