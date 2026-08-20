'use client'

import * as React from 'react'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'

export default function CompradorRouteGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleProtectedRoute allowedRoles={['comprador']}>
      {children}
    </RoleProtectedRoute>
  )
}
