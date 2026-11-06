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
const origin = localOrigin(process.env.QA_FRONTEND_ORIGIN || 'http://localhost:3006')
const api = localOrigin(process.env.QA_API_ORIGIN || 'http://127.0.0.1:8795')
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

const results=[]
async function main(){
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH)
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_EXECUTABLE})
 let page
 try{
  const supplier=await identity('SUPPLIER'),supplier2=await identity('SUPPLIER2'),buyer=await identity('BUYER1'),admin=await identity('ADMIN')
  async function login(who,destination='/admin'){
   const context=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true})
   await context.route('**/*',route=>{
    const url=new URL(route.request().url())
    return (/^\/(auth|admin)\/|^\/(products|orders|notifications|reports)(\/|$)/.test(url.pathname)&&url.origin!==api&&url.origin!==origin)?route.abort():route.continue()
   })
   page=await context.newPage();page.setDefaultTimeout(120000)
   page.on('pageerror',error=>console.error('Browser error:',error.message))
   page.on('requestfailed',r=>console.log('Request failed:',new URL(r.url()).origin+new URL(r.url()).pathname,r.failure()?.errorText))
   page.on('response',response=>{if(response.url().includes('identitytoolkit.googleapis.com'))console.log('Auth HTTP:',new URL(response.url()).pathname,response.status())})
   await page.goto(origin+'/login',{waitUntil:'domcontentloaded'})
   await page.waitForFunction(()=>document.querySelector('button[type="submit"]')?.disabled===false)
   await page.getByLabel('E-mail',{exact:true}).fill(qa['QA_'+who+'_EMAIL'])
   await page.getByLabel('Senha',{exact:true}).fill(qa['QA_'+who+'_PASSWORD'])
   console.log('Login form filled:',who)
   await page.getByRole('button',{name:/Entrar na conta/}).click()
   console.log('Login submitted:',who)
   await page.waitForURL(url=>!url.pathname.startsWith('/login'),{waitUntil:'domcontentloaded'})
   await page.goto(origin+destination,{waitUntil:'domcontentloaded'})
   return page
  }
  if(process.env.QA_LOGIN_ONLY==='1'){await login('ADMIN');console.log('Login through UI passed');await page.getByRole('tab',{name:'Pedidos',exact:true}).click();await page.getByLabel('Buscar pedidos').waitFor({timeout:15000});console.log('Admin orders load passed');return}
  console.log('MP10 QA: seed local persisted cohort')
  for(const who of [supplier,supplier2]){
   await call(who,'POST','/auth/supplier-application',{})
   const app=(await call(who,'GET','/auth/supplier-application')).application
   if(app.status!=='aprovado')await call(admin,'PATCH','/admin/suppliers/'+who.localId,{status:'aprovado',expectedVersion:app.version,reason:'QA MP10 somente D1 local'})
  }
  let product,orders=[],reportId
  if(process.env.QA_REUSE_MP10_FIXTURE==='1'){
   const products=await call(supplier,'GET','/products?scope=fornecedor')
   const matches=products.filter(p=>p.name.startsWith('QA MP10 '));assert.equal(matches.length,1,'Reuse requires exactly one local MP10 product')
   product=matches[0]
   const all=(await call(admin,'GET','/orders?scope=admin')).filter(o=>o.items.some(i=>i.productId===product.id))
   assert.equal(all.length,23);assert.equal(all.filter(o=>o.status==='entregue').length,1);assert.equal(all.filter(o=>o.status==='cancelado').length,0)
   const occurrences=(await call(admin,'GET','/admin/occurrences?limit=50')).items.filter(r=>all.some(o=>o.id===r.orderId))
   assert.equal(occurrences.length,1);assert.equal(occurrences[0].status,'aberta');reportId=occurrences[0].id
   const delivered=all.find(o=>o.status==='entregue'),conversation=all.find(o=>o.id===occurrences[0].orderId)
   orders=[delivered,conversation,...all.filter(o=>o.id!==delivered.id&&o.id!==conversation.id)]
  }else{
   product=await call(supplier,'POST','/products',{name:'QA MP10 '+crypto.randomUUID(),slug:'qa-mp10-'+crypto.randomUUID(),brand:'QA',size:'M',quantity:100,priceCents:100,categoria:'infantil',descricao:'Somente QA local',atributos:{faixaPeso:'',genero:'unissex',absorcao:'',tecnologia:''}})
  const payload={product:product.name,quantity:2,unit:'un',price:200,supplierId:supplier.localId,simulationOutcome:'approved',deliveryAddress:{logradouro:'Rua QA MP10',numero:'10',bairro:'Centro',cidade:'Fortaleza',estado:'CE',cep:'60000-000'},items:[{productId:product.id,productName:product.name+' M',quantity:2,unitPrice:100,unit:'un'}]}
   for(let i=0;i<23;i++)orders.push(await call(buyer,'POST','/orders',payload))
  await call(supplier,'PATCH','/orders/'+orders[0].id+'/status',{status:'confirmado'})
  await call(supplier,'PATCH','/orders/'+orders[0].id+'/status',{status:'a-caminho'})
  await call(supplier,'PATCH','/orders/'+orders[0].id+'/status',{status:'entregue'})
   reportId=crypto.randomUUID();await call(buyer,'POST','/orders/'+orders[1].id+'/occurrences',{requestId:reportId,message:'QA MP10 verificar divergência no pedido'})
  }
  for(const who of [buyer,supplier,supplier2]){
   assert.equal((await request(who,'GET','/admin/reports/orders')).status,403)
   assert.equal((await request(who,'GET','/admin/occurrences')).status,403)
  }
  assert.equal((await request(supplier2,'GET','/reports/orders?supplierId='+supplier.localId)).status,403)
  assert.equal((await call(supplier2,'GET','/reports/orders')).rows.length,0)
  results.push('Persistência local de23 pedidos; isolamento administrativo e entre fornecedores pela API')
  console.log('MP10 QA: admin reports/pages/CSV')
  await login('ADMIN');await page.getByRole('region',{name:'Aprovação de fornecedores'}).getByText(supplier.localId,{exact:false}).first().waitFor()
  await page.getByRole('tab',{name:'Produtos',exact:true}).click();await page.getByPlaceholder('Buscar por nome, marca ou fornecedor...').fill(product.name);await page.getByText(product.name,{exact:false}).first().waitFor()
  await page.getByRole('tab',{name:'Relatórios',exact:true}).click()
  await page.getByRole('table',{name:'Pedidos consultados'}).waitFor()
  await page.getByLabel('UID do fornecedor').fill(supplier.localId)
  await page.getByRole('button',{name:'Aplicar filtros'}).click()
  await page.getByText('Página 1 de 2 · 23 pedido(s)',{exact:true}).waitFor()
  const report=await call(admin,'GET','/admin/reports/orders?supplierId='+supplier.localId)
  assert.equal(report.summary.total,23);assert.equal(report.summary.delivered,1);assert.equal(report.summary.simulatedValueCents,4600);assert.equal(report.summary.financialReceivedCents,null)
  await page.getByRole('button',{name:'Próxima página'}).click();await page.getByText('Página 2 de 2 · 23 pedido(s)',{exact:true}).waitFor()
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar consulta CSV'}).click()
  const download=await downloadPromise;const csvFile=path.join(output,'mp10-orders.csv');await download.saveAs(csvFile)
  const csv=fs.readFileSync(csvFile,'utf8');assert.equal(csv.trim().split('\r\n').length,24);for(const order of orders)assert(csv.includes('"'+order.id+'"'))
  assert.equal(csv.charCodeAt(0),0xfeff);assert(csv.includes('valor_centavos_BRL'));assert(csv.includes('dia_America_Fortaleza'))
  await page.getByLabel('Buscar pedido, produto ou UID').fill('sem-resultado-mp10')
  await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.getByText('Nenhum pedido para os filtros aplicados.').waitFor()
  await page.getByLabel('Buscar pedido, produto ou UID').fill('');await page.getByLabel('Estado',{exact:true}).selectOption('entregue');await page.getByRole('button',{name:'Aplicar filtros'}).click()
  await page.getByText(orders[0].id,{exact:true}).waitFor()
  await page.getByLabel('Estado',{exact:true}).selectOption('');await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.getByText('Página 1 de 2 · 23 pedido(s)',{exact:true}).waitFor()
  results.push('Totais conciliados com23 pedidos, paginação20/3, CSV completo23, busca vazia e filtro entregue')
  console.log('MP10 QA: network failure and viewport')
  const block='**/admin/reports/orders?*';await page.route(block,route=>route.abort())
  await page.getByRole('button',{name:'Atualizar relatório'}).click();await page.getByRole('alert').filter({hasText:'Não foi possível consultar o relatório'}).waitFor()
  assert(await page.getByRole('button',{name:'Exportar consulta CSV'}).isDisabled());assert(await page.getByText('Página 1 de 2 · 23 pedido(s)',{exact:true}).isVisible())
  await page.unroute(block);await page.getByRole('button',{name:'Atualizar relatório'}).click();await page.getByRole('button',{name:'Exportar consulta CSV'}).waitFor({state:'visible'})
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Exportar consulta CSV')?.disabled===false)
  for(const width of [375,1024]){
   await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(output,'mp10-admin-report-'+width+'.png'),fullPage:true})
   const sizes=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));assert(sizes.content<=sizes.viewport,'Report overflow '+width+': '+JSON.stringify(sizes))
  }
  await page.setViewportSize({width:1365,height:900})
  await page.getByLabel('Buscar pedido, produto ou UID').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'report-status')
  results.push('Falha de rede conserva snapshot e bloqueia CSV; recuperação; teclado e375/1024px sem overflow')
  console.log('MP10 QA: admin cancel and occurrence intervention')
  await page.getByRole('tab',{name:'Pedidos',exact:true}).click();await page.getByLabel('Buscar pedidos').fill(orders[2].id)
  const orderRow=page.getByRole('row').filter({hasText:orders[2].id});await orderRow.getByRole('button',{name:/detalhes/i}).click();await page.getByRole('button',{name:'Cancelar pedido',exact:true}).click()
  await page.getByRole('dialog').getByRole('textbox').fill('QA MP10 cancelamento administrativo documentado')
  await page.getByRole('dialog').getByRole('button',{name:/Confirmar cancelamento/}).click()
  await page.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal((await call(admin,'GET','/orders/'+orders[2].id+'?scope=admin')).order.status,'cancelado')
  await page.getByRole('tab',{name:'Ocorrências',exact:true}).click();await page.getByLabel('Buscar ocorrência, pedido ou UID').fill(reportId)
  await page.getByRole('button',{name:'Abrir ocorrência '+reportId,exact:true}).click()
  await page.getByLabel('Sua resposta',{exact:true}).fill('QA MP10 resposta administrativa com justificativa')
  await page.getByRole('button',{name:'Enviar resposta',exact:true}).click();await page.getByText('QA MP10 resposta administrativa com justificativa',{exact:true}).waitFor()
  await page.getByLabel('Sua resposta',{exact:true}).fill('QA MP10 resolução administrativa documentada')
  await page.getByRole('button',{name:'Resolver com esta resposta',exact:true}).click();await page.getByText('Ocorrência resolvida: conversa disponível para consulta, sem reabertura.').waitFor()
  const audit=await call(admin,'GET','/admin/audit-logs?targetType=order')
  assert(audit.logs.some(l=>l.action==='order.cancelled'&&l.targetId===orders[2].id&&l.reason.includes('MP10')))
  assert(audit.logs.some(l=>l.action==='occurrence.replied'&&l.metadata.reportId===reportId))
  assert(audit.logs.some(l=>l.action==='occurrence.resolved'&&l.metadata.reportId===reportId))
  const after=await call(admin,'GET','/admin/reports/orders?supplierId='+supplier.localId);assert.equal(after.summary.cancelled,1);assert.equal(after.summary.simulatedValueCents,4400);assert.equal(after.summary.delivered,1)
  await page.getByRole('tab',{name:'Auditoria',exact:true}).click();await page.getByText('occurrence.resolved',{exact:true}).waitFor();await page.getByText('Referências da intervenção').first().click()
  await page.screenshot({path:path.join(output,'mp10-audit.png'),fullPage:true})
  await page.reload();await page.getByRole('tab',{name:'Ocorrências',exact:true}).click();await page.getByLabel('Buscar ocorrência, pedido ou UID').fill(reportId)
  await page.getByRole('button',{name:'Abrir ocorrência '+reportId,exact:true}).click();await page.getByText('QA MP10 resolução administrativa documentada',{exact:true}).waitFor()
  results.push('Cancelamento e resposta/resolução pela UI persistem após recarga, com justificativa e referências no ledger')
  console.log('MP10 QA: supplier source and account isolation')
  await page.context().close();await login('SUPPLIER','/painel-fornecedor/relatorios')
  await page.getByText('Página 1 de 2 · 23 pedido(s)',{exact:true}).waitFor()
  assert.equal(await page.getByLabel('UID do fornecedor').count(),0)
  assert(await page.getByText('Não apurado — sem cobrança real',{exact:true}).isVisible())
  await page.setViewportSize({width:375,height:900});await page.screenshot({path:path.join(output,'mp10-supplier-report-375.png'),fullPage:true})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Supplier overflow')
  await page.goto(origin+'/painel-fornecedor',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:/Olá,/}).waitFor();assert.equal(await page.getByText('Faturamento Total',{exact:true}).count(),0)
  await page.context().close();await login('SUPPLIER2','/painel-fornecedor/relatorios');await page.getByText('Nenhum pedido para os filtros aplicados.').waitFor()
  assert.equal(await page.getByText(orders[0].id,{exact:true}).count(),0)
  await page.goto(origin+'/admin',{waitUntil:'domcontentloaded'});await page.waitForURL(u=>u.pathname!=='/admin');assert.equal(await page.getByRole('heading',{name:'Painel Administrativo',exact:true}).count(),0)
  results.push('Fornecedor usa mesma fonte persistida sem métricas fixas; outra conta não herda relatório nem acesso admin')
  fs.writeFileSync(path.join(output,'mp10-browser-results.json'),JSON.stringify({at:new Date().toISOString(),api,origin,results,productId:product.id,orderCount:23},null,2))
  console.log(JSON.stringify({passed:results.length,results},null,2))
 }catch(error){
  if(page&&!page.isClosed()){await page.screenshot({path:path.join(output,'mp10-failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(output,'mp10-failure.txt'),(await page.locator('body').innerText()).slice(0,18000))}
  throw error
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
