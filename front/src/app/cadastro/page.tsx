// src/app/cadastro/page.tsx
import Image from 'next/image'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function CadastroPage() {
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
      <div className="flex flex-col justify-center px-6 py-12 bg-white sm:px-12 lg:px-16 overflow-y-auto">

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
          Criar conta grátis
        </h3>
        <p className="text-sm text-brand-muted mb-8">
          Já tem conta?{' '}
          <Link href="/login" className="font-bold text-primary-dark hover:underline">
            Faça login
          </Link>
        </p>

        <form className="flex flex-col gap-4" action="#" method="post">
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome" className="text-sm font-semibold text-brand-text">Nome completo</Label>
            <Input id="nome" type="text" placeholder="Seu nome completo" autoComplete="name"
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-sm font-semibold text-brand-text">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email"
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
          </div>

          {/* CPF + Telefone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpf" className="text-sm font-semibold text-brand-text">CPF</Label>
              <Input id="cpf" type="text" placeholder="000.000.000-00" autoComplete="off"
                className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefone" className="text-sm font-semibold text-brand-text">Telefone</Label>
              <Input id="telefone" type="tel" placeholder="(00) 00000-0000" autoComplete="tel"
                className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
            </div>
          </div>

          {/* CEP + Bairro */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cep" className="text-sm font-semibold text-brand-text">CEP</Label>
              <Input id="cep" type="text" placeholder="00000-000" autoComplete="postal-code"
                className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bairro" className="text-sm font-semibold text-brand-text">Bairro</Label>
              <Input id="bairro" type="text" placeholder="Seu bairro"
                className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
            </div>
          </div>

          {/* Endereço */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endereco" className="text-sm font-semibold text-brand-text">Endereço completo</Label>
            <Input id="endereco" type="text" placeholder="Rua, número, complemento" autoComplete="street-address"
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400" />
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha" className="text-sm font-semibold text-brand-text">Senha</Label>
            <Input id="senha" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password"
              className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text" />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl py-6 bg-accent hover:bg-accent-dark font-display font-bold text-base text-white transition-colors mt-1"
          >
            ✨ Criar minha conta grátis
          </Button>

          <p className="text-xs text-center text-brand-muted leading-relaxed">
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
