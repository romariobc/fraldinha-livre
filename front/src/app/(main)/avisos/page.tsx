'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'
import NotificationCenter from '@/components/NotificationCenter'

function Content() {
  const params = useSearchParams()
  return <NotificationCenter selectedId={params.get('notification')} />
}

export default function NotificationsPage() {
  return <RoleProtectedRoute allowedRoles={['comprador', 'fornecedor', 'admin']}>
    <div className="container-fl py-8"><Suspense fallback={<p role="status">Carregando avisos...</p>}><Content /></Suspense></div>
  </RoleProtectedRoute>
}
