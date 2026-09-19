'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw, Home, Copy, Check } from 'lucide-react'
import { diagnoseError, logFrontendDiagnostic, copySupportCode } from '@/lib/frontend-diagnostics'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const [copied, setCopied] = React.useState(false)

  // Diagnostica e registra log estruturado uma única vez na montagem
  useEffect(() => {
    const diag = diagnoseError(error, { operation: 'ui.render_boundary' })
    logFrontendDiagnostic(diag, { operation: 'ui.render_boundary' })
  }, [error])

  const diag = diagnoseError(error, { operation: 'ui.render_boundary' })
  const digest = error.digest

  const handleCopySupport = async () => {
    const codeToCopy = diag.requestId || digest
    if (codeToCopy) {
      const ok = await copySupportCode(codeToCopy)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-card shadow-card border border-red-100 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="size-6" />
        </div>

        <h1 className="font-display font-bold text-xl text-brand-text mb-2">
          Ops! Algo deu errado
        </h1>

        <p className="text-sm text-brand-muted mb-6">
          Tivemos um problema inesperado ao renderizar esta página. Você pode tentar novamente ou voltar para a página inicial.
        </p>

        {/* Exibição semanticamente distinta de Request ID vs Digest do Next.js */}
        {diag.requestId && (
          <div className="bg-brand-bg rounded-card p-3 mb-6 flex items-center justify-between text-xs text-brand-muted border">
            <span className="truncate mr-2">
              <strong className="text-brand-text">Código de suporte:</strong> {diag.requestId}
            </span>
            <button
              type="button"
              onClick={handleCopySupport}
              className="inline-flex items-center gap-1 font-semibold text-primary-dark hover:underline flex-shrink-0"
              aria-label="Copiar código de suporte"
            >
              {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}

        {!diag.requestId && digest && (
          <div className="bg-brand-bg rounded-card p-2 mb-6 text-xs text-brand-muted border">
            <span>Referência interna do sistema: <code className="font-mono">{digest}</code></span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-card px-4 py-2.5 transition-colors"
          >
            <RotateCcw className="size-4" />
            Tentar novamente
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-bg hover:bg-gray-100 text-brand-text text-sm font-semibold rounded-card px-4 py-2.5 transition-colors border"
          >
            <Home className="size-4" />
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  )
}
