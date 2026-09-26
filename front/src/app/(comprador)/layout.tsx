'use client'

import * as React from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'

export default function CompradorRouteGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleProtectedRoute allowedRoles={['comprador']}>
      <Header />
      <main>
        {children}
      </main>
      <Footer />
    </RoleProtectedRoute>
  )
}
