import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../error'
import { ApiError } from '@/lib/api-client'

describe('ErrorBoundary (front/src/app/error.tsx - OBS-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renderiza título e mensagem amigável sem expor stack trace', () => {
    const error = new Error('Database SQL syntax error at line 542 SELECT * FROM users')
    error.stack = 'Error: Database SQL syntax error\n  at Object.<anonymous> (/internal/db.js:10)'
    const reset = vi.fn()

    render(<ErrorBoundary error={error} reset={reset} />)

    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument()
    expect(
      screen.getByText(/Tivemos um problema inesperado ao renderizar esta página/i)
    ).toBeInTheDocument()

    // Não deve expor detalhes internos do erro nem stack traces
    expect(screen.queryByText(/SELECT \* FROM users/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/internal\/db\.js/i)).not.toBeInTheDocument()
  })

  it('aciona função reset ao clicar no botão "Tentar novamente"', () => {
    const error = new Error('Temporary render crash')
    const reset = vi.fn()

    render(<ErrorBoundary error={error} reset={reset} />)

    const retryButton = screen.getByRole('button', { name: /Tentar novamente/i })
    fireEvent.click(retryButton)

    expect(reset).toHaveBeenCalledOnce()
  })

  it('exibe link de navegação para a home "/"', () => {
    const error = new Error('Render crash')
    const reset = vi.fn()

    render(<ErrorBoundary error={error} reset={reset} />)

    const homeLink = screen.getByRole('link', { name: /Ir para o início/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('exibe código de suporte quando o erro possui requestId', () => {
    const apiErr = new ApiError({
      code: 'INTERNAL_ERROR',
      status: 500,
      message: 'Server failure',
      requestId: 'req-trace-boundary-123',
    })
    const errorWithCause = new Error('Failed in render', { cause: apiErr })
    const reset = vi.fn()

    render(<ErrorBoundary error={errorWithCause} reset={reset} />)

    expect(screen.getByText(/Código de suporte:/i)).toBeInTheDocument()
    expect(screen.getByText(/req-trace-boundary-123/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copiar código de suporte/i })).toBeInTheDocument()
  })

  it('distingue semanticamente digest do Next.js de requestId (não chama digest de Código de suporte)', () => {
    const errorWithDigest = Object.assign(new Error('Next Server Component crash'), {
      digest: 'next-digest-hash-987654',
    })
    const reset = vi.fn()

    render(<ErrorBoundary error={errorWithDigest} reset={reset} />)

    // Deve exibir identificação de digest interno do sistema
    expect(screen.getByText(/Referência interna do sistema:/i)).toBeInTheDocument()
    expect(screen.getByText('next-digest-hash-987654')).toBeInTheDocument()

    // NUNCA deve rotular digest como Código de suporte
    expect(screen.queryByText(/Código de suporte:/i)).not.toBeInTheDocument()
  })
})
