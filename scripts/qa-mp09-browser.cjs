// Existing QA identities only. All business reads/writes must target loopback API/D1.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'docs/qa-artifacts')
function localOrigin(value) {
  const url = new URL(value)
  assert(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname), 'QA requires an HTTP loopback origin')
  return url.origin
}
const origin = localOrigin(process.env.QA_FRONTEND_ORIGIN || 'http://localhost:3005')
const api = localOrigin(process.env.QA_API_ORIGIN || 'http://127.0.0.1:8794')
const envFile = file => Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).filter(line => /^[A-Z_0-9]+=/.test(line)).map(line => {
  const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')]
}))
const qa = envFile('.env.qa.local'), publicEnv = envFile('front/.env.production')
async function identity(who) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qa['QA_' + who + '_EMAIL'], password: qa['QA_' + who + '_PASSWORD'], returnSecureToken: true }),
  })
  assert.equal(response.status, 200, 'Existing QA authentication failed: ' + who)
  return response.json()
}
async function request(who, method, route, body, key = crypto.randomUUID()) {
  assert(route.startsWith('/') && !route.startsWith('//'))
  const run = () => fetch(api + route, { method, headers: { Authorization: 'Bearer ' + who.idToken, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body) })
  let response = await run()
  if (response.status === 401) response = await run() // Cold JWKS; same key/body, no bypass.
  return { status: response.status, body: await response.json() }
}
const call = async (...args) => { const result = await request(...args); assert(result.status >= 200 && result.status < 300, args[1] + ' ' + args[2] + ': ' + result.status); return result.body }
const results = []
async function main() {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH)
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE })
  const contexts = []; let currentPage
  try {
    for (const route of ['/login', '/avisos', '/minha-conta', '/painel-fornecedor']) assert.equal((await fetch(origin + route)).status, 200)
    const supplier = await identity('SUPPLIER'), supplier2 = await identity('SUPPLIER2'), buyer = await identity('BUYER1'), admin = await identity('ADMIN')
    const outsider = supplier2
    const identities = { SUPPLIER: supplier, SUPPLIER2: supplier2, BUYER1: buyer, ADMIN: admin }
    async function login(who, destination = '/avisos', existingPage) {
      let page = existingPage
      if (!page) {
        const context = await browser.newContext({ viewport: { width: 1365, height: 900 } }); contexts.push(context)
        await context.route('**/*', route => {
          const url = new URL(route.request().url())
          return (/^\/(auth|admin)\/|^\/(products|orders|notifications)(\/|$)/.test(url.pathname) && url.origin !== api) ? route.abort() : route.continue()
        })
        page = await context.newPage()
      }
      currentPage = page; page.setDefaultTimeout(120000)
      await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false)
      await page.getByLabel('E-mail', { exact: true }).fill(qa['QA_' + who + '_EMAIL'])
      await page.getByLabel('Senha', { exact: true }).fill(qa['QA_' + who + '_PASSWORD'])
      await page.getByRole('button', { name: /Entrar na conta/ }).click()
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded' })
      await page.goto(origin + destination, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: 'Meus avisos', exact: true }).waitFor()
      return page
    }
    async function notices(who) { return (await call(who, 'GET', '/notifications?limit=50')).items }
    async function find(who, kind, orderId, reportId) {
      for (const item of await notices(who)) {
        if (item.kind !== kind) continue
        const destination = await call(who, 'GET', '/notifications/' + item.id + '/destination')
        if ((!orderId || destination.orderId === orderId) && (!reportId || destination.reportId === reportId)) return item
      }
      assert.fail('Expected notification: ' + kind)
    }
    async function visit(who, notice, text) {
      const page = await login(who, '/avisos?notification=' + notice.id)
      await page.getByTestId('notification-' + notice.id).waitFor()
      await page.getByText(text, { exact: false }).first().waitFor()
      return page
    }
    console.log('QA MP09: supplier decisions and fresh session')
    for (const who of [supplier, supplier2]) await call(who, 'POST', '/auth/supplier-application', {})
    const application = await call(supplier, 'GET', '/auth/supplier-application')
    if (application.application.status !== 'aprovado') await call(admin, 'PATCH', '/admin/suppliers/' + supplier.localId, { status: 'aprovado', expectedVersion: application.application.version, reason: 'QA MP09 somente D1 local' })
    const app2 = await call(supplier2, 'GET', '/auth/supplier-application')
    assert.equal(app2.application.status, 'pendente', 'Use a fresh local D1 for this journey')
    const rejected = { status: 'rejeitado', expectedVersion: app2.application.version, reason: 'Rejeição demonstrativa no D1 de QA' }
    await call(admin, 'PATCH', '/admin/suppliers/' + supplier2.localId, rejected)
    await call(admin, 'PATCH', '/admin/suppliers/' + supplier2.localId, rejected)
    let notice = (await notices(supplier2)).find(item => item.message.includes('rejeitado'))
    assert(notice); let page = await visit('SUPPLIER2', notice, 'Consultar situação do cadastro')
    assert.equal(await page.getByRole('link', { name: 'Consultar situação do cadastro' }).getAttribute('href'), '/painel-fornecedor')
    await page.context().close()
    await call(admin, 'PATCH', '/admin/suppliers/' + supplier2.localId, { status: 'aprovado', expectedVersion: app2.application.version + 1, reason: 'Aprovação demonstrativa no D1 de QA' })
    assert.equal((await notices(supplier2)).filter(item => item.kind === 'supplier_decision').length, 2)
    results.push('Decisão de cadastro persiste, replay não duplica e nova sessão abre somente o destino autorizado')

    const product = await call(supplier, 'POST', '/products', { name: 'QA MP09 ' + crypto.randomUUID(), slug: 'qa-mp09-' + crypto.randomUUID(), brand: 'QA', size: 'M', quantity: 30, priceCents: 100, categoria: 'infantil', descricao: 'Somente QA local', atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } })
    const payload = { product: product.name, quantity: 2, unit: 'un', price: 200, supplierId: supplier.localId, simulationOutcome: 'approved', deliveryAddress: { logradouro: 'Rua QA MP09', numero: '9', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }, items: [{ productId: product.id, productName: product.name + ' M', quantity: 2, unitPrice: 100, unit: 'un' }] }
    const create = () => call(buyer, 'POST', '/orders', payload)
    console.log('QA MP09: new order, double read and persistence')
    const key = crypto.randomUUID(), order = await call(buyer, 'POST', '/orders', payload, key)
    await call(buyer, 'POST', '/orders', payload, key)
    notice = await find(supplier, 'new_order', order.id)
    assert.equal((await notices(supplier)).filter(item => item.kind === 'new_order').length, 1)
    assert.equal((await notices(buyer)).length, 0)
    page = await visit('SUPPLIER', notice, 'Estado registrado:')
    const writes = []
    page.on('request', r => { if (r.method() === 'PATCH' && r.url().includes('/notifications/')) writes.push(r.url()) })
    const card = page.getByTestId('notification-' + notice.id)
    await card.getByRole('button', { name: 'Marcar como lido' }).evaluate(button => { button.click(); button.click() })
    await card.getByText('Lido', { exact: true }).waitFor(); assert.equal(writes.length, 1)
    await page.context().close()
    page = await visit('SUPPLIER', notice, 'Estado registrado:'); await page.getByTestId('notification-' + notice.id).getByText('Lido', { exact: true }).waitFor()
    await page.context().close()
    results.push('Novo pedido avisa apenas fornecedor; repetição não duplica; clique duplo de leitura faz um PATCH e persiste após nova sessão')

    console.log('QA MP09: statuses and cancellations with fresh sessions')
    for (const [status, text] of [['confirmado', 'Pedido confirmado.'], ['a-caminho', 'Pedido a caminho.'], ['entregue', 'Pedido entregue.']]) {
      await call(supplier, 'PATCH', '/orders/' + order.id + '/status', { status })
      const item = (await notices(buyer)).find(item => item.message === text)
      assert(item); page = await visit('BUYER1', item, 'Estado registrado:'); await page.context().close()
    }
    for (const actor of ['buyer', 'supplier', 'admin']) {
      const item = await create()
      if (actor === 'buyer') await call(buyer, 'PATCH', '/orders/' + item.id + '/cancel')
      else await call(actor === 'supplier' ? supplier : admin, 'PATCH', '/orders/' + item.id + '/status', { status: 'cancelado', reason: 'Cancelamento QA MP09 com motivo' })
      const who = actor === 'buyer' ? 'SUPPLIER' : 'BUYER1'
      const message = await find(identities[who], 'order_cancelled', item.id)
      page = await visit(who, message, 'Estado registrado:'); await page.getByText('Estado registrado: Cancelado', { exact: true }).waitFor(); await page.context().close()
      if (actor === 'admin') assert(await find(supplier, 'order_cancelled', item.id))
    }
    results.push('Confirmação/despacho/entrega e três papéis de cancelamento geram avisos corretos, consultáveis em novas sessões')

    console.log('QA MP09: occurrence replies and resolution')
    const reportId = crypto.randomUUID(), base = '/orders/' + order.id + '/occurrences'
    await call(buyer, 'POST', base, { message: 'Atendimento MP09 em pedido entregue', requestId: reportId })
    const before = await call(buyer, 'GET', '/orders/' + order.id)
    const reply = { message: 'Resposta do fornecedor visível pelo aviso', requestId: crypto.randomUUID(), expectedVersion: 0, status: 'em_atendimento' }
    await call(supplier, 'POST', base + '/' + reportId + '/messages', reply)
    await call(supplier, 'POST', base + '/' + reportId + '/messages', reply)
    const occurrenceNotice = await find(buyer, 'occurrence_reply', order.id, reportId)
    page = await visit('BUYER1', occurrenceNotice, reply.message); await page.context().close()
    await call(buyer, 'POST', base + '/' + reportId + '/messages', { message: 'Resposta do comprador para o fornecedor', requestId: crypto.randomUUID(), expectedVersion: 1, status: 'em_atendimento' })
    notice = await find(supplier, 'occurrence_reply', order.id, reportId)
    page = await visit('SUPPLIER', notice, 'Resposta do comprador para o fornecedor'); await page.context().close()
    await call(admin, 'POST', base + '/' + reportId + '/messages', { message: 'Resolução administrativa registrada no aviso', requestId: crypto.randomUUID(), expectedVersion: 2, status: 'resolvida' })
    notice = await find(buyer, 'occurrence_reply', order.id, reportId)
    assert.equal(notice.message, 'Uma ocorrência recebeu resposta de resolução.')
    assert(await find(supplier, 'occurrence_reply', order.id, reportId))
    assert.deepEqual(await call(buyer, 'GET', '/orders/' + order.id), before)
    const stock = (await call(supplier, 'GET', '/products?scope=fornecedor')).find(item => item.id === product.id)
    assert.equal(stock.quantity, 28, 'Occurrence notices cannot alter commercial stock')
    page = await visit('BUYER1', notice, 'Resolução administrativa registrada no aviso')
    results.push('Aviso abre a conversa exata; fornecedor/comprador/admin respondem, resolução avisa ambas as partes e não muda pedido/eventos')

    console.log('QA MP09: network recovery, mobile and account isolation')
    const target = page.getByTestId('notification-' + notice.id), readPath = api + '/notifications/' + notice.id + '/read'
    const loseRead = async route => { await route.fetch(); await route.abort('failed') }
    await page.route(readPath, loseRead)
    await target.getByRole('button', { name: 'Marcar como lido' }).click()
    await page.getByText(/Não foi possível confirmar a leitura/).waitFor()
    await page.unroute(readPath, loseRead)
    await page.getByRole('button', { name: 'Atualizar avisos', exact: true }).click()
    await target.getByText('Lido', { exact: true }).waitFor()
    const offline = route => route.abort('failed')
    await page.route(api + '/notifications', offline)
    await page.getByRole('button', { name: 'Atualizar avisos', exact: true }).click()
    await page.getByText(/Os últimos dados foram preservados/).waitFor(); await target.waitFor()
    await page.unroute(api + '/notifications', offline)
    await page.getByRole('button', { name: 'Atualizar avisos', exact: true }).click()
    await page.getByText(/Os últimos dados foram preservados/).waitFor({ state: 'hidden' })
    for (const width of [1024, 375]) {
      await page.setViewportSize({ width, height: 900 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notification overflow at ' + width)
    }
    await page.screenshot({ path: path.join(output, 'mp09-notifications-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Atualizar avisos', exact: true }).focus(); await page.keyboard.press('Tab')
    assert(await page.evaluate(() => document.activeElement !== document.body), 'Keyboard focus lost')
    await page.setViewportSize({ width: 1365, height: 900 }); await page.screenshot({ path: path.join(output, 'mp09-notifications-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: buyer.displayName || qa.QA_BUYER1_EMAIL, exact: true }).click()
    await page.getByRole('menuitem', { name: /Sair/ }).click()
    // The protected route may redirect to login before the header's home navigation completes.
    await page.waitForURL(url => url.pathname === '/' || url.pathname === '/login', { waitUntil: 'domcontentloaded' })
    page = await login('SUPPLIER2', '/avisos?notification=' + notice.id, page)
    await page.getByText('Seu cadastro de fornecedor foi aprovado.', { exact: true }).waitFor(); await page.getByText(/Não foi possível abrir este destino/).waitFor()
    assert.equal(await page.getByText('Resolução administrativa registrada no aviso', { exact: true }).count(), 0)
    for (const who of [outsider, admin]) {
      assert.equal((await request(who, 'GET', '/notifications/' + notice.id + '/destination')).status, 404)
      assert.equal((await request(who, 'PATCH', '/notifications/' + notice.id + '/read')).status, 404)
    }
    assert.equal((await notices(outsider)).filter(item => item.kind !== 'supplier_decision').length, 0); assert.equal((await notices(admin)).length, 0)
    results.push('Perda de resposta após leitura recupera estado persistido; falha de atualização preserva dados; 1024/375px sem overflow; troca de conta remove conversa e terceiros/admin não acessam aviso alheio')
    fs.writeFileSync(path.join(output, 'mp09-browser-result.json'), JSON.stringify({ passed: true, results }, null, 2))
    console.log(JSON.stringify({ passed: true, results }, null, 2))
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, 'mp09-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { for (const context of contexts) await context.close().catch(() => {}); await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
