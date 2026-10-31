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
const origin = 'http://localhost:3001', api = 'http://localhost:8787'
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
  assert(process.env.PLAYWRIGHT_MODULE_PATH, 'Configure an installed Playwright module path')
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH)
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE })
  const contexts = []
  async function pageFor(who) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } }); contexts.push(context)
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      const business = /^\/(auth|admin)\/|^\/(products|orders)(\/|$)/.test(url.pathname)
      return business && url.origin !== api ? route.abort() : route.continue()
    })
    const page = await context.newPage(); page.setDefaultTimeout(30000)
    if (who) {
      await page.goto(origin + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 })
      await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false)
      await page.getByLabel('E-mail', { exact: true }).fill(qa['QA_' + who + '_EMAIL'])
      await page.getByLabel('Senha', { exact: true }).fill(qa['QA_' + who + '_PASSWORD'])
      await page.getByRole('button', { name: /Entrar na conta/ }).click()
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000, waitUntil: 'domcontentloaded' })
    }
    return page
  }
  try {
    const a = await identity('SUPPLIER'), b = await identity('SUPPLIER2'), admin = await identity('ADMIN'), buyer = await identity('BUYER1')
    for (const supplier of [a, b]) {
      const application = await local(supplier, 'POST', '/auth/supplier-application', {})
      assert.equal(application.status, 200)
      if (application.body.application.status !== 'aprovado') {
        const decision = await local(admin, 'PATCH', '/admin/suppliers/' + supplier.localId,
          { status: 'aprovado', expectedVersion: application.body.application.version, reason: 'QA MP-04: aprovação somente no D1 local' })
        assert.equal(decision.status, 200)
      }
    }
    const suffix = Date.now(), name = 'QA MP04 Oferta ' + suffix, slug = 'qa-mp04-dupla-' + suffix
    const supplierPage = await pageFor('SUPPLIER')
    await supplierPage.goto(origin + '/painel-fornecedor/catalogo', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await supplierPage.getByRole('button', { name: 'Cadastrar nova oferta', exact: true }).click()
    for (const [label, value] of [['Nome do produto', name], ['Marca', 'QA'], ['Tamanho', 'M'],
      ['Identificador na URL', slug], ['Categoria', 'infantil'], ['Preço (R$)', '2.00'], ['Estoque inicial', '9']]) {
      await supplierPage.getByLabel(label, { exact: true }).fill(value)
    }
    const posted = supplierPage.waitForResponse(r => r.url() === api + '/products' && r.request().method() === 'POST')
    await supplierPage.getByRole('button', { name: 'Cadastrar oferta', exact: true }).click()
    const response = await posted; assert.equal(response.status(), 201)
    const offer = await response.json()
    const draft = { name, slug, brand: 'QA', size: 'M', quantity: 8, priceCents: 300,
      categoria: 'infantil', descricao: 'Demonstração', atributos: { faixaPeso: '', genero: 'unissex', absorcao: '', tecnologia: '' } }
    const other = await local(b, 'POST', '/products', draft); assert.equal(other.status, 201)
    for (let i = 0; i < 13; i++) assert.equal((await local(a, 'POST', '/products', { ...draft, name: name + ' item ' + i, slug: slug + '-item-' + i })).status, 201)
    results.push('Fornecedor cria oferta original no navegador, sem depender de catálogo mestre disponível')
    const visitor = await pageFor()
    await visitor.goto(origin + '/produto/' + slug, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await visitor.getByText('Selecione uma oferta', { exact: true }).waitFor()
    await visitor.screenshot({ path: path.join(output, 'mp04-offer-choices.png') })
    await visitor.getByRole('link', { name: new RegExp('Fornecedor ' + b.localId) }).click()
    await visitor.getByRole('heading', { name, exact: true }).waitFor()
    assert((await visitor.locator('body').innerText()).includes('Fornecedor ' + b.localId))
    assert((await visitor.locator('body').innerText()).includes('3,00'))
    results.push('Slug compartilhado exige seleção e mantém ID, preço e fornecedor da oferta escolhida')
    const store = origin + '/catalogo/fornecedor/' + a.localId
    await visitor.goto(store + '?marca=QA', { waitUntil: 'domcontentloaded' })
    await visitor.getByRole('button', { name: 'Próxima página' }).click()
    await visitor.waitForURL(url => url.searchParams.get('page') === '2')
    assert(new URL(visitor.url()).pathname.endsWith(a.localId)); assert.equal(new URL(visitor.url()).searchParams.get('page'), '2')
    assert.equal(new URL(visitor.url()).searchParams.get('marca'), 'QA')
    await visitor.goto(store + '?search=sem-resultados-qa', { waitUntil: 'domcontentloaded' })
    await visitor.getByText('Nenhum produto encontrado', { exact: true }).waitFor()
    await visitor.getByRole('button', { name: 'Limpar filtros', exact: true }).last().click()
    await visitor.waitForURL(url => !url.searchParams.has('search'))
    await visitor.locator('a[href*="?p="]').first().waitFor()
    assert(new URL(visitor.url()).pathname.endsWith(a.localId))
    await visitor.setViewportSize({ width: 375, height: 812 })
    await visitor.getByRole('heading', { name: 'Catálogo: Fornecedor ' + a.localId }).waitFor()
    assert(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow')
    await visitor.screenshot({ path: path.join(output, 'mp04-catalog-mobile.png'), fullPage: true })
    results.push('Vitrine preserva fornecedor e filtros na paginação; vazio, limpeza e mobile conferidos')
    const orderRequest = { product: name, quantity: 2, unit: 'un', price: 400, supplierId: a.localId,
      deliveryAddress: { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' },
      items: [{ productId: offer.id, productName: name, unitPrice: 200, quantity: 2, unit: 'un' }] }
    const order = await local(buyer, 'POST', '/orders', orderRequest); assert.equal(order.status, 201)
    await supplierPage.getByTestId('product-card-' + offer.id).getByText('R$ 2,00', { exact: true }).click()
    await supplierPage.getByLabel('Estoque disponível').fill('40')
    await supplierPage.getByLabel('Novo Preço (R$)').fill('3.50')
    await supplierPage.screenshot({ path: path.join(output, 'mp04-edit-offer.png') })
    await supplierPage.getByRole('button', { name: 'Salvar oferta' }).click()
    await supplierPage.getByTestId('product-card-' + offer.id).getByText('40 un', { exact: true }).waitFor()
    await supplierPage.getByTestId('delete-btn-' + offer.id).click()
    await supplierPage.getByRole('button', { name: 'Sim, remover produto' }).click()
    await supplierPage.getByTestId('product-card-' + offer.id).getByText('Despublicado', { exact: true }).waitFor()
    const history = await local(buyer, 'GET', '/orders')
    const saved = history.body.find(o => o.id === order.body.id)
    assert.equal(saved.items[0].unitPrice, 200); assert.equal(saved.items[0].productName, name + ' M')
    assert.equal(saved.supplierId, a.localId); assert.equal(saved.price, 400)
    const buyerPage = await pageFor('BUYER1')
    await buyerPage.goto(origin + '/minha-conta?tab=pedidos', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await buyerPage.getByText(name + ' M', { exact: true }).first().waitFor()
    await visitor.goto(origin + '/produto/' + slug + '?p=' + offer.id, { waitUntil: 'domcontentloaded' })
    await visitor.getByText('Produto não encontrado', { exact: true }).waitFor()
    results.push('Preço/estoque editados e oferta desativada na UI; pedido permanece com snapshot original no histórico do comprador')
    await visitor.route(api + '/products', route => route.fulfill({ status: 503, body: '{}' }))
    await visitor.goto(origin + '/catalogo', { waitUntil: 'domcontentloaded' })
    await visitor.getByText('Erro ao carregar catálogo', { exact: true }).waitFor()
    await visitor.unroute(api + '/products')
    await visitor.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
    await visitor.locator('a[href*="?p="]').first().waitFor()
    results.push('Erro de catálogo e recuperação pelo botão de nova tentativa conferidos')
    const moderated = await local(admin, 'PATCH', '/admin/products/' + other.body.id + '/status', { active: false, reason: 'QA MP-04: bloqueio administrativo local' })
    assert.equal(moderated.status, 200)
    assert.equal((await local(b, 'PUT', '/products/' + other.body.id, { active: true, moderationBlocked: false })).status, 403)
    await visitor.goto(origin + '/produto/' + slug + '?p=' + other.body.id, { waitUntil: 'domcontentloaded' })
    await visitor.getByText('Produto não encontrado', { exact: true }).waitFor()
    await visitor.screenshot({ path: path.join(output, 'mp04-moderation.png') })
    assert.equal((await local(admin, 'PATCH', '/admin/products/' + other.body.id + '/status', { active: true, reason: 'QA MP-04: liberação administrativa local' })).status, 200)
    await visitor.reload({ waitUntil: 'domcontentloaded' })
    await visitor.getByRole('heading', { name, exact: true }).waitFor()
    results.push('Admin bloqueia e libera; fornecedor não contorna moderação e o detalhe acompanha a disponibilidade')
    fs.writeFileSync(path.join(output, 'mp04-browser-result.json'), JSON.stringify({ passed: true, results }, null, 2))
    console.log(JSON.stringify({ passed: true, results }))
  } finally { for (const context of contexts) await context.close(); await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
