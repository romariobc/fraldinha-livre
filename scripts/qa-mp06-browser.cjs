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
const origin = 'http://localhost:3002', api = 'http://127.0.0.1:8791'
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
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH)
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE })
  const contexts = []
  let activePage
  const call = async (who, method, route, body) => {
    let result = await local(who, method, route, body)
    if (result.status === 401) result = await local(who, method, route, body)
    assert(result.status >= 200 && result.status < 300, method + ' ' + route + ': ' + result.status)
    return result.body
  }
  async function login(who, destination, state) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, storageState: state })
    contexts.push(context)
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      const business = /^\/(auth|admin)\/|^\/(products|orders)(\/|$)/.test(url.pathname)
      return business && url.origin !== api ? route.abort() : route.continue()
    })
    const page = await context.newPage(); activePage = page
    page.setDefaultTimeout(120000)
    if (!state) {
      await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false)
      await page.getByLabel('E-mail', { exact: true }).fill(qa['QA_' + who + '_EMAIL'])
      await page.getByLabel('Senha', { exact: true }).fill(qa['QA_' + who + '_PASSWORD'])
      await page.getByRole('button', { name: /Entrar na conta/ }).click()
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { waitUntil: 'domcontentloaded' })
    }
    await page.goto(origin + destination, { waitUntil: 'domcontentloaded' })
    return { context, page }
  }
  try {
    console.log('QA: autenticação e fixtures locais')
    const supplier = await identity('SUPPLIER'), buyer = await identity('BUYER1'), admin = await identity('ADMIN')
    const application = await call(supplier, 'POST', '/auth/supplier-application', {})
    if (application.application.status !== 'aprovado') await call(admin, 'PATCH', '/admin/suppliers/' + supplier.localId, { status: 'aprovado', expectedVersion: application.application.version, reason: 'QA MP06 somente D1 local' })
    const product = await call(supplier, 'POST', '/products', { name: 'QA MP06 ' + crypto.randomUUID(), slug: 'qa-mp06-' + crypto.randomUUID(), brand: 'QA', size: 'M', quantity: 10, priceCents: 100, categoria: 'infantil', descricao: 'QA local MP06', atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } })
    const order = await call(buyer, 'POST', '/orders', { product: product.name + ' M', quantity: 2, unit: 'un', price: 200, supplierId: supplier.localId, deliveryAddress: { logradouro: 'Rua original MP06', numero: '7', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' }, items: [{ productId: product.id, productName: product.name + ' M', quantity: 2, unitPrice: 100, unit: 'un' }] })
    console.log('QA: comprador e polling de 30s')
    const b = await login('BUYER1', '/minha-conta')
    await b.page.getByTestId('order-card-' + order.id).getByRole('button', { name: 'Ver detalhes do pedido', exact: true }).click()
    const tracking = b.page.getByRole('region', { name: 'Acompanhamento do pedido' })
    await tracking.getByText('Estado registrado:').waitFor()
    assert((await tracking.innerText()).includes(order.id))
    await call(supplier, 'PATCH', '/orders/' + order.id + '/status', { status: 'confirmado' })
    // A real 30-second interval must observe the change without a reload/manual click.
    await tracking.getByText('Aguardando confirmação → Confirmado', { exact: true }).waitFor({ timeout: 45000 })
    assert.equal(await tracking.locator('li').count(), 2)
    results.push('Comprador observa confirmação no polling real de 30 segundos, sem recarregar')
    console.log('QA: fornecedor e despacho')
    const s = await login('SUPPLIER', '/painel-fornecedor/pedidos')
    await s.page.getByTestId('order-id-' + order.id).click()
    const supplierTracking = s.page.getByRole('region', { name: 'Acompanhamento do pedido' })
    await supplierTracking.getByText('Aguardando confirmação → Confirmado', { exact: true }).waitFor()
    await s.page.getByRole('button', { name: 'Despachar Pedido', exact: true }).click()
    // Return focus explicitly after another window; no status write is made by the buyer.
    await b.page.bringToFront()
    await b.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await tracking.getByText('Confirmado → A caminho', { exact: true }).waitFor()
    results.push('Fornecedor despacha pela interface; comprador recebe evento ao retomar foco')
    console.log('QA: administrador e igualdade de snapshots')
    const a = await login('ADMIN', '/admin')
    await a.page.getByRole('tab', { name: 'Pedidos', exact: true }).click()
    await a.page.getByRole('button', { name: 'Ver detalhes do pedido ' + order.id, exact: true }).click()
    const adminTracking = a.page.getByRole('region', { name: 'Acompanhamento do pedido' })
    await adminTracking.getByText('Confirmado → A caminho', { exact: true }).waitFor()
    assert.equal(await adminTracking.locator('li').count(), 3)
    const apiDetails = await Promise.all([[buyer,'comprador'],[supplier,'fornecedor'],[admin,'admin']].map(([who, scope]) => call(who, 'GET', '/orders/' + order.id + '?scope=' + scope)))
    assert.deepEqual(apiDetails[0], apiDetails[1]); assert.deepEqual(apiDetails[0], apiDetails[2])
    results.push('Admin, fornecedor e comprador consultam os mesmos snapshots, estado e eventos na API autenticada')
    const intercept = route => route.abort('internetdisconnected')
    await b.page.route(api + '/orders*', intercept)
    await tracking.getByRole('button', { name: 'Atualizar acompanhamento' }).click()
    await tracking.getByRole('alert').waitFor()
    assert.equal(await tracking.locator('li').count(), 3)
    await b.page.unroute(api + '/orders*', intercept)
    await tracking.getByRole('button', { name: 'Atualizar acompanhamento' }).click()
    await tracking.getByRole('alert').waitFor({ state: 'hidden' })
    results.push('Falha de rede preserva snapshot e eventos; atualização manual recupera a consulta')
    // IndexedDB is included in the in-memory browser state; no credentials/session file is written.
    const savedState = await b.context.storageState({ indexedDB: true })
    const renewed = await login('BUYER1', '/minha-conta', savedState)
    await renewed.page.getByTestId('order-card-' + order.id).getByRole('button', { name: 'Ver detalhes do pedido', exact: true }).click()
    const renewedTracking = renewed.page.getByRole('region', { name: 'Acompanhamento do pedido' })
    await renewedTracking.getByText('Confirmado → A caminho', { exact: true }).waitFor()
    await renewed.page.setViewportSize({ width: 375, height: 812 })
    assert(await renewed.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow')
    await renewed.page.screenshot({ path: path.join(output, 'mp06-tracking-mobile.png'), fullPage: true })
    await a.page.screenshot({ path: path.join(output, 'mp06-tracking-admin.png'), fullPage: true })
    results.push('Nova sessão do navegador recupera detalhes e histórico persistidos; 375px sem transbordamento')
    fs.writeFileSync(path.join(output, 'mp06-browser-result.json'), JSON.stringify({ passed: true, orderId: order.id, results }, null, 2))
    console.log(JSON.stringify({ passed: true, results }, null, 2))
  } catch (error) {
    if (activePage) await activePage.screenshot({ path: path.join(output, 'mp06-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { for (const context of contexts) await context.close(); await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
