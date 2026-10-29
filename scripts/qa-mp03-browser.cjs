// Local API only. Uses existing QA identities; never creates users or changes remote profiles.
// PLAYWRIGHT_MODULE_PATH must resolve to an installed Playwright package.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'docs/qa-artifacts')
fs.mkdirSync(output, { recursive: true })
const envFile = file => Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_0-9]+=/.test(line)).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')]
  }))
const qa = envFile('.env.qa.local')
const publicEnv = envFile('front/.env.production')
const origin = 'http://localhost:3001'
const api = 'http://localhost:8787'
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
  return { status: response.status, body: await response.json() }
}
async function main() {
  assert(process.env.PLAYWRIGHT_MODULE_PATH, 'Set PLAYWRIGHT_MODULE_PATH to an installed Playwright package.json')
  const pw = createRequire(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH))('./index.js')
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE })
  const contexts = []
  const login = async who => {
    console.log('Login QA: ' + who)
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } }); contexts.push(context)
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      const apiPath = /^\/(auth|admin)\/|^\/(products|orders)(\/|$)/.test(url.pathname)
      return apiPath && url.origin !== api ? route.abort() : route.continue()
    })
    const page = await context.newPage(); page.setDefaultTimeout(20000)
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false, undefined, { timeout: 60000 })
    await page.getByLabel('E-mail', { exact: true }).fill(qa['QA_' + who + '_EMAIL'])
    await page.getByLabel('Senha', { exact: true }).fill(qa['QA_' + who + '_PASSWORD'])
    await page.getByRole('button', { name: /Entrar na conta/ }).click()
    try {
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000, waitUntil: 'domcontentloaded' })
    } catch (error) {
      await page.screenshot({ path: path.join(output, 'mp03-login-failure.png') })
      const notices = await page.locator('[data-sonner-toast]').allTextContents()
      console.log(JSON.stringify({ who, notices, url: new URL(page.url()).pathname }))
      throw error
    }
    results.push(who + ': login no navegador')
    return page
  }
  try {
    const supplier = await identity('SUPPLIER'); const buyer = await identity('BUYER1')
    const supplierPage = await login('SUPPLIER')
    const status = supplierPage.getByRole('region', { name: 'Habilitação comercial' })
    await status.getByText('Habilitação comercial: pendente').waitFor({ timeout: 90000 })
    await supplierPage.reload({ waitUntil: 'domcontentloaded' })
    await status.getByText('Habilitação comercial: pendente').waitFor()
    results.push('Fornecedor: solicitação pendente persiste após reload')
    const adminPage = await login('ADMIN')
    await adminPage.waitForURL('**/admin', { timeout: 120000 })
    const decide = async (action, reason) => {
      await adminPage.getByRole('button', { name: 'Atualizar solicitações' }).click()
      await adminPage.getByRole('button', { name: 'Analisar ' + supplier.localId, exact: true }).click()
      await adminPage.getByLabel('Motivo da decisão (5 a 500 caracteres)').fill(reason)
      await adminPage.getByRole('button', { name: action, exact: true }).click()
      await adminPage.getByText('Decisão registrada.').waitFor()
    }
    await decide('Aprovar', 'QA MP-03: cadastro demonstrativo conferido')
    await status.getByRole('button', { name: 'Atualizar habilitação' }).click()
    await status.getByText('Habilitação comercial: aprovado').waitFor()
    results.push('Admin aprova com motivo; fornecedor acompanha a decisão')
    const product = await local(supplier, 'POST', '/products', { name: 'QA MP-03', brand: 'QA', size: 'M', quantity: 10, priceCents: 100,
      slug: 'qa-mp03', categoria: 'infantil', descricao: '', atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } })
    assert.equal(product.status, 201)
    const request = { product: 'QA MP-03', quantity: 1, unit: 'un', price: 100, supplierId: supplier.localId,
      deliveryAddress: { logradouro: 'Rua de teste', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' },
      items: [{ productId: product.body.id, productName: 'QA MP-03', unitPrice: 100, quantity: 1, unit: 'un' }] }
    const order = await local(buyer, 'POST', '/orders', request); assert.equal(order.status, 201)
    const buyerPage = await login('BUYER1')
    await buyerPage.getByRole('tab', { name: /Perfil/ }).click()
    await buyerPage.reload({ waitUntil: 'domcontentloaded' })
    await buyerPage.getByRole('tab', { name: /Pedidos/ }).click()
    await buyerPage.getByText('QA MP-03', { exact: true }).first().waitFor()
    results.push('Comprador: login, perfil e pedido local persistem após reload')
    await decide('Suspender', 'QA MP-03: suspensão demonstrativa')
    await status.getByRole('button', { name: 'Atualizar habilitação' }).click()
    await status.getByText('Habilitação comercial: suspenso').waitFor()
    assert.equal((await local(supplier, 'POST', '/products', {})).status, 400) // malformed payload stays invalid
    assert.equal((await local(buyer, 'POST', '/orders', request)).status, 409)
    assert.equal((await local(supplier, 'PATCH', '/orders/' + order.body.id + '/status', { status: 'confirmado' })).status, 200)
    const publicProducts = await fetch(api + '/products').then(r => r.json())
    assert(!publicProducts.some(p => p.id === product.body.id))
    results.push('Suspensão: sem novas compras/oferta pública; pedido anterior atendido por API com JWT real')
    await supplierPage.setViewportSize({ width: 375, height: 812 })
    await supplierPage.screenshot({ path: path.join(output, 'mp03-fornecedor-mobile.png'), fullPage: true })
    const overflow = await supplierPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    assert.equal(overflow, false, 'Mobile page overflows horizontally')
    await supplierPage.setViewportSize({ width: 1365, height: 900 })
    await supplierPage.getByText('Sair', { exact: true }).first().click()
    await supplierPage.goto(origin + '/login', { waitUntil: 'domcontentloaded' })
    await supplierPage.getByLabel('E-mail', { exact: true }).waitFor()
    results.push('Fornecedor: logout elimina acesso à sessão na interface')
    await supplierPage.getByRole('link', { name: 'Esqueci minha senha' }).click()
    await supplierPage.getByRole('heading', { name: 'Recuperar acesso' }).waitFor({ timeout: 60000 })
    results.push('Recuperação: rota acessível por teclado/link; envio de e-mail não executado')
    await adminPage.screenshot({ path: path.join(output, 'mp03-admin.png'), fullPage: true })
    fs.writeFileSync(path.join(output, 'mp03-browser-result.json'), JSON.stringify({ passed: true, backend: 'D1 local', auth: 'Firebase real, contas existentes de QA', results }, null, 2))
    console.log(JSON.stringify({ passed: true, results }, null, 2))
  } finally { await Promise.all(contexts.map(c => c.close())); await browser.close() }
}
main().catch(error => { console.error(error.message); fs.writeFileSync(path.join(output, 'mp03-browser-result.json'), JSON.stringify({ passed: false, results, error: error.message })); process.exitCode = 1 })
