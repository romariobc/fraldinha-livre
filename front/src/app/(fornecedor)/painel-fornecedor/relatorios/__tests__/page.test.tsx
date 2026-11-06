import { render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import RelatoriosPage from '../page'
vi.mock('@/components/OrderReportPanel',()=>({default:({scope}:{scope:string})=><div>Fonte persistida {scope}</div>}))
it('uses the shared persisted supplier reporting flow',()=>{
  render(<RelatoriosPage />)
  expect(screen.getByRole('heading',{name:'Relatórios de pedidos'})).toBeInTheDocument()
  expect(screen.getByText('Fonte persistida fornecedor')).toBeInTheDocument()
})
