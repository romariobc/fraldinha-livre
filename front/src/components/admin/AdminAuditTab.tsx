'use client'

import { useEffect, useState } from 'react'
import type { AdminAuditLogsResponse } from '@contracts'
import { apiFetch } from '@/lib/api-client'
import { copySupportCode, showErrorToast } from '@/lib/frontend-diagnostics'
import { RefreshCw, Filter, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminAuditTab() {
  const [data, setData] = useState<AdminAuditLogsResponse | null>(null)
  const [targetType, setTargetType] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState(false)
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (targetType) params.set('targetType', targetType)
    if (page > 1) params.set('page', String(page))
    const query = params.size ? `?${params}` : ''

    apiFetch(`/admin/audit-logs${query}`)
      .then((response) => response.json() as Promise<AdminAuditLogsResponse>)
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData)
          setError(false)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(true)
          showErrorToast(reason, { operation: 'admin.audit_logs.list' })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [targetType, page, refreshKey])

  const handleCopy = async (requestId: string) => {
    await copySupportCode(requestId)
    setCopiedRequestId(requestId)
    setTimeout(() => setCopiedRequestId(null), 2000)
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-brand-muted">
        <RefreshCw size={24} className="animate-spin mb-3 text-primary" />
        <p>Carregando auditoria...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-red-600 font-medium mb-3">Erro ao carregar a trilha de auditoria.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true)
            setRefreshKey((k) => k + 1)
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <div className="space-y-4" data-testid="admin-audit-tab">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <p className="text-xs text-brand-muted font-medium">
          {data.total} evento(s) administrativo(s) registrado(s)
        </p>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-brand-muted">
            <Filter size={14} />
            <span>Alvo</span>
            <select
              value={targetType}
              onChange={(event) => {
                setLoading(true)
                setTargetType(event.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-text shadow-sm focus:border-primary focus:outline-none ml-1"
            >
              <option value="">Todos</option>
              <option value="product">Produto</option>
              <option value="order">Pedido</option>
              <option value="user">Usuário</option>
              <option value="system">Sistema</option>
            </select>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              setRefreshKey((k) => k + 1)
            }}
            disabled={refreshing}
            className="h-8 px-2.5 text-xs flex items-center gap-1"
            title="Recarregar auditoria"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">
              <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
              <th className="py-2.5 px-3">Administrador</th>
              <th className="py-2.5 px-3">Ação</th>
              <th className="py-2.5 px-3">Alvo</th>
              <th className="py-2.5 px-3">Justificativa</th>
              <th className="py-2.5 px-3 text-right">Request ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/60 transition-colors align-top text-xs">
                <td className="py-2.5 px-3 whitespace-nowrap text-brand-muted">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-brand-muted">
                  <span title={log.actorId}>{log.actorId.slice(0, 10)}...</span>
                </td>
                <td className="py-2.5 px-3 font-medium text-brand-text">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-brand-muted">
                  {log.targetType}/{log.targetId}
                </td>
                <td className="py-2.5 px-3 max-w-xs text-brand-text break-words">
                  {log.reason}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopy(log.requestId)}
                    className="h-7 px-2 text-xs text-brand-muted hover:text-brand-text inline-flex items-center gap-1"
                    title={`Copiar ${log.requestId}`}
                  >
                    {copiedRequestId === log.requestId ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>Copiar</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.logs.length === 0 && (
          <div className="py-12 text-center text-brand-muted">
            <p className="font-medium text-slate-600">Nenhum evento encontrado.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <nav aria-label="Paginação da auditoria" className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            setLoading(true)
            setPage((current) => current - 1)
          }}
          className="text-xs h-8"
        >
          Anterior
        </Button>
        <span className="text-xs text-brand-muted">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page * data.limit >= data.total}
          onClick={() => {
            setLoading(true)
            setPage((current) => current + 1)
          }}
          className="text-xs h-8"
        >
          Próxima
        </Button>
      </nav>
    </div>
  )
}
