'use client'

import * as React from 'react'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'

export default function FornecedorRouteGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleProtectedRoute allowedRoles={['fornecedor']}>
      {children}
    </RoleProtectedRoute>
  )
}
