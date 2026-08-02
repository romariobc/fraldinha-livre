'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import ChatUI from '@/components/assistente/ChatUI'

export default function AssistentePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/assistente')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="container-fl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-brand-text mb-4">Assistente de compra</h1>
      <ChatUI />
    </div>
  )
}
