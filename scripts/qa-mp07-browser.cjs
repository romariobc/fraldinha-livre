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
const origin = 'http://localhost:3003', api = 'http://127.0.0.1:8792'
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
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH), browser=await pw.chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_EXECUTABLE})
 const contexts=[], writes=[]
 let currentPage
 const call=async(who,method,route,body)=>{
  let response=await local(who,method,route,body)
  if(response.status===401)response=await local(who,method,route,body)
  assert(response.status>=200&&response.status<300,method+' '+route+': '+response.status)
  return response.body
 }
 try {
  console.log('QA: warm routes and authenticate existing identities')
  for(const route of ['/','/login','/minha-conta','/painel-fornecedor','/painel-fornecedor/pedidos','/admin'])assert.equal((await fetch(origin+route)).status,200)
  const supplier=await identity('SUPPLIER'),buyer=await identity('BUYER1'),admin=await identity('ADMIN')
  const application=await call(supplier,'POST','/auth/supplier-application',{})
  if(application.application.status!=='aprovado')await call(admin,'PATCH','/admin/suppliers/'+supplier.localId,{status:'aprovado',expectedVersion:application.application.version,reason:'QA MP07 apenas no D1 local'})
  async function fixture(){
   const product=await call(supplier,'POST','/products',{name:'QA MP07 '+crypto.randomUUID(),slug:'qa-mp07-'+crypto.randomUUID(),brand:'QA',size:'M',quantity:10,priceCents:100,categoria:'infantil',descricao:'QA local',atributos:{faixaPeso:'',genero:'unissex',absorcao:'',tecnologia:''}})
   const order=await call(buyer,'POST','/orders',{product:product.name+' M',quantity:2,unit:'un',price:200,supplierId:supplier.localId,deliveryAddress:{logradouro:'Rua QA MP07',numero:'7',bairro:'Centro',cidade:'Fortaleza',estado:'CE',cep:'60000-000'},items:[{productId:product.id,productName:product.name+' M',quantity:2,unitPrice:100,unit:'un'}]})
   return {order,product}
  }
  async function verify(fixture,status,count,stock){
   const detail=await call(buyer,'GET','/orders/'+fixture.order.id)
   assert.equal(detail.order.status,status);assert.equal(detail.events.length,count)
   const products=await call(supplier,'GET','/products?scope=fornecedor')
   assert.equal(products.find(value=>value.id===fixture.product.id).quantity,stock)
   return detail
  }
  async function login(who,destination){
   const context=await browser.newContext({viewport:{width:1365,height:900}});contexts.push(context)
   await context.route('**/*',route=>{const url=new URL(route.request().url());return (/^\/(auth|admin)\/|^\/(products|orders)(\/|$)/.test(url.pathname)&&url.origin!==api)?route.abort():route.continue()})
   const page=await context.newPage();currentPage=page;page.setDefaultTimeout(120000)
   page.on('request',req=>{if(req.url().startsWith(api+'/orders/')&&req.method()==='PATCH')writes.push({path:new URL(req.url()).pathname,body:req.postData()?req.postDataJSON():null})})
   await page.goto(origin+'/login',{waitUntil:'domcontentloaded'})
   await page.waitForFunction(()=>document.querySelector('button[type="submit"]')?.disabled===false)
   await page.getByLabel('E-mail',{exact:true}).fill(qa['QA_'+who+'_EMAIL']);await page.getByLabel('Senha',{exact:true}).fill(qa['QA_'+who+'_PASSWORD'])
   await page.getByRole('button',{name:/Entrar na conta/}).click();await page.waitForURL(url=>!url.pathname.startsWith('/login'),{waitUntil:'domcontentloaded'})
   await page.goto(origin+destination,{waitUntil:'domcontentloaded'});return page
  }
  async function openSupplier(page,fixture){
   await page.getByRole('button',{name:'Atualizar pedidos',exact:true}).click()
   await page.getByTestId('order-id-'+fixture.order.id).click()
  }
  async function double(page,name){await page.getByRole('button',{name,exact:true}).evaluate(button=>{button.click();button.click()})}
  const full=await fixture(), s=await login('SUPPLIER','/painel-fornecedor/pedidos')
  console.log('QA: supplier confirms, dispatches and delivers')
  await openSupplier(s,full);await double(s,'Confirmar Pedido');await s.getByRole('dialog').waitFor({state:'hidden'})
  await verify(full,'confirmado',2,8)
  await openSupplier(s,full);await s.getByRole('button',{name:'Despachar Pedido',exact:true}).click();await s.getByRole('dialog').waitFor({state:'hidden'})
  await verify(full,'a-caminho',3,8)
  await openSupplier(s,full)
  assert.equal(await s.getByRole('button',{name:/Cancelar Pedido|Recusar Pedido/}).count(),0)
  await s.getByRole('button',{name:'Confirmar Entrega',exact:true}).click();await s.getByRole('dialog').waitFor({state:'hidden'})
  await verify(full,'entregue',4,8);await openSupplier(s,full)
  assert.equal(await s.getByRole('button',{name:/Confirmar Pedido|Despachar Pedido|Confirmar Entrega|Cancelar Pedido|Recusar Pedido/}).count(),0)
  await s.getByRole('button',{name:'Problema com o pedido',exact:true}).click()
  await s.getByText('Nenhuma ocorrência foi enviada.',{exact:false}).waitFor()
  await s.getByRole('button',{name:'Voltar ao pedido',exact:true}).click();await s.getByRole('button',{name:'Fechar',exact:true}).click()
  assert.equal(writes.filter(value=>value.path==='/orders/'+full.order.id+'/status').length,3)
  results.push('Fornecedor: confirmação com clique duplo único, despacho, entrega e estado terminal; orientação de ocorrência sem cancelamento após despacho')
  console.log('QA: buyer cancellation')
  const own=await fixture(), b=await login('BUYER1','/minha-conta')
  await b.getByTestId('order-card-'+own.order.id).getByRole('button',{name:'Cancelar pedido',exact:true}).click()
  await double(b,'Confirmar cancelamento');await b.getByRole('dialog').waitFor({state:'hidden'})
  await verify(own,'cancelado',2,10)
  assert.equal(writes.filter(value=>value.path==='/orders/'+own.order.id+'/cancel').length,1)
  results.push('Comprador cancela aguardando; clique duplo cria um único evento e restitui estoque uma vez')
  console.log('QA: supplier and admin cancellation reasons')
  const refused=await fixture()
  await openSupplier(s,refused);await s.getByRole('button',{name:'Recusar Pedido',exact:true}).click()
  assert(await s.getByRole('button',{name:'Confirmar cancelamento',exact:true}).isDisabled())
  await s.getByLabel('Motivo do cancelamento').fill('Sem disponibilidade operacional QA')
  await s.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();await s.getByRole('dialog').waitFor({state:'hidden'})
  const refusedHistory=await verify(refused,'cancelado',2,10);assert.equal(refusedHistory.events.at(-1).reason,'Sem disponibilidade operacional QA')
  const adminOrder=await fixture();await call(supplier,'PATCH','/orders/'+adminOrder.order.id+'/status',{status:'confirmado'})
  const a=await login('ADMIN','/admin');await a.getByRole('tab',{name:'Pedidos',exact:true}).click()
  await a.getByRole('textbox',{name:'Buscar pedidos',exact:true}).fill(adminOrder.order.id)
  await a.getByRole('button',{name:'Ver detalhes do pedido '+adminOrder.order.id,exact:true}).click()
  await a.getByRole('button',{name:'Cancelar pedido',exact:true}).click()
  assert(await a.getByRole('button',{name:'Confirmar cancelamento',exact:true}).isDisabled())
  await a.getByLabel('Motivo do cancelamento').fill('Ajuste administrativo QA MP07')
  await a.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();await a.getByRole('dialog').waitFor({state:'hidden'})
  const adminHistory=await verify(adminOrder,'cancelado',3,10);assert.equal(adminHistory.events.at(-1).actorId,admin.localId)
  results.push('Fornecedor e admin cancelam antes do despacho com motivo obrigatório persistido; estoque restituído uma vez')
  console.log('QA: real concurrent state change while the UI retains a stale action')
  const conflict=await fixture();await openSupplier(s,conflict)
  await s.route(api+'/orders**',route=>route.request().method()==='GET'?route.abort('internetdisconnected'):route.continue())
  await call(buyer,'PATCH','/orders/'+conflict.order.id+'/cancel')
  // Hold the stale action until the write receives its definitive conflict, then allow the read reconciliation.
  await s.route(api+'/orders/'+conflict.order.id+'/status',async route=>{const response=await route.fetch();assert.equal(response.status(),409);await s.unroute(api+'/orders**');await route.fulfill({response})})
  await s.getByRole('button',{name:'Confirmar Pedido',exact:true}).click()
  await s.getByRole('alert').filter({hasText:'estado atualizado'}).waitFor()
  await s.getByRole('button',{name:'Confirmar Pedido',exact:true}).waitFor({state:'hidden'})
  await verify(conflict,'cancelado',2,10)
  await s.getByRole('region',{name:'Acompanhamento do pedido'}).getByText('Aguardando confirmação → Cancelado',{exact:true}).waitFor({timeout:15000})
  assert.equal(await s.getByRole('button',{name:/Despachar Pedido|Confirmar Entrega|Recusar Pedido/}).count(),0)
  await s.getByRole('dialog').evaluate(dialog=>{dialog.scrollTop=0})
  await s.screenshot({path:path.join(output,'mp07-conflict-desktop.png'),fullPage:true})
  results.push('Ação obsoleta recebe 409 real, exibe orientação e atualiza a tela para cancelado sem reabrir ou reservar novamente')
  await b.getByRole('tab',{name:/Histórico/}).click()
  await b.getByTestId('order-card-'+full.order.id).getByRole('button',{name:'Ver detalhes do pedido',exact:true}).click()
  assert.equal(await b.getByTestId('order-card-'+full.order.id).getByRole('button',{name:'Cancelar pedido',exact:true}).count(),0)
  await b.getByRole('region',{name:'Acompanhamento do pedido'}).getByText('A caminho → Entregue',{exact:true}).waitFor()
  await b.setViewportSize({width:375,height:812});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow')
  await b.screenshot({path:path.join(output,'mp07-terminal-mobile.png'),fullPage:true})
  fs.writeFileSync(path.join(output,'mp07-browser-result.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results},null,2))
 }catch(error){if(currentPage)await currentPage.screenshot({path:path.join(output,'mp07-failure.png'),fullPage:true,timeout:10000}).catch(()=>{});throw error}
 finally{for(const context of contexts)await context.close();await browser.close()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
