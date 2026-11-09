import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { Env, AppContext } from '../src/env'
import { createAuthMiddleware } from '../src/middleware/auth'
import { createOrderReportHandler, adminOccurrencesListHandler } from '../src/routes/reports'
import { ordersPostHandler, ordersStatusPatchHandler } from '../src/routes/orders'
import { occurrencesPostHandler, occurrencesReplyHandler } from '../src/routes/occurrences'
import { OrderReportSchema, AdminOccurrencesPageSchema } from '../../packages/contracts/src/report'

const api = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()
api.onError((_error, c) => c.json({ error: 'internal' }, 500))
api.use('*', createAuthMiddleware(async token => { const [role, uid] = token.split(':'); return { uid, role, claims: { role } } }))
api.get('/admin/reports/orders', createOrderReportHandler('admin'))
api.get('/reports/orders', createOrderReportHandler('fornecedor'))
api.get('/admin/occurrences', adminOccurrencesListHandler)
api.post('/orders', ordersPostHandler)
api.patch('/orders/:id/status', ordersStatusPatchHandler)
api.post('/orders/:id/occurrences', occurrencesPostHandler)
api.post('/orders/:id/occurrences/:reportId/messages', occurrencesReplyHandler)
const send = (path: string, token = 'admin:mp10-admin', method = 'GET', body?: unknown) => api.fetch(new Request('http://localhost' + path, {
  method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body),
}), env)
const period = 'from=2026-11-01&to=2026-11-02'
async function report(query = period, token?: string, admin = true) {
  const response = await send((admin ? '/admin' : '') + '/reports/orders?' + query, token)
  expect(response.status).toBe(200)
  return OrderReportSchema.parse(await response.json())
}
async function row(id: string, date: string, supplier: string | null, status = 'aguardando', price: number | null = 100, mode: string | null = 'simulated') {
  await env.DB.prepare(`INSERT INTO orders (id,uid,type,status,product,quantity,unit,price,supplier_id,payment_mode,delivery_address,created_at) VALUES (?,'mp10-b','compra-direta',?,'Produto MP10',1,'un',?,?,?,'{}',?)`).bind(id,status,price,supplier,mode,date).run()
}
async function fixture() {
  const id=crypto.randomUUID(), supplierId='mp10-s-'+id, buyer='comprador:mp10-b-'+id, supplier='fornecedor:'+supplierId, product='mp10-p-'+id
  await env.DB.prepare("INSERT INTO supplier_applications (uid,status,created_at,updated_at) VALUES (?,'aprovado','2026-11-01','2026-11-01')").bind(supplierId).run()
  await env.DB.prepare("INSERT INTO products (id,name,price_cents,supplier_id,quantity,active) VALUES (?,'Produto MP10',100,?,10,1)").bind(product,supplierId).run()
  const response=await send('/orders',buyer,'POST',{product:'Produto MP10',quantity:2,unit:'un',price:200,supplierId,deliveryAddress:{logradouro:'Rua QA',numero:'1',bairro:'Centro',cidade:'Fortaleza',estado:'CE',cep:'60000-000'},items:[{productId:product,productName:'Produto MP10',unitPrice:100,quantity:2,unit:'un'}]})
  expect(response.status).toBe(201)
  const order=await response.json() as {id:string}
  return { orderId:order.id,buyer,supplier,product }
}
const scalar = async (sql: string, id: string) => env.DB.prepare(sql).bind(id).first()
const patch = (id:string, status:string, token='admin:mp10-admin') => send('/orders/'+id+'/status',token,'PATCH',{status,reason:'Intervenção administrativa justificada'})

describe('MP-10 supervision: persisted snapshots and atomic intervention', () => {
  beforeAll(async () => { await applyD1Migrations(env.DB,env.TEST_MIGRATIONS) })
  it('reconciles totals, daily buckets and Fortaleza inclusive boundaries from the same persisted cohort', async () => {
    await row('mp10-before','2026-11-01T02:59:59.999Z','mp10-s')
    await row('mp10-start','2026-11-01T03:00:00Z','mp10-s','confirmado',200)
    await row('mp10-end','2026-11-03T02:59:59.999Z','mp10-s','entregue',300)
    await row('mp10-after','2026-11-03T03:00:00Z','mp10-s')
    await row('mp10-cancel','2026-11-02 12:00:00','mp10-s','cancelado',900)
    await row('mp10-legacy','2026-11-02T12:00:00-03:00','mp10-s','confirmado',400,null)
    await row('mp10-no-price','2026-11-02T12:00:00Z','mp10-s','aguardando',null)
    await row('mp10-bad-date','invalid','mp10-s')
    const data=await report(period+'&supplierId=mp10-s')
    expect(data.rows.map(r=>r.id)).not.toContain('mp10-before'); expect(data.rows.map(r=>r.id)).not.toContain('mp10-after')
    expect(data.summary).toEqual({total:5,delivered:1,cancelled:1,simulatedValueCents:500,legacyValueCents:400,financialReceivedCents:null,unknownPriceCount:1,invalidDateCount:1})
    expect(data.daily.reduce((n,d)=>n+d.orders,0)).toBe(data.rows.length)
    expect(data.daily.reduce((n,d)=>n+d.simulatedValueCents,0)).toBe(data.summary.simulatedValueCents)
    expect(data.daily.map(d=>d.orders)).toEqual([1,4])
    expect(data.rows.every(r=>r.createdAt.endsWith('Z'))).toBe(true)
    const filtered=await report(period+'&supplierId=mp10-s&status=entregue&q=MP10')
    expect(filtered.rows.map(r=>r.id)).toEqual(['mp10-end']); expect(filtered.summary.invalidDateCount).toBe(0)
    expect((await report(period+'&q=%25')).rows).toEqual([])
  })
  it('isolates supplier snapshots and never assigns missing historical relationships from current products',async()=>{
    await row('mp10-owned','2026-11-01T12:00:00Z','mp10-owner')
    await row('mp10-other','2026-11-01T12:00:00Z','mp10-other')
    await row('mp10-unlinked','2026-11-01T12:00:00Z',null)
    const data=await report(period,'fornecedor:mp10-owner',false)
    expect(data.rows.map(r=>r.id)).toEqual(['mp10-owned']); expect(data.filters.supplierId).toBe('mp10-owner')
    expect((await send('/reports/orders?'+period+'&supplierId=mp10-other','fornecedor:mp10-owner')).status).toBe(403)
    for(const token of ['comprador:mp10-b','fornecedor:mp10-owner']) expect((await send('/admin/reports/orders',token)).status).toBe(403)
    expect((await send('/reports/orders','comprador:mp10-b')).status).toBe(403)
    expect((await api.fetch(new Request('http://localhost/admin/reports/orders'),env)).status).toBe(401)
  })
  it.each(['from=2026-02-30&to=2026-03-01','from=2026-01-01','from=2026-11-03&to=2026-11-01','from=2025-01-01&to=2026-01-02','timezone=UTC','page=1'])('rejects invalid or ambiguous query %s',async query=>{
    expect((await send('/admin/reports/orders?'+query)).status).toBe(400)
  })
  it('refuses a partial snapshot above the explicit 5000-row cap',async()=>{
    await env.DB.exec(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<5001) INSERT INTO orders (id,uid,type,status,product,quantity,unit,price,supplier_id,delivery_address,created_at) SELECT 'mp10-cap-'||x,'mp10-cap','compra-direta','aguardando','Cap',1,'un',1,'mp10-cap','{}','2026-11-01T12:00:00Z' FROM n`)
    const response=await send('/admin/reports/orders?'+period+'&supplierId=mp10-cap')
    expect(response.status).toBe(400); expect(JSON.stringify(await response.json())).toContain('5.000')
    const limited=await report(period+'&supplierId=mp10-cap&q=mp10-cap-5001')
    expect(limited.summary.total).toBe(1)
  })
  it('cancels once under concurrent retries, restores stock once and audits the source event',async()=>{
    const f=await fixture()
    for(const status of ['confirmado','a-caminho','entregue']) expect((await patch(f.orderId,status)).status).toBe(403)
    expect((await send('/orders/'+f.orderId+'/status',undefined,'PATCH',{status:'cancelado'})).status).toBe(400)
    const responses=await Promise.all([patch(f.orderId,'cancelado'),patch(f.orderId,'cancelado')])
    expect(responses.map(r=>r.status)).toEqual([200,200])
    expect(await scalar('SELECT quantity FROM products WHERE id=?',f.product)).toEqual({quantity:10})
    const logs=await env.DB.prepare('SELECT * FROM audit_logs WHERE target_id=?').bind(f.orderId).all()
    expect(logs.results).toHaveLength(1)
    expect(logs.results[0]).toMatchObject({actor_id:'mp10-admin',actor_role:'admin',action:'order.cancelled',reason:'Intervenção administrativa justificada'})
    const meta=JSON.parse(logs.results[0].metadata as string)
    expect(await scalar('SELECT to_status FROM order_events WHERE id=?',meta.eventId)).toEqual({to_status:'cancelado'})
    expect((await patch(f.orderId,'cancelado')).status).toBe(200)
    expect(await scalar('SELECT COUNT(*) AS total FROM audit_logs WHERE target_id=?',f.orderId)).toEqual({total:1})
  })
  it('rolls back order, stock, events and notifications when mandatory audit persistence fails',async()=>{
    const f=await fixture()
    await env.DB.exec("CREATE TRIGGER mp10_fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'QA audit failure'); END;")
    try {
      expect((await patch(f.orderId,'cancelado')).status).toBe(500)
      expect(await scalar('SELECT status FROM orders WHERE id=?',f.orderId)).toEqual({status:'aguardando'})
      expect(await scalar('SELECT quantity FROM products WHERE id=?',f.product)).toEqual({quantity:8})
      expect(await scalar('SELECT COUNT(*) AS total FROM order_events WHERE order_id=?',f.orderId)).toEqual({total:1})
      expect(await scalar('SELECT COUNT(*) AS total FROM notifications WHERE order_id=?',f.orderId)).toEqual({total:1})
    } finally {await env.DB.exec('DROP TRIGGER mp10_fail_audit')}
    expect((await patch(f.orderId,'cancelado')).status).toBe(200)
  })
  it('admin cannot cancel after dispatch and a supplier transition remains operational',async()=>{
    const f=await fixture()
    expect((await patch(f.orderId,'confirmado',f.supplier)).status).toBe(200)
    expect((await patch(f.orderId,'a-caminho',f.supplier)).status).toBe(200)
    expect((await patch(f.orderId,'cancelado')).status).toBe(409)
    expect(await scalar('SELECT COUNT(*) AS total FROM audit_logs WHERE target_id=?',f.orderId)).toEqual({total:0})
  })
  it('pages and filters occurrences; replies/resolutions audit exact message refs, excerpt and retries',async()=>{
    const f=await fixture(), reportId=crypto.randomUUID(),path='/orders/'+f.orderId+'/occurrences'
    expect((await send(path,f.buyer,'POST',{requestId:reportId,message:'Problema a ser acompanhado'})).status).toBe(201)
    const other=crypto.randomUUID(); await send(path,f.buyer,'POST',{requestId:other,message:'Segunda ocorrência independente'})
    for(const token of [f.buyer,f.supplier]) expect((await send('/admin/occurrences',token)).status).toBe(403)
    const list=async(query:string)=>AdminOccurrencesPageSchema.parse(await (await send('/admin/occurrences?'+query)).json())
    const page=await list('q='+f.orderId+'&limit=1')
    expect(page.total).toBe(2); expect(page.items).toHaveLength(1)
    const next=await list('q='+f.orderId+'&limit=1&page=2'); expect(next.items[0].id).not.toBe(page.items[0].id)
    const text='Resposta documentada '.repeat(40)
    const message={requestId:crypto.randomUUID(),message:text,expectedVersion:0,status:'em_atendimento'}
    expect((await send(path+'/'+reportId+'/messages',undefined,'POST',message)).status).toBe(201)
    expect((await send(path+'/'+reportId+'/messages',undefined,'POST',message)).status).toBe(200)
    const log=await env.DB.prepare("SELECT reason,metadata FROM audit_logs WHERE target_id=? AND action='occurrence.replied'").bind(f.orderId).first<{reason:string;metadata:string}>()
    expect(log!.reason).toBe(text.trim().slice(0,500)); expect(JSON.parse(log!.metadata)).toMatchObject({reportId,messageId:message.requestId,resolution:0})
    const resolve={requestId:crypto.randomUUID(),message:'Resolução justificada publicamente',expectedVersion:1,status:'resolvida'}
    await env.DB.exec("CREATE TRIGGER mp10_fail_reply BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'QA audit failure'); END;")
    try {
      expect((await send(path+'/'+reportId+'/messages',undefined,'POST',resolve)).status).toBe(500)
      expect(await scalar('SELECT status,version FROM reports WHERE id=?',reportId)).toEqual({status:'em_atendimento',version:1})
      expect(await scalar('SELECT COUNT(*) AS total FROM report_messages WHERE id=?',resolve.requestId)).toEqual({total:0})
    } finally {await env.DB.exec('DROP TRIGGER mp10_fail_reply')}
    expect((await send(path+'/'+reportId+'/messages',undefined,'POST',resolve)).status).toBe(201)
    expect((await list('q='+reportId+'&status=resolvida')).total).toBe(1)
    expect(await scalar("SELECT COUNT(*) AS total FROM audit_logs WHERE target_id=? AND action LIKE 'occurrence.%'",f.orderId)).toEqual({total:2})
    expect(await scalar('SELECT status FROM orders WHERE id=?',f.orderId)).toEqual({status:'aguardando'})
    for(const query of ['limit=0','page=0','status=fechada','unknown=x']) expect((await send('/admin/occurrences?'+query)).status).toBe(400)
  })
})
