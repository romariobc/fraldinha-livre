import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import SupplierDashboardOverviewPage from '../page'
vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({user:{uid:'supplier-qa',displayName:'Distribuidora São Paulo'},role:'fornecedor'})}))
vi.mock('@/components/OrderReportPanel',()=>({default:({scope}:{scope:string})=><div>Relatório persistido {scope}</div>}))
describe('SupplierDashboardOverviewPage',()=>{
  it('greets the authenticated profile without asserting commercial verification',()=>{
    render(<SupplierDashboardOverviewPage />)
    expect(screen.getByRole('heading',{name:'Olá, Distribuidora São Paulo!'})).toBeInTheDocument()
    expect(screen.queryByText('Distribuidora Verificada')).not.toBeInTheDocument()
  })
  it('uses persisted reporting instead of estimated revenue and synthetic curves',()=>{
    render(<SupplierDashboardOverviewPage />)
    expect(screen.getByText('Relatório persistido fornecedor')).toBeInTheDocument()
    expect(screen.queryByText('Faturamento Total')).not.toBeInTheDocument()
  })
  it('states simulation limitations next to the operational entry point',()=>{
    render(<SupplierDashboardOverviewPage />)
    expect(screen.getByText(/Compra, pagamento e entrega continuam simulados/)).toBeInTheDocument()
  })
  it('links to actual supplier catalog, orders and reporting',()=>{
    render(<SupplierDashboardOverviewPage />)
    expect(screen.getByRole('link',{name:'Gerenciar catálogo'})).toHaveAttribute('href','/painel-fornecedor/catalogo')
    expect(screen.getByRole('link',{name:'Acompanhar pedidos'})).toHaveAttribute('href','/painel-fornecedor/pedidos')
    expect(screen.getByRole('link',{name:'Relatórios'})).toHaveAttribute('href','/painel-fornecedor/relatorios')
  })
})
