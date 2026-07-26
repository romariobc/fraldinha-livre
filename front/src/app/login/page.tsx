// src/app/login/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { safeRedirect, firebaseAuthErrorMessage } from '@/lib/utils'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageSkeleton() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col items-center justify-center gap-6 bg-primary-dark px-16 py-20 text-center relative overflow-hidden">
        <div className="animate-pulse">Carregando...</div>
      </aside>
      <div className="flex flex-col justify-center px-6 py-12 bg-white sm:px-12 lg:px-16">
        <div className="animate-pulse">Carregando...</div>
      </div>
    </div>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signInGoogle, signInEmail, user, role, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Roteamento pos-login (RN-06, D-013): quando o auth resolveu (loading=false) e ha usuario,
  // decide o destino pelo papel ja carregado do Firestore.
  // - sem papel (role === null) => onboarding (primeiro acesso escolhe comprador/fornecedor)
  // - comprador => o redirect recebido (?redirect) sanitizado ou /minha-conta
  // - fornecedor => /fornecedor/painel
  // Efeito (nao no render) para evitar "Cannot update a component while rendering".
  useEffect(() => {
    if (loading || !user) return
    if (role === null) {
      router.push('/onboarding')
    } else if (role === 'fornecedor') {
      router.push('/fornecedor/painel')
    } else {
      // comprador — D-013: usar safeRedirect para sanitizar o redirect
      const redirect = searchParams.get('redirect')
      router.push(safeRedirect(redirect))
    }
  }, [loading, user, role, router, searchParams])

  async function handleGoogleSignIn() {
    try {
      setIsLoading(true)
      await signInGoogle()
      // onAuthStateChanged dispara automaticamente apos o login
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error)
      toast.error('Erro ao fazer login com Google')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault()
    try {
      setIsLoading(true)
      await signInEmail(email, password)
      // onAuthStateChanged dispara automaticamente apos o login
    } catch (error) {
      toast.error(firebaseAuthErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
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
          src="/assets/img/cegonha.png"
          alt=""
          width={589}
          height={366}
          className="h-24 w-auto animate-float relative z-10"
        />
        <h2 className="font-display font-black text-2xl lg:text-3xl text-white relative z-10">
          Bem-vindo de volta!
        </h2>
        <p className="text-white/75 text-base leading-relaxed max-w-[300px] relative z-10">
          Entre na sua conta e aproveite as melhores ofertas de fraldas para o seu bebê.
        </p>
        {[
          '💰 Fornecedores competindo pelo seu pedido',
          '🚀 Entrega rápida e garantida',
          '🔒 Pagamento seguro via Mercado Pago',
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
      <div className="flex flex-col justify-center px-6 py-12 bg-white sm:px-12 lg:px-16">

        {/* Logo on mobile */}
        <div className="flex items-center gap-2.5 mb-8 md:hidden">
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

        <Link href="/" className="text-sm font-semibold text-primary-dark mb-6 inline-flex items-center gap-1 hover:underline">
          ← Voltar ao início
        </Link>

        <h3 className="font-display font-black text-2xl sm:text-3xl text-brand-text mb-1">
          Entrar na conta
        </h3>
        <p className="text-sm text-brand-muted mb-8">
          Não tem conta?{' '}
          <Link href="/cadastro" className="font-bold text-primary-dark hover:underline">
            Cadastre-se grátis
          </Link>
        </p>

        <form className="flex flex-col gap-5" onSubmit={handleEmailSignIn}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-sm font-semibold text-brand-text">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-slate-200 rounded-xl focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-sm font-semibold text-brand-text">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-2 border-slate-200 rounded-xl focus-visible:border-primary focus-visible:ring-0 text-brand-text"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" className="border-slate-300" disabled />
              <Label htmlFor="remember" className="text-sm text-brand-muted cursor-not-allowed opacity-50">
                Lembrar de mim
              </Label>
            </div>
            <span className="text-sm font-semibold text-brand-muted cursor-default opacity-50">
              Esqueci minha senha
            </span>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-6 bg-primary hover:bg-primary-dark font-display font-bold text-base text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando...' : 'Entrar na conta →'}
          </Button>

          <div className="flex items-center gap-3 text-xs text-brand-muted">
            <span className="flex-1 h-px bg-slate-200" />
            ou entre com
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            variant="outline"
            className="w-full rounded-xl py-6 border-2 border-slate-200 text-brand-muted font-semibold text-sm gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            {isLoading ? 'Entrando...' : 'Entrar com Google'}
          </Button>
        </form>
      </div>
    </div>
  )
}
