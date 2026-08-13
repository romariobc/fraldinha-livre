'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, UserRole } from '@/contexts/auth-context'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export default function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/login')
      return
    }

    const isAllowed = role ? allowedRoles.includes(role) : false
    if (!isAllowed) {
      if (role === 'fornecedor') {
        router.push('/painel-fornecedor')
      } else {
        router.push('/minha-conta')
      }
    }
  }, [user, role, loading, allowedRoles, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando...
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isAllowed = role ? allowedRoles.includes(role) : false
  if (!isAllowed) {
    return null
  }

  return <>{children}</>
}
