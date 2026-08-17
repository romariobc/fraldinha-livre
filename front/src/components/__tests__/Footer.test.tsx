/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Footer from '../Footer'

const mockUsePathname = vi.fn(() => '/')

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/')
  })

  it('renders footer on homepage with expanded content visible', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Footer />)

    expect(screen.getByText(/Conectamos famílias a fornecedores/i)).toBeInTheDocument()
    expect(screen.getByText('Navegação')).toBeInTheDocument()
    expect(screen.getByText('Ajuda')).toBeInTheDocument()
    expect(screen.getByText('Para fornecedores')).toBeInTheDocument()
  })

  it('renders collapsed footer on inner pages and toggles on click', () => {
    mockUsePathname.mockReturnValue('/catalogo')
    render(<Footer />)

    expect(screen.queryByText(/Conectamos famílias a fornecedores/i)).not.toBeInTheDocument()
    const toggleButton = screen.getByRole('button', { name: /Alternar rodapé expandido/i })
    expect(toggleButton).toBeInTheDocument()

    fireEvent.click(toggleButton)
    expect(screen.getByText(/Conectamos famílias a fornecedores/i)).toBeInTheDocument()
  })

  it('returns null on /painel-fornecedor routes', () => {
    mockUsePathname.mockReturnValue('/painel-fornecedor')
    const { container } = render(<Footer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('returns null on /painel-fornecedor subroutes', () => {
    mockUsePathname.mockReturnValue('/painel-fornecedor/relatorios')
    const { container } = render(<Footer />)
    expect(container).toBeEmptyDOMElement()
  })
})
