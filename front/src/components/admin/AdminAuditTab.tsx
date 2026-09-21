'use client'

import { useEffect, useState } from 'react'
import type { AdminAuditLogsResponse } from '@contracts'
import { apiFetch } from '@/lib/api-client'
import { copySupportCode, showErrorToast } from '@/lib/frontend-diagnostics'
import { Button } from '@/components/ui/button'

export default function AdminAuditTab() {
  const [data, setData] = useState<AdminAuditLogsResponse | null>(null)
  const [targetType, setTargetType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = targetType ? `?targetType=${encodeURIComponent(targetType)}` : ''
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
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [targetType])

  if (loading) return <div className="py-8 text-center text-brand-muted">Carregando auditoria...</div>
  if (error || !data) return <div className="py-8 text-center text-red-600">Erro ao carregar a trilha de auditoria.</div>

  return (
    <div className="space-y-4" data-testid="admin-audit-tab">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">{data.total} evento(s) administrativo(s)</p>
        <label className="flex items-center gap-2 text-sm">
          <span>Alvo</span>
          <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="rounded border px-2 py-1">
            <option value="">Todos</option>
            <option value="product">Produto</option>
            <option value="order">Pedido</option>
            <option value="user">Usuário</option>
            <option value="system">Sistema</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left">
            <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Administrador</th>
            <th className="py-2 pr-3">Ação</th><th className="py-2 pr-3">Alvo</th>
            <th className="py-2 pr-3">Justificativa</th><th className="py-2">Request ID</th>
          </tr></thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log.id} className="border-b align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-2 pr-3">{log.actorId}</td>
                <td className="py-2 pr-3">{log.action}</td>
                <td className="py-2 pr-3">{log.targetType}/{log.targetId}</td>
                <td className="py-2 pr-3 max-w-xs">{log.reason}</td>
                <td className="py-2 whitespace-nowrap">
                  <Button type="button" variant="ghost" size="xs" onClick={() => void copySupportCode(log.requestId)}>
                    Copiar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.logs.length === 0 && <p className="py-8 text-center text-brand-muted">Nenhum evento encontrado.</p>}
      </div>
    </div>
  )
}
