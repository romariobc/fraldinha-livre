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
const origin = 'http://localhost:3004', api = 'http://127.0.0.1:8793'
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
 const browser = await pw.chromium.launch({headless:true, executablePath:process.env.QA_BROWSER_EXECUTABLE})
 const contexts = [], writes = []; let currentPage
 const call = async (who, method, route, body) => { const r = await local(who,method,route,body); assert(r.status>=200 && r.status<300, method+' '+route+': '+r.status); return r.body }
 try {
  console.log('QA: warm local routes')
  for (const route of ['/','/login','/minha-conta','/painel-fornecedor/pedidos','/admin']) assert.equal((await fetch(origin+route,{signal:AbortSignal.timeout(180000)})).status,200)
  const supplier=await identity('SUPPLIER'),buyer=await identity('BUYER1'),admin=await identity('ADMIN')
  const application=await call(supplier,'POST','/auth/supplier-application',{})
  if(application.application.status!=='aprovado') await call(admin,'PATCH','/admin/suppliers/'+supplier.localId,{status:'aprovado',expectedVersion:application.application.version,reason:'QA MP08 apenas no D1 local'})
  async function fixture(){
   const product=await call(supplier,'POST','/products',{name:'QA MP08 '+crypto.randomUUID(),slug:'qa-mp08-'+crypto.randomUUID(),brand:'QA',size:'M',quantity:10,priceCents:100,categoria:'infantil',descricao:'QA local',atributos:{faixaPeso:'',genero:'unissex',absorcao:'',tecnologia:''}})
   const order=await call(buyer,'POST','/orders',{product:product.name+' M',quantity:2,unit:'un',price:200,supplierId:supplier.localId,deliveryAddress:{logradouro:'Rua QA MP08',numero:'7',bairro:'Centro',cidade:'Fortaleza',estado:'CE',cep:'60000-000'},items:[{productId:product.id,productName:product.name+' M',quantity:2,unitPrice:100,unit:'un'}]})
   return {order,product}
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

  const item=await fixture(), orderId=item.order.id, endpoint='/orders/'+orderId+'/occurrences'
  const before=await call(buyer,'GET','/orders/'+orderId)
  console.log('QA: buyer opens occurrence with repeated click')
  const b=await login('BUYER1','/minha-conta')
  await b.getByTestId('order-card-'+orderId).getByRole('button',{name:'Problema com o pedido',exact:true}).click()
  await b.getByText('Nenhuma ocorrência registrada para este pedido.',{exact:true}).waitFor()
  await b.getByLabel('Descreva o problema').fill('Preciso de orientação sobre este pedido QA MP08')
  const beforeWrites=[]
  b.on('request',r=>{if(r.url()===api+endpoint && r.method()==='POST')beforeWrites.push(r.postDataJSON())})
  await b.getByRole('button',{name:'Abrir ocorrência',exact:true}).evaluate(button=>{button.click();button.click()})
  await b.getByText('Envio registrado.',{exact:false}).waitFor()
  await b.getByText('Preciso de orientação sobre este pedido QA MP08',{exact:true}).waitFor()
  assert.equal(beforeWrites.length,1)
  let records=await call(buyer,'GET',endpoint);assert.equal(records.length,1);assert.equal(records[0].messages.length,1)
  const reportId=records[0].id
  results.push('Comprador abre ocorrência real com clique duplo: um envio e uma conversa persistida')
  console.log('QA: supplier answers from order detail')
  const s=await login('SUPPLIER','/painel-fornecedor/pedidos')
  await s.getByTestId('order-id-'+orderId).click()
  await s.getByRole('button',{name:'Problema com o pedido',exact:true}).click()
  await s.getByRole('button',{name:'Ocorrência 1 · Aberta',exact:true}).click()
  await s.getByLabel('Sua resposta').fill('Recebemos seu pedido e vamos conferir o atendimento QA MP08')
  await s.getByRole('button',{name:'Enviar resposta',exact:true}).click()
  await s.getByText('Envio registrado.',{exact:false}).waitFor()
  await s.getByText('Recebemos seu pedido e vamos conferir o atendimento QA MP08',{exact:true}).waitFor()
  records=await call(buyer,'GET',endpoint);assert.equal(records[0].status,'em_atendimento');assert.equal(records[0].messages[1].actorId,supplier.localId)
  results.push('Fornecedor consulta abertura do comprador e responde; estado em_atendimento persistido')
  console.log('QA: admin resolves; buyer refreshes the completed conversation')
  const a=await login('ADMIN','/admin')
  await a.getByRole('tab',{name:'Pedidos',exact:true}).click()
  await a.getByRole('textbox',{name:'Buscar pedidos',exact:true}).fill(orderId)
  await a.getByRole('button',{name:'Ver detalhes do pedido '+orderId,exact:true}).click()
  await a.getByRole('button',{name:'Problema com o pedido',exact:true}).click()
  await a.getByRole('button',{name:'Ocorrência 1 · Em atendimento',exact:true}).click()
  assert.equal(await a.getByRole('button',{name:'Nova ocorrência',exact:true}).count(),0)
  assert(await a.getByRole('button',{name:'Resolver com esta resposta',exact:true}).isDisabled())
  await a.getByLabel('Sua resposta').fill('Orientação concluída e acordada com as partes QA MP08')
  await a.getByRole('button',{name:'Resolver com esta resposta',exact:true}).click()
  await a.getByText('Ocorrência resolvida:',{exact:false}).waitFor()
  records=await call(buyer,'GET',endpoint)
  assert.equal(records[0].status,'resolvida');assert.equal(records[0].resolvedBy,admin.localId);assert(records[0].resolvedAt)
  assert.equal(records[0].messages.length,3);assert.equal(records[0].messages[2].resolution,true)
  currentPage=b
  console.log('QA: buyer reads resolution and reloads')
  await b.getByRole('button',{name:'Atualizar ocorrências',exact:true}).click()
  await b.getByText('Orientação concluída e acordada com as partes QA MP08',{exact:true}).waitFor()
  assert.equal(await b.getByLabel('Sua resposta').count(),0)
  await b.reload({waitUntil:'domcontentloaded'})
  await b.getByTestId('order-card-'+orderId).getByRole('button',{name:'Problema com o pedido',exact:true}).click()
  await b.getByRole('button',{name:'Ocorrência 1 · Resolvida',exact:true}).click()
  await b.getByText('Orientação concluída e acordada com as partes QA MP08',{exact:true}).waitFor()
  const after=await call(buyer,'GET','/orders/'+orderId)
  assert.deepEqual(after,before)
  const products=await call(supplier,'GET','/products?scope=fornecedor');assert.equal(products.find(p=>p.id===item.product.id).quantity,8)
  assert.equal((await local(buyer,'POST',endpoint+'/'+reportId+'/messages',{message:'Tentativa após resolução',status:'em_atendimento',expectedVersion:2,requestId:crypto.randomUUID()})).status,409)
  results.push('Admin resolve com resposta/ator/horário; comprador lê após recarga; resolução não reabre nem altera pedido, eventos ou estoque')
  await b.getByRole('dialog').evaluate(dialog=>{dialog.scrollTop=0})
  await b.screenshot({path:path.join(output,'mp08-conversation-desktop.png'),fullPage:true})
  await b.setViewportSize({width:375,height:812})
  assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page overflow')
  assert(await b.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'mobile dialog overflow')
  await b.screenshot({path:path.join(output,'mp08-conversation-mobile.png'),fullPage:true})
  await b.keyboard.press('Tab')
  assert(await b.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),'focus escaped dialog')
  await b.keyboard.press('Escape')
  await b.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal(await b.locator(':focus').innerText(),'Problema com o pedido')
  results.push('375px sem transbordamento; foco permanece no diálogo e Escape retorna ao botão de origem')
  fs.writeFileSync(path.join(output,'mp08-browser-result.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results},null,2))
 } catch(error) { if(currentPage)await currentPage.screenshot({path:path.join(output,'mp08-failure.png'),fullPage:true,timeout:10000}).catch(()=>{});throw error }
 finally { for(const context of contexts)await context.close();await browser.close() }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
