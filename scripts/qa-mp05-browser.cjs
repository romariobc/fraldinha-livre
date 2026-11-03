// Existing QA accounts; identity/profile reads only. Business writes are restricted to a separate local D1.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'docs/qa-artifacts')
const envFile = file => Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_0-9]+=/.test(line)).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')]
  }))
const qa = envFile('.env.qa.local'), publicEnv = envFile('front/.env.production')
const origin = 'http://localhost:3001', api = 'http://127.0.0.1:8787'
const results = []
async function identity(who) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      email: qa['QA_' + who + '_EMAIL'], password: qa['QA_' + who + '_PASSWORD'], returnSecureToken: true }) })
  assert.equal(response.status, 200, 'QA authentication failed: ' + who)
  return response.json()
}
async function local(who, method, route, body) {
  const response = await fetch(api + route, { method, headers: { Authorization: 'Bearer ' + who.idToken,
    'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, body: response.status === 204 ? null : await response.json() }
}
async function main() {
  const cp = require('node:child_process')
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH)
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const ids = [], expected = new Map(), requests = []
  let page
  const check = async (response, status, operation) => { assert.equal(response.status, status, operation); return response.body }
  const call = async (...args) => {
    let response = await local(...args)
    if (response.status === 401) response = await local(...args) // cold JWKS fetch, no auth bypass
    return response
  }
  try {
    const a = await identity('SUPPLIER'), b = await identity('SUPPLIER2'), admin = await identity('ADMIN'), buyer = await identity('BUYER1')
    for (const supplier of [a, b]) {
      const application = await check(await call(supplier, 'POST', '/auth/supplier-application', {}), 200, 'request approval locally')
      if (application.application.status !== 'aprovado') await check(await call(admin, 'PATCH', '/admin/suppliers/' + supplier.localId,
        { status: 'aprovado', expectedVersion: application.application.version, reason: 'QA MP-05: aprovação apenas no D1 local' }), 200, 'local approval')
    }
    async function fixture(supplier = a, stock = 10) {
      const body = await check(await call(supplier, 'POST', '/products', { name: 'QA MP05 ' + crypto.randomUUID(), slug: 'qa-mp05-' + crypto.randomUUID(),
        brand: 'QA', size: 'M', quantity: stock, priceCents: 100, categoria: 'infantil', descricao: 'Somente QA local',
        atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } }), 201, 'local fixture')
      ids.push(body.id)
      return { productId: body.id, productName: body.name + ' M', supplierId: supplier.localId,
        supplierName: 'Fornecedor ' + supplier.localId, unitPrice: 100, quantity: 2, unit: 'un' }
    }
    async function orders(item) {
      const history = await check(await call(buyer, 'GET', '/orders'), 200, 'read local orders')
      return history.filter(order => order.items.some(line => line.productId === item.productId))
    }
    async function verify(item, stock, count) {
      const supplier = item.supplierId === a.localId ? a : b
      const list = await check(await call(supplier, 'GET', '/products?scope=fornecedor'), 200, 'read local stock')
      assert.equal(list.find(p => p.id === item.productId).quantity, stock)
      const found = await orders(item); assert.equal(found.length, count)
      for (const order of found) { assert.equal(order.paymentMode, 'simulated'); assert.equal(order.paymentStatus, 'approved'); assert(order.paymentTransactionId.startsWith('sim-')) }
      expected.set(item.productId, { stock, count })
    }
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      const business = /^\/(auth|admin)\/|^\/(products|orders)(\/|$)/.test(url.pathname)
      return business && url.origin !== api ? route.abort() : route.continue()
    })
    const observe = tab => tab.on('request', request => {
      if (request.url() === api + '/orders' && request.method() === 'POST') requests.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() })
    })
    page = await context.newPage(); page.setDefaultTimeout(30000); observe(page)
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false)
    await page.getByLabel('E-mail', { exact: true }).fill(qa.QA_BUYER1_EMAIL)
    await page.getByLabel('Senha', { exact: true }).fill(qa.QA_BUYER1_PASSWORD)
    await page.getByRole('button', { name: /Entrar na conta/ }).click()
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded', timeout: 120000 })
    async function newCart(items) {
      const next = page.getByRole('button', { name: /^(Nova compra|Revisar sacola para nova tentativa)$/ })
      if (await next.count()) { await next.click(); await page.waitForURL(url => url.pathname === '/sacola') }
      await page.evaluate(({ items, uid }) => {
        if (localStorage.getItem('fl.checkout.v1:' + encodeURIComponent(uid))) throw Error('Previous attempt still exists')
        const previous = JSON.parse(localStorage.getItem('fl.cart.v2') || '{"receipts":[]}')
        localStorage.setItem('fl.cart.v2', JSON.stringify({ version: 2, items, receipts: previous.receipts || [] }))
      }, { items, uid: buyer.localId })
      await page.goto(origin + '/checkout', { waitUntil: 'domcontentloaded', timeout: 120000 })
    }
    async function payment(tab = page) {
      await tab.getByText('Outro endereço', { exact: true }).waitFor({ timeout: 120000 })
      await tab.getByText('Outro endereço', { exact: true }).click()
      for (const [field, value] of [['Logradouro *', 'Rua QA'], ['Número *', '1'], ['Bairro *', 'Centro'], ['CEP *', '60000-000'], ['Cidade *', 'Fortaleza'], ['UF (ex: SP) *', 'CE']]) await tab.getByPlaceholder(field, { exact: true }).fill(value)
      await tab.getByRole('button', { name: 'Continuar', exact: true }).click()
      await tab.getByRole('button', { name: 'Continuar', exact: true }).click()
      await tab.getByRole('heading', { name: 'Pagamento simulado' }).waitFor()
      assert.equal(await tab.locator('input[autocomplete="cc-number"],input[name="cardNumber"]').count(), 0)
    }
    const confirm = () => page.getByRole('button', { name: 'Confirmar compra simulada', exact: true }).click()
    const recover = () => page.getByRole('button', { name: 'Recuperar tentativa', exact: true }).click()
    const state = () => page.evaluate(uid => JSON.parse(localStorage.getItem('fl.checkout.v1:' + encodeURIComponent(uid))), buyer.localId)
    const cart = () => page.evaluate(() => JSON.parse(localStorage.getItem('fl.cart.v2')).items)
    console.log('QA: aprovação e clique duplo')
    const single = await fixture(); await newCart([single]); await payment()
    await page.evaluate(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Confirmar compra simulada'); button.click(); button.click() })
    await page.getByText('Pedidos registrados', { exact: true }).waitFor()
    await verify(single, 8, 1); assert.deepEqual(await cart(), [])
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByText('Pedidos registrados', { exact: true }).waitFor()
    await verify(single, 8, 1)
    results.push('Aprovação, clique duplo e recarga: um pedido, uma reserva e metadados gerados pelo servidor')
    console.log('QA: recusa de dois fornecedores')
    const refusedA = await fixture(), refusedB = await fixture(b)
    await newCart([refusedA, refusedB]); await payment()
    await page.getByText('Cartão simulado, sem dados do cartão', { exact: true }).click()
    await page.getByText('Recusar simulação', { exact: true }).click(); await confirm()
    await page.getByText('Simulação recusada', { exact: true }).nth(1).waitFor()
    await verify(refusedA, 10, 0); await verify(refusedB, 10, 0); assert.equal((await cart()).length, 2)
    results.push('Recusa de dois fornecedores: nenhum pedido, evento ou reserva; sacola preservada')
    console.log('QA: sucesso parcial e recuperação')
    const partialA = await fixture(), partialB = await fixture(b, 1)
    await newCart([partialA, partialB]); await payment(); await confirm()
    await page.getByText('Pedido não registrado', { exact: true }).waitFor()
    const partial = await state(); await verify(partialA, 8, 1); await verify(partialB, 1, 0)
    assert.deepEqual((await cart()).map(i => i.productId), [partialB.productId])
    await page.screenshot({ path: path.join(output, 'mp05-partial-desktop.png'), fullPage: true })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await check(await call(b, 'PUT', '/products/' + partialB.productId, { quantity: 10 }), 200, 'local restock')
    await recover(); await page.getByText('Pedidos registrados', { exact: true }).waitFor()
    const partialDone = await state(); assert.deepEqual(partialDone.groups.map(g => g.key), partial.groups.map(g => g.key))
    await verify(partialA, 8, 1); await verify(partialB, 8, 1); assert.deepEqual(await cart(), [])
    results.push('Sucesso parcial após recarga mantém chave do fornecedor restante; nenhum pedido ou desconto de sacola duplicado')
    for (const afterCommit of [false, true]) {
      console.log('QA: timeout ' + (afterCommit ? 'após' : 'antes') + ' commit')
      const item = await fixture(); await newCart([item]); await payment()
      let lose = true
      const intercept = async route => {
        if (!lose) return route.continue()
        lose = false
        if (afterCommit) { const response = await route.fetch(); assert.equal(response.status(), 201) }
        return route.abort('timedout')
      }
      await page.route(api + '/orders', intercept)
      await confirm(); await page.getByText('Resultado desconhecido', { exact: true }).waitFor()
      const unknown = await state(); await verify(item, afterCommit ? 8 : 10, afterCommit ? 1 : 0)
      assert.equal(await page.getByRole('button', { name: 'Nova compra', exact: true }).count(), 0)
      if (afterCommit) {
        await page.setViewportSize({ width: 375, height: 812 })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow')
        await page.screenshot({ path: path.join(output, 'mp05-unknown-mobile.png'), fullPage: true })
        await page.setViewportSize({ width: 1365, height: 900 })
      }
      const original = afterCommit ? (await orders(item))[0] : null
      if (afterCommit) {
        await page.getByRole('link', { name: 'Ver meus pedidos', exact: true }).click()
        await page.waitForURL(url => url.pathname === '/minha-conta')
        await page.getByText(item.productName, { exact: true }).first().waitFor()
        await page.goto(origin + '/checkout', { waitUntil: 'domcontentloaded' })
      } else await page.reload({ waitUntil: 'domcontentloaded' })
      await recover()
      await page.getByText('Pedidos registrados', { exact: true }).waitFor()
      assert.equal((await state()).groups[0].key, unknown.groups[0].key)
      await verify(item, 8, 1)
      if (original) assert.equal((await orders(item))[0].paymentTransactionId, original.paymentTransactionId)
      assert.deepEqual(await cart(), [])
      await page.unroute(api + '/orders', intercept)
      results.push('Timeout ' + (afterCommit ? 'após' : 'antes') + ' commit: recarga e replay da mesma chave, uma única reserva')
    }
    console.log('QA: duas abas concorrentes')
    const concurrent = await fixture(); await newCart([concurrent]); await payment()
    const second = await context.newPage(); second.setDefaultTimeout(30000); observe(second)
    await second.goto(origin + '/checkout', { waitUntil: 'domcontentloaded' }); await payment(second)
    let release, entered
    const gate = new Promise(resolve => { release = resolve }), entry = new Promise(resolve => { entered = resolve })
    await page.route(api + '/orders', async route => { entered(); await gate; await route.continue() })
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Confirmar compra simulada').click())
    await entry
    await second.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Confirmar compra simulada').click())
    release()
    await page.getByText('Pedidos registrados', { exact: true }).waitFor()
    await second.getByText('Pedidos registrados', { exact: true }).waitFor()
    await verify(concurrent, 8, 1); assert.deepEqual(await cart(), []); await second.close()
    results.push('Duas abas concorrentes compartilham a tentativa e geram somente um pedido')
    for (const id of ids) assert(/^[a-f0-9-]{36}$/.test(id))
    const quoted = ids.map(id => "'" + id + "'").join(',')
    const sql = 'SELECT p.id, p.quantity AS stock, COUNT(DISTINCT i.order_id) AS orders, MAX(o.payment_mode) AS mode, ' +
      '(SELECT COUNT(*) FROM order_events e WHERE e.order_id IN (SELECT order_id FROM order_items WHERE product_id = p.id)) AS events ' +
      'FROM products p LEFT JOIN order_items i ON i.product_id = p.id LEFT JOIN orders o ON o.id = i.order_id WHERE p.id IN (' + quoted + ') GROUP BY p.id'
    const raw = cp.execFileSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', '--local',
      '--config', 'back/wrangler.test.jsonc', '--persist-to', path.join(output, 'mp05-d1'), '--command', sql, '--json'], { cwd: root, encoding: 'utf8', timeout: 60000 })
    const rows = JSON.parse(raw)[0].results
    assert.equal(rows.length, expected.size)
    for (const row of rows) { const check = expected.get(row.id); assert.equal(row.stock, check.stock); assert.equal(row.orders, check.count); assert.equal(row.events, check.count); if (check.count) assert.equal(row.mode, 'simulated') }
    fs.writeFileSync(path.join(output, 'mp05-d1-assertions.json'), JSON.stringify(rows, null, 2))
    results.push('SQL direto no D1 local confirma pedidos, eventos, estoque e modo simulado em todos os cenários')
    fs.writeFileSync(path.join(output, 'mp05-browser-result.json'), JSON.stringify({ passed: true, results, requests: requests.length }, null, 2))
    console.log(JSON.stringify({ passed: true, results }))
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'mp05-browser-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { await context.close(); await browser.close() }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1 })
