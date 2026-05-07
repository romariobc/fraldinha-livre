// src/components/Header.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/',          label: 'Início' },
  { href: '/catalogo',  label: 'Catálogo' },
  { href: '/#sobre',    label: 'Sobre Nós' },
  { href: '/#produtos', label: 'Produtos' },
  { href: '/#depoimentos', label: 'Depoimentos' },
  { href: '/#faq',      label: 'FAQ' },
  { href: '/#contato',  label: 'Contato' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary/10">
      <div className="container-fl">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/assets/img/Logo_simples_sem_fundo.png"
              alt="Fraldinha Livre"
              width={44}
              height={44}
              className="h-10 w-auto lg:h-12"
              priority
            />
            <div className="flex flex-col leading-tight">
              <span className="font-display font-black text-base lg:text-lg text-primary-dark tracking-tight">
                Fraldinha Livre
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-brand-muted">
                Fraldas para o seu bebê
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-brand-muted hover:text-primary-dark transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-5 py-2 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="px-5 py-2 rounded-full bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-all hover:-translate-y-px shadow-sm hover:shadow-accent/30"
            >
              Criar conta grátis
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-brand-text"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          className="lg:hidden bg-white border-t border-primary/10 px-4 pb-4"
          aria-label="Menu mobile"
        >
          <div className="flex flex-col gap-0.5 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2 pt-3 mt-2 border-t border-primary/10">
            <Link
              href="/login"
              className="flex-1 text-center py-2.5 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="flex-1 text-center py-2.5 rounded-full bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Criar conta
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
