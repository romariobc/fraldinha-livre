import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OrderReportPanel from '../OrderReportPanel'
import AdminOccurrencesTab from '../admin/AdminOccurrencesTab'
import { apiFetch } from '@/lib/api-client'
import { OrderReportSchema, type OrderReport } from '@contracts'
import { orderReportCSV } from '@/lib/order-report-csv'
const account=vi.hoisted(()=>({uid:'admin-qa',admin:true,role:'admin'}))
vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({user:{uid:account.uid},role:account.role,isAdmin:account.admin})}))
vi.mock('@/lib/api-client',()=>({apiFetch:vi.fn()}))
vi.mock('@/components/OrderOccurrences',()=>({default:({orderId,initialReportId}:{orderId:string;initialReportId:string})=><div>Conversa {orderId} {initialReportId}</div>}))
const response=(data:unknown)=>({json:async()=>data}) as Response
function fixture(count=23):OrderReport{
 const rows=Array.from({length:count},(_,i)=>({id:'pedido-'+String(i).padStart(2,'0'),buyerId:'buyer-qa',supplierId:'supplier-qa',product:'Produto '+i,status:'confirmado',priceCents:100,paymentMode:'simulated',createdAt:'2026-11-01T12:00:00.000Z',day:'2026-11-01'}))
 return OrderReportSchema.parse({timezone:'America/Fortaleza',currency:'BRL',snapshotAt:'2026-11-06T12:00:00.000Z',filters:{from:'2026-11-01',to:'2026-11-06',q:'',status:null,supplierId:null},rows,summary:{total:count,delivered:0,cancelled:0,simulatedValueCents:count*100,legacyValueCents:0,financialReceivedCents:null,unknownPriceCount:0,invalidDateCount:0},daily:[{day:'2026-11-01',orders:count,delivered:0,cancelled:0,simulatedValueCents:count*100}]})
}
beforeEach(()=>{vi.clearAllMocks();account.uid='admin-qa';account.admin=true;account.role='admin'})
describe('MP-10 report UI and CSV',()=>{
 it('paginates all queried rows locally and exports exactly that snapshot without another request',async()=>{
  const data=fixture(); vi.mocked(apiFetch).mockResolvedValue(response(data))
  let blob:Blob|undefined
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn((b:Blob)=>{blob=b;return 'blob:qa'}),revokeObjectURL:vi.fn()}))
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  render(<OrderReportPanel scope="admin" />)
  const table=await screen.findByRole('table',{name:'Pedidos consultados'})
  expect(within(table).getAllByRole('row')).toHaveLength(21)
  fireEvent.click(screen.getByRole('button',{name:'Próxima página'}))
  expect(within(table).getByText('pedido-22')).toBeInTheDocument()
  expect(within(table).queryByText('pedido-00')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Exportar consulta CSV'}))
  expect(blob).toBeDefined();expect(click).toHaveBeenCalledOnce();expect(apiFetch).toHaveBeenCalledOnce()
  expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/admin/reports/orders?'),undefined,'admin-qa')
  expect(screen.getByText('Não apurado — sem cobrança real')).toBeInTheDocument();click.mockRestore()
 })
 it('keeps draft filters separate, sends period/status/supplier/search and resets pagination',async()=>{
  vi.mocked(apiFetch).mockResolvedValue(response(fixture()))
  render(<OrderReportPanel scope="admin" />);await screen.findByText('Página 1 de 2 · 23 pedido(s)')
  fireEvent.click(screen.getByText('Próxima página'))
  fireEvent.change(screen.getByLabelText('Buscar pedido, produto ou UID'),{target:{value:'Produto'}})
  expect(screen.getByTestId('report-applied')).toHaveTextContent('busca: sem busca');expect(apiFetch).toHaveBeenCalledOnce()
  fireEvent.change(screen.getByLabelText('Início'),{target:{value:'2026-11-01'}})
  fireEvent.change(screen.getByLabelText('Fim (inclusive)'),{target:{value:'2026-11-06'}})
  fireEvent.change(screen.getByLabelText('Estado'),{target:{value:'confirmado'}})
  fireEvent.change(screen.getByLabelText('UID do fornecedor'),{target:{value:'supplier-qa'}})
  fireEvent.click(screen.getByText('Aplicar filtros'))
  await waitFor(()=>expect(apiFetch).toHaveBeenLastCalledWith('/admin/reports/orders?from=2026-11-01&to=2026-11-06&q=Produto&status=confirmado&supplierId=supplier-qa',undefined,'admin-qa'))
  expect(await screen.findByText('Página 1 de 2 · 23 pedido(s)')).toBeInTheDocument()
 })
 it('preserves the last snapshot on refresh failure and blocks export until recovery',async()=>{
  vi.mocked(apiFetch).mockResolvedValueOnce(response(fixture(1))).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response(fixture(0)))
  render(<OrderReportPanel scope="admin" />);await screen.findByText('pedido-00')
  fireEvent.click(screen.getByText('Atualizar relatório'));await screen.findByRole('alert')
  expect(screen.getByText('pedido-00')).toBeInTheDocument();expect(screen.getByText('Exportar consulta CSV')).toBeDisabled()
  fireEvent.click(screen.getByText('Atualizar relatório'));await screen.findByText('Nenhum pedido para os filtros aplicados.')
  expect(screen.queryByText('pedido-00')).not.toBeInTheDocument()
 })
 it('discards late responses from the previous account and rejects non-admin mounting',async()=>{
  let resolve!:(r:Response)=>void
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise(r=>{resolve=r})).mockResolvedValue(response(fixture(0)))
  const view=render(<OrderReportPanel scope="admin" />)
  await waitFor(()=>expect(apiFetch).toHaveBeenCalledOnce());account.uid='admin-new';view.rerender(<OrderReportPanel scope="admin" />)
  await screen.findByText('Nenhum pedido para os filtros aplicados.');resolve(response(fixture(1)))
  await waitFor(()=>expect(screen.queryByText('pedido-00')).not.toBeInTheDocument())
  account.admin=false;view.rerender(<OrderReportPanel scope="admin" />);expect(screen.queryByRole('region')).not.toBeInTheDocument()
 })
 it('uses supplier route and expected UID without exposing cross-supplier filtering',async()=>{
  account.role='fornecedor';account.admin=false;vi.mocked(apiFetch).mockResolvedValue(response(fixture(0)))
  render(<OrderReportPanel scope="fornecedor" />);await screen.findByText('Nenhum pedido para os filtros aplicados.')
  expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/reports/orders?'),undefined,'admin-qa')
  expect(screen.queryByLabelText('UID do fornecedor')).not.toBeInTheDocument()
 })
 it('escapes CSV quotes, delimiters, newlines and formula cells; includes every row and integer cents',()=>{
  const data=fixture(23);data.rows[0].product=' =HYPERLINK("evil");\r\nproduto';data.rows[1].supplierId='@SUM(1)';data.rows[2].priceCents=null
  const csv=orderReportCSV(data)
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  expect(csv).toContain('"\' =HYPERLINK(""evil"");\r\nproduto"')
  expect(csv).toContain('"\'@SUM(1)"');expect(csv).toContain('"pedido-22"');expect(csv).toContain('"100";"simulated"')
  expect(csv).toContain('"2026-11-01";"2026-11-06";"2026-11-06T12:00:00.000Z"')
 })
 it('pages, filters and opens the selected admin occurrence conversation',async()=>{
  vi.mocked(apiFetch).mockImplementation(async path=>response({items:[{id:path.includes('page=2')?'report-b':'report-a',orderId:'order-a',buyerId:'b',supplierId:'s',status:'aberta',createdAt:'2026-11-01',legacy:false}],total:21,page:path.includes('page=2')?2:1,limit:20}))
  render(<AdminOccurrencesTab />);await screen.findByText('Abrir ocorrência report-a')
  fireEvent.click(screen.getByText('Mais ocorrências'));await screen.findByText('Abrir ocorrência report-b')
  fireEvent.click(screen.getByText('Abrir ocorrência report-b'));expect(screen.getByText('Conversa order-a report-b')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Buscar ocorrência, pedido ou UID'),{target:{value:'buyer-id'}})
  await waitFor(()=>expect(apiFetch).toHaveBeenLastCalledWith('/admin/occurrences?page=1&q=buyer-id',undefined,'admin-qa'))
  expect(screen.queryByText('Conversa order-a report-b')).not.toBeInTheDocument()
 })
})
