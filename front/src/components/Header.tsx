// src/components/Header.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, ShoppingBag, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'

const NAV_LINKS = [
  { href: '/',             label: 'Início' },
  { href: '/catalogo',     label: 'Catálogo' },
  { href: '/#sobre',       label: 'Sobre Nós' },
  { href: '/#depoimentos', label: 'Depoimentos' },
  { href: '/#faq',         label: 'FAQ' },
  { href: '/contato',      label: 'Contato' },
]

export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { user, role, signOutUser } = useAuth()
  const { itemCount } = useCart()

  const accountHref = role === 'fornecedor' ? '/painel-fornecedor' : '/minha-conta'

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dropdownOpen])

  // Fecha dropdown ao pressionar Escape
  useEffect(() => {
    if (!dropdownOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dropdownOpen])

  async function handleLogout() {
    try {
      await signOutUser()
      setDropdownOpen(false)
      router.push('/')
      toast.success('Logout realizado com sucesso!')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      toast.error('Erro ao fazer logout')
    }
  }

  if (pathname?.startsWith('/painel-fornecedor')) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary/10">
      <div className="container-fl">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/assets/img/cegonha.png"
              alt="Fraldinha Livre"
              width={589}
              height={366}
              className="h-11 w-auto lg:h-14"
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
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/sacola"
              aria-label="Sacola"
              className="relative p-2 rounded-full text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
            >
              <ShoppingBag size={22} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label={user.displayName || user.email || 'Conta'}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
                >
                  <span className="truncate max-w-xs">{user.displayName || user.email}</span>
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-primary/10 py-1 z-50"
                  >
                    <Link
                      href={accountHref}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Minha conta
                    </Link>
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
                    >
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Mobile: carrinho + hamburger */}
          <div className="lg:hidden flex items-center gap-1">
            <Link
              href="/sacola"
              aria-label="Sacola"
              className="relative p-2 text-brand-muted hover:text-primary-dark transition-colors"
            >
              <ShoppingBag size={22} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              className="p-2 text-brand-text"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
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
          {user && (
            <div className="flex flex-col gap-0.5 pt-2 mt-2 border-t border-primary/10">
              <Link
                href={accountHref}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-brand-muted hover:text-primary-dark hover:bg-primary-light transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Minha conta
              </Link>
            </div>
          )}
          <div className="flex gap-2 pt-3 mt-2 border-t border-primary/10">
            {user ? (
              <button
                onClick={() => {
                  handleLogout()
                  setMenuOpen(false)
                }}
                className="flex-1 text-center py-2.5 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
              >
                Sair
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
