'use client'

import * as React from 'react'
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { SupplierSidebar } from '@/components/fornecedor/SupplierSidebar'
import { SupplierHeader } from '@/components/fornecedor/SupplierHeader'

export default function SupplierDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleProtectedRoute allowedRoles={['fornecedor']}>
      <SidebarProvider defaultOpen={true}>
        <SupplierSidebar />
        <SidebarInset className="bg-slate-50/60 min-h-screen flex flex-col">
          <SupplierHeader />
          <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleProtectedRoute>
  )
}
