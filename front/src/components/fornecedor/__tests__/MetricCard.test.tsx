/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react'
import { DollarSign, Truck, AlertTriangle } from 'lucide-react'
import { MetricCard } from '../MetricCard'

describe('MetricCard Component', () => {
  it('renders title and formatted value correctly', () => {
    render(
      <MetricCard
        title="Receita Total"
        value="R$ 48.920,00"
        icon={DollarSign}
      />
    )

    expect(screen.getByText('Receita Total')).toBeInTheDocument()
    expect(screen.getByText('R$ 48.920,00')).toBeInTheDocument()
  })

  it('renders positive trend indicator with badge', () => {
    render(
      <MetricCard
        title="Ticket Médio"
        value="R$ 385,20"
        change={{
          value: 4.2,
          label: 'vs mês anterior',
          isPositiveGood: true,
        }}
      />
    )

    expect(screen.getByText('+4.2%')).toBeInTheDocument()
    expect(screen.getByText('vs mês anterior')).toBeInTheDocument()
  })

  it('renders negative trend indicator with custom label', () => {
    render(
      <MetricCard
        title="Pedidos Cancelados"
        value="4 cancelamentos"
        change={{
          value: -1.5,
          label: 'taxa 3.1%',
          isPositiveGood: false, // For cancellations, negative is good
        }}
        variant="danger"
        icon={AlertTriangle}
      />
    )

    expect(screen.getByText('-1.5%')).toBeInTheDocument()
    expect(screen.getByText('taxa 3.1%')).toBeInTheDocument()
  })

  it('renders badge when badge prop is provided', () => {
    render(
      <MetricCard
        title="Entregas Concluídas"
        value="128 pedidos"
        badge={{ text: 'Em Dia', variant: 'secondary' }}
        icon={Truck}
        variant="success"
      />
    )

    expect(screen.getByText('Em Dia')).toBeInTheDocument()
  })

  it('renders loading placeholder skeleton when loading is true', () => {
    const { container } = render(
      <MetricCard
        title="Receita Total"
        value="R$ 48.920,00"
        loading={true}
      />
    )

    expect(screen.getByText('Receita Total')).toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders sparkline chart with array of numbers and objects', () => {
    const { rerender } = render(
      <MetricCard
        title="Sparkline Test Numbers"
        value="100"
        sparklineData={[10, 20, 15, 30, 45, 60]}
        variant="primary"
      />
    )

    expect(screen.getByText('Sparkline Test Numbers')).toBeInTheDocument()

    rerender(
      <MetricCard
        title="Sparkline Test Objects"
        value="200"
        sparklineData={[
          { date: 'Seg', value: 10 },
          { date: 'Ter', value: 25 },
        ]}
        variant="success"
      />
    )

    expect(screen.getByText('Sparkline Test Objects')).toBeInTheDocument()
  })

  it('handles number and string change shorthands', () => {
    const { rerender } = render(
      <MetricCard
        title="Shorthand Number"
        value="50"
        change={8.5}
      />
    )

    expect(screen.getByText('+8.5%')).toBeInTheDocument()

    rerender(
      <MetricCard
        title="Shorthand String"
        value="50"
        change="-3.2%"
      />
    )

    expect(screen.getByText('-3.2%')).toBeInTheDocument()
  })
})
