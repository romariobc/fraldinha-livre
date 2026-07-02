'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useAuth, UserRole } from '@/contexts/auth-context'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, role, loading } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Se user ja tem role, redireciona para o destino apropriado
  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'comprador') {
        router.push('/minha-conta')
      } else if (role === 'fornecedor') {
        router.push('/fornecedor/painel')
      }
    }
  }, [user, role, loading, router])

  // Se nao esta logado, redireciona para login
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/onboarding')
    }
  }, [user, loading, router])

  async function handleSubmit(chosenRole: UserRole) {
    if (!user) return

    try {
      setIsSubmitting(true)
      setSelectedRole(chosenRole)

      // Gravar papel no Firestore
      await setDoc(doc(db, 'users', user.uid), {
        role: chosenRole,
        name: user.displayName || 'Usuario',
        email: user.email,
        createdAt: new Date().toISOString(),
      })

      toast.success(`Bem-vindo, ${chosenRole === 'comprador' ? 'comprador' : 'fornecedor'}!`)

      // Redirecionar baseado no papel escolhido
      if (chosenRole === 'comprador') {
        router.push('/minha-conta')
      } else if (chosenRole === 'fornecedor') {
        router.push('/fornecedor/painel')
      }
    } catch (error) {
      console.error('Erro ao salvar papel no Firestore:', error)
      toast.error('Erro ao completar onboarding')
      setSelectedRole(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  // Se ja tem role, nao mostrar onboarding (vai redirecionar via useEffect)
  if (role) {
    return null
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Visual panel — md+ */}
      <aside className="hidden md:flex flex-col items-center justify-center gap-6 bg-primary-dark px-16 py-20 text-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <Image
          src="/assets/img/Logo_simples_sem_fundo.png"
          alt=""
          width={100}
          height={100}
          className="h-24 w-auto relative z-10"
        />
        <h2 className="font-display font-black text-2xl lg:text-3xl text-white relative z-10">
          Bem-vindo à Fraldinha Livre!
        </h2>
        <p className="text-white/75 text-base leading-relaxed max-w-[300px] relative z-10">
          Escolha seu perfil para começar a aproveitar a melhor experiência de compra e venda de fraldas.
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-12 bg-white sm:px-12 lg:px-16">
        {/* Logo on mobile */}
        <div className="flex items-center gap-2.5 mb-8 md:hidden">
          <Image
            src="/assets/img/Logo_simples_sem_fundo.png"
            alt="Fraldinha Livre"
            width={36}
            height={36}
            className="h-9 w-auto"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display font-black text-base text-primary-dark">Fraldinha Livre</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-brand-muted">Fraldas para o seu bebê</span>
          </div>
        </div>

        <h3 className="font-display font-black text-2xl sm:text-3xl text-brand-text mb-2">
          Escolha seu perfil
        </h3>
        <p className="text-sm text-brand-muted mb-8">
          Logado como <strong>{user.email}</strong>
        </p>

        <div className="space-y-4">
          {/* Card Comprador */}
          <button
            onClick={() => handleSubmit('comprador')}
            disabled={isSubmitting}
            className="relative p-6 border-2 border-slate-200 rounded-2xl text-left transition-all hover:border-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">👶</div>
              <div className="flex-1">
                <h4 className="font-display font-bold text-lg text-brand-text">
                  Sou Comprador
                </h4>
                <p className="text-sm text-brand-muted mt-1">
                  Procuro as melhores fraldas com os melhores preços para meu bebê
                </p>
              </div>
            </div>
            {selectedRole === 'comprador' && isSubmitting && (
              <div className="mt-4 text-xs text-primary-dark font-semibold">
                Finalizando...
              </div>
            )}
          </button>

          {/* Card Fornecedor */}
          <button
            onClick={() => handleSubmit('fornecedor')}
            disabled={isSubmitting}
            className="relative p-6 border-2 border-slate-200 rounded-2xl text-left transition-all hover:border-accent hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🏭</div>
              <div className="flex-1">
                <h4 className="font-display font-bold text-lg text-brand-text">
                  Sou Fornecedor
                </h4>
                <p className="text-sm text-brand-muted mt-1">
                  Quero oferecer meus produtos para os melhores preços e conquistar novos clientes
                </p>
              </div>
            </div>
            {selectedRole === 'fornecedor' && isSubmitting && (
              <div className="mt-4 text-xs text-accent font-semibold">
                Finalizando...
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
