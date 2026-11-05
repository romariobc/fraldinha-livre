'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

export default function NotificationLink() {
  const { user } = useAuth()
  if (!user) return null
  return <Link href="/avisos" aria-label="Meus avisos" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-sm font-semibold text-primary-dark hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary-dark">
    <Bell className="size-5" aria-hidden="true" /><span className="hidden sm:inline">Avisos</span>
  </Link>
}
