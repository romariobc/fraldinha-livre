// src/app/cadastro/page.tsx
'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { firebaseAuthErrorMessage, safeRedirect } from '@/lib/utils'

export default function CadastroPage() {
  return (
    <Suspense fallback={<CadastroPageSkeleton />}>
      <CadastroPageContent />
    </Suspense>
  )
}

function CadastroPageSkeleton() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col items-center justify-center gap-6 bg-primary-dark px-16 py-20 text-center relative overflow-hidden">
        <div className="animate-pulse">Carregando...</div>
      </aside>
      <div className="flex flex-col justify-center px-6 py-8 sm:py-12 bg-white sm:px-12 lg:px-16">
        <div className="animate-pulse">Carregando...</div>
      </div>
    </div>
  )
}

function CadastroPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUpEmail, signInGoogle, user, role, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  // Mesmo roteamento pos-auth do /login (RN-06, D-013): sem papel -> onboarding;
  // com papel -> destino direto. Cobre tanto conta nova (role ainda null) quanto
  // usuario que ja tinha conta e caiu aqui por engano.
  useEffect(() => {
    if (loading || !user) return
    if (role === null) {
      router.push('/onboarding')
    } else if (role === 'fornecedor') {
      router.push('/painel-fornecedor')
    } else {
      const redirect = searchParams.get('redirect')
      router.push(safeRedirect(redirect))
    }
  }, [loading, user, role, router, searchParams])

  async function handleGoogleSignIn() {
    if (isLoading || loading) return
    try {
      setIsLoading(true)
      await signInGoogle()
      // onAuthStateChanged dispara automaticamente; o useEffect acima leva pro onboarding/destino
    } catch (error) {
      console.error('Erro ao conectar com Google:', error)
      toast.error('Erro ao conectar com Google')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLoading || loading) return
    try {
      setIsLoading(true)
      await signUpEmail(email, senha, nome)
      // onAuthStateChanged dispara automaticamente; o useEffect acima leva pro onboarding
    } catch (error) {
      toast.error(firebaseAuthErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">

      {/* Visual panel */}
      <aside className="hidden md:flex flex-col items-center justify-center gap-6 bg-primary-dark px-16 py-20 text-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <Image
          src="/assets/img/cegonha.png"
          alt=""
          width={589}
          height={366}
          className="h-24 w-auto animate-float relative z-10"
        />
        <h2 className="font-display font-black text-2xl lg:text-3xl text-white relative z-10">
          Junte-se a 2.400 famílias!
        </h2>
        <p className="text-white/75 text-base leading-relaxed max-w-[300px] relative z-10">
          Crie sua conta grátis e comece a economizar nas fraldas do seu bebê ainda hoje.
        </p>
        {[
          '✨ Cadastro 100% gratuito',
          '💸 Economia média de R$87/mês',
          '📦 Acesse seu histórico de pedidos',
        ].map((benefit) => (
          <div
            key={benefit}
            className="flex items-center gap-2.5 bg-white/10 rounded-xl px-5 py-3 text-white text-sm font-semibold w-full max-w-[300px] relative z-10"
          >
            {benefit}
          </div>
        ))}
      </aside>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-8 sm:py-12 bg-white sm:px-12 lg:px-16 overflow-y-auto">

        {/* Logo on mobile */}
        <div className="flex items-center gap-2.5 mb-4 sm:mb-8 md:hidden">
          <Image
            src="/assets/img/cegonha.png"
            alt="Fraldinha Livre"
            width={589}
            height={366}
            className="h-9 w-auto"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display font-black text-base text-primary-dark">Fraldinha Livre</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-brand-muted">Fraldas para o seu bebê</span>
          </div>
        </div>

        <Link href="/" className="text-sm font-semibold text-primary-dark mb-4 sm:mb-6 inline-flex items-center gap-1 hover:underline">
          ← Voltar ao início
        </Link>

        <h3 className="font-display font-black text-2xl sm:text-3xl text-brand-text mb-1">
          Criar conta grátis
        </h3>
        <p className="text-sm text-brand-muted mb-5 sm:mb-8">
          Já tem conta?{' '}
          <Link href="/login" className="font-bold text-primary-dark hover:underline">
            Faça login
          </Link>
        </p>

        <form className="flex flex-col gap-4 sm:gap-5" onSubmit={handleSubmit}>
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome" className="text-sm font-semibold text-brand-text">Nome completo</Label>
            <Input id="nome" type="text" placeholder="Seu nome completo" autoComplete="name" required
              value={nome} onChange={(e) => setNome(e.target.value)}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-sm font-semibold text-brand-text">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha" className="text-sm font-semibold text-brand-text">Senha</Label>
            <Input id="senha" type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" required minLength={6}
              value={senha} onChange={(e) => setSenha(e.target.value)}
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text" />
          </div>

          <Button
            type="submit"
            disabled={isLoading || loading}
            className="w-full rounded-xl py-5 sm:py-6 bg-accent hover:bg-accent-dark font-display font-bold text-base text-white transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Criando conta...' : '✨ Criar minha conta grátis'}
          </Button>

          <div className="flex items-center gap-3 text-xs text-brand-muted my-0.5">
            <span className="flex-1 h-px bg-slate-200" />
            ou cadastre-se com
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || loading}
            variant="outline"
            className="w-full rounded-xl py-5 sm:py-6 border-2 border-slate-200 text-brand-muted font-semibold text-sm gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            {isLoading ? 'Conectando...' : 'Continuar com Google'}
          </Button>

          <p className="text-xs text-center text-brand-muted leading-relaxed mt-1">
            Ao criar sua conta você concorda com os{' '}
            <Link href="/termos" className="font-bold text-primary-dark hover:underline">Termos de Uso</Link>
            {' '}e{' '}
            <Link href="/privacidade" className="font-bold text-primary-dark hover:underline">Política de Privacidade</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}
