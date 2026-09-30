'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/contexts/auth-context'
import { Search, RefreshCw, Copy, Check, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UserRow extends UserProfile {
  uid: string
}

const PAGE_SIZE = 10

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'todos' | 'comprador' | 'fornecedor' | 'admin' | 'outros'>('todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedUid, setCopiedUid] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getDocs(collection(db, 'users'))
      .then((snapshot) => {
        if (cancelled) return
        const list: UserRow[] = snapshot.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as UserProfile),
        }))
        setUsers(list)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erro ao carregar usuários.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Contagem estrita e consistente por papel, incluindo papéis ausentes ou desconhecidos
  const roleCounts = useMemo(() => {
    const counts = { todos: 0, comprador: 0, fornecedor: 0, admin: 0, outros: 0 }
    if (!users) return counts
    counts.todos = users.length
    for (const u of users) {
      if (u.role === 'comprador') counts.comprador++
      else if (u.role === 'fornecedor') counts.fornecedor++
      else if (u.role === 'admin') counts.admin++
      else counts.outros++
    }
    return counts
  }, [users])

  const filteredUsers = useMemo(() => {
    if (!users) return []
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchRole =
        roleFilter === 'todos' ||
        (roleFilter === 'outros'
          ? u.role !== 'comprador' && u.role !== 'fornecedor' && u.role !== 'admin'
          : u.role === roleFilter)
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.uid.toLowerCase().includes(q)
      return matchRole && matchSearch
    })
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, safeCurrentPage])

  const handleCopyUid = useCallback(async (uid?: string) => {
    if (!uid) return
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(uid)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      setCopiedUid(uid)
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedUid(null)
      }, 2000)
    } catch {
      // Ignora erro ou negação de permissão da Clipboard API sem atualizar estado de sucesso
    }
  }, [])

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'comprador':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            comprador
          </span>
        )
      case 'fornecedor':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            fornecedor
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            admin
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {role || 'indefinido'}
          </span>
        )
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-red-600 font-medium mb-3">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true)
            setError(null)
            setRefreshKey((k) => k + 1)
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (loading && !users) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-brand-muted">
        <RefreshCw size={24} className="animate-spin mb-3 text-primary" />
        <p>Carregando usuários...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="admin-users-tab">
      {/* Top Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Buscar por nome, e-mail ou UID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 text-sm"
              aria-label="Buscar usuários"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-brand-muted">
            <Filter size={14} aria-hidden="true" />
            <span>Papel:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as typeof roleFilter)
              setCurrentPage(1)
            }}
            aria-label="Filtrar por papel"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-text shadow-sm focus:border-primary focus:outline-none"
          >
            <option value="todos">Todos ({roleCounts.todos})</option>
            <option value="comprador">Compradores ({roleCounts.comprador})</option>
            <option value="fornecedor">Fornecedores ({roleCounts.fornecedor})</option>
            <option value="admin">Administradores ({roleCounts.admin})</option>
            {roleCounts.outros > 0 && (
              <option value="outros">Outros ({roleCounts.outros})</option>
            )}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              setRefreshKey((k) => k + 1)
            }}
            disabled={refreshing}
            className="h-8 px-2.5 text-xs flex items-center gap-1"
            title="Recarregar usuários"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Users Count summary */}
      <div className="text-xs text-brand-muted flex justify-between items-center px-0.5">
        <span>
          Mostrando {filteredUsers.length} de {users?.length ?? 0} usuário(s)
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">
              <th className="py-2.5 px-3">Usuário</th>
              <th className="py-2.5 px-3">UID</th>
              <th className="py-2.5 px-3">Papel</th>
              <th className="py-2.5 px-3">Telefone / Doc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedUsers.map((u) => {
              const initial = (u.name || u.email || '?').charAt(0).toUpperCase()
              return (
                <tr key={u.uid} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark font-bold text-xs" aria-hidden="true">
                        {initial}
                      </div>
                      <div>
                        <div className="font-medium text-brand-text leading-tight">{u.name || 'Sem nome'}</div>
                        <div className="text-xs text-brand-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-brand-muted">
                    <div className="flex items-center gap-1.5">
                      <span title={u.uid}>{u.uid.slice(0, 10)}...</span>
                      <button
                        type="button"
                        onClick={() => handleCopyUid(u.uid)}
                        className="text-slate-400 hover:text-brand-text p-0.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                        title="Copiar UID completo"
                        aria-label={`Copiar UID de ${u.name || u.email || u.uid}`}
                      >
                        {copiedUid === u.uid ? (
                          <Check size={13} className="text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">{getRoleBadge(u.role)}</td>
                  <td className="py-2.5 px-3 text-xs text-brand-muted">
                    {u.phone || u.cpf || (u as unknown as Record<string, string>).cnpj || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-brand-muted">
            <p className="font-medium text-slate-600">Nenhum usuário encontrado com os filtros selecionados.</p>
            {(search || roleFilter !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setRoleFilter('todos')
                  setCurrentPage(1)
                }}
                className="mt-2 text-xs text-primary-dark hover:underline"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="text-xs h-8"
          >
            Anterior
          </Button>
          <span className="text-xs text-brand-muted">
            Página {safeCurrentPage} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="text-xs h-8"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
